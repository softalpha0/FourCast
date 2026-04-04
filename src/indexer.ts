import { decodeEventLog, type Log, type Address } from 'viem';
import {
  publicClient,
  nowMs,
  formatBnb,
} from './chain.js';
import {
  FOURMEME_PROXY,
  FOURMEME_ABI,
  PANCAKE_FACTORY_V2,
  PANCAKE_FACTORY_ABI,
  PANCAKE_PAIR_ABI,
  WBNB_ADDRESS,
  TOKEN_PURCHASE_TOPIC,
  GRADUATION_THRESHOLD_WEI,
  BOOTSTRAP_BLOCKS,
} from './config.js';

const PAIR_CREATED_TOPIC = '0x0d3648bd0f6ba80134a33ba9275ac585d9d315f0ad8355cddefde31afa28d0e9' as const;
import {
  getCurve,
  upsertCurve,
  upsertGraduated,
  markGraduated,
  isKnownFourMemeToken,
  setLastIndexedBlock,
  getLastIndexedBlock,
  upsertTokenMetadata,
  getTokenMetadata,
  appendPurchaseHistory,
} from './store.js';
import type { CurveState, GraduatedToken, PurchaseEvent } from './types.js';
import { ERC20_ABI } from './config.js';

type OnPurchaseFn   = (event: PurchaseEvent) => void;
type OnGraduationFn = (token: Address, graduated: GraduatedToken) => void;

const purchaseListeners:   OnPurchaseFn[]   = [];
const graduationListeners: OnGraduationFn[] = [];

export function onPurchase(fn: OnPurchaseFn): void {
  purchaseListeners.push(fn);
}

export function onGraduation(fn: OnGraduationFn): void {
  graduationListeners.push(fn);
}

export async function bootstrap(): Promise<void> {
  const latest  = await publicClient.getBlockNumber();
  const fromBlock = latest - BOOTSTRAP_BLOCKS;

  console.log(`[Indexer] Bootstrapping from block ${fromBlock} → ${latest} (~${BOOTSTRAP_BLOCKS} blocks)`);

  const CHUNK = 50n;
  let cursor  = fromBlock;
  let totalLogs = 0;

  while (cursor <= latest) {
    const toBlock = cursor + CHUNK - 1n < latest ? cursor + CHUNK - 1n : latest;

    try {
      const [purchaseLogs, pairLogs] = await Promise.all([
        publicClient.getLogs({
          address:   FOURMEME_PROXY,
          topics:    [TOKEN_PURCHASE_TOPIC as `0x${string}`],
          fromBlock: cursor,
          toBlock,
        }).catch(() => [] as Log[]),
        publicClient.getLogs({
          address:   PANCAKE_FACTORY_V2,
          topics:    [PAIR_CREATED_TOPIC],
          fromBlock: cursor,
          toBlock,
        }).catch(() => [] as Log[]),
      ]);

      totalLogs += purchaseLogs.length;
      for (const log of purchaseLogs) await handlePurchaseLog(log, false);
      for (const log of pairLogs) await handlePairCreatedLog(log);

      if (purchaseLogs.length > 0) {
        process.stdout.write(`\r[Indexer] Bootstrap: ${totalLogs} events found so far…`);
      }
    } catch (err) {
      console.warn(`\n[Indexer] getLogs chunk ${cursor}–${toBlock} failed:`, (err as Error).message);
    }

    cursor = toBlock + 1n;
  }

  setLastIndexedBlock(latest);
  const { getAllCurves } = await import('./store.js');
  console.log(`\n[Indexer] Bootstrap complete. Events: ${totalLogs} | Curves: ${getAllCurves().length}`);
}

const POLL_INTERVAL_MS = 5_000;
const POLL_CHUNK       = 20n;

export function startPolling(): () => void {
  let running = true;

  async function poll(): Promise<void> {
    while (running) {
      try {
        const latest   = await publicClient.getBlockNumber();
        const lastSeen = getLastIndexedBlock();

        if (latest > lastSeen) {
          const from = lastSeen + 1n;
          const to   = from + POLL_CHUNK - 1n < latest ? from + POLL_CHUNK - 1n : latest;

          const [purchaseLogs, pairLogs] = await Promise.all([
            publicClient.getLogs({
              address:   FOURMEME_PROXY,
              topics:    [TOKEN_PURCHASE_TOPIC as `0x${string}`],
              fromBlock: from,
              toBlock:   to,
            }).catch(() => []),
            publicClient.getLogs({
              address:   PANCAKE_FACTORY_V2,
              topics:    [PAIR_CREATED_TOPIC],
              fromBlock: from,
              toBlock:   to,
            }).catch(() => []),
          ]);

          for (const log of purchaseLogs) await handlePurchaseLog(log, true);
          for (const log of pairLogs)    await handlePairCreatedLog(log);

          if (purchaseLogs.length > 0 || pairLogs.length > 0) {
            console.log(
              `[Indexer] Block ${to}: +${purchaseLogs.length} purchases, +${pairLogs.length} pair events`,
            );
          }

          setLastIndexedBlock(to);
        }
      } catch (err) {
        console.warn('[Indexer] Poll error:', (err as Error).message);
      }

      await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
    }
  }

  poll();
  return () => { running = false; };
}

export function watchPurchases(): () => void {
  return startPolling();
}
export function watchGraduations(): () => void {
  return () => {};
}

async function handlePurchaseLog(log: Log, isLive: boolean): Promise<void> {
  if (log.topics[0] !== TOKEN_PURCHASE_TOPIC) return;

  try {
    const decoded = decodeEventLog({
      abi:       FOURMEME_ABI,
      data:      log.data,
      topics:    log.topics,
      eventName: 'TokenPurchase',
    });

    const { token, account, price, amount, cost, fee, offers, funds } = decoded.args as {
      token:   Address;
      account: Address;
      price:   bigint;
      amount:  bigint;
      cost:    bigint;
      fee:     bigint;
      offers:  bigint;
      funds:   bigint;
    };

    const tsMs = nowMs();
    const blockNumber = log.blockNumber ?? 0n;

    const event: PurchaseEvent = {
      tokenAddress: token,
      buyer:        account,
      price,
      amount,
      cost,
      fee,
      offersAfter: offers,
      fundsAfter:  funds,
      blockNumber,
      txHash:      (log.transactionHash ?? '0x') as `0x${string}`,
      timestampMs: tsMs,
    };

    updateCurveState(event);

    appendPurchaseHistory(token, {
      buyer:        account,
      costWei:      cost.toString(),
      amountTokens: amount.toString(),
      txHash:       (log.transactionHash ?? '0x') as string,
      blockNumber:  (log.blockNumber ?? 0n).toString(),
      timestampMs:  tsMs,
    });

    if (isLive) {
      setLastIndexedBlock(blockNumber);
      purchaseListeners.forEach(fn => fn(event));
    }
  } catch {
  }
}

async function handlePairCreatedLog(log: Log): Promise<void> {
  try {
    const decoded = decodeEventLog({
      abi:       PANCAKE_FACTORY_ABI,
      data:      log.data,
      topics:    log.topics,
      eventName: 'PairCreated',
    });

    const { token0, token1, pair } = decoded.args as {
      token0: Address;
      token1: Address;
      pair:   Address;
    };

    const wbnb   = WBNB_ADDRESS.toLowerCase();
    const isWbnb = token0.toLowerCase() === wbnb || token1.toLowerCase() === wbnb;
    if (!isWbnb) return;

    const memeToken = token0.toLowerCase() === wbnb
      ? (token1.toLowerCase() as Address)
      : (token0.toLowerCase() as Address);

    if (!isKnownFourMemeToken(memeToken)) return;

    await processGraduation(memeToken, pair, log.blockNumber ?? 0n);
  } catch {
  }
}

function updateCurveState(event: PurchaseEvent): void {
  const existing = getCurve(event.tokenAddress);
  const tsMs     = event.timestampMs;

  if (!existing) {
    if (!getTokenMetadata(event.tokenAddress)) {
      publicClient.readContract({ address: event.tokenAddress, abi: ERC20_ABI, functionName: 'symbol' })
        .then(symbol =>
          publicClient.readContract({ address: event.tokenAddress, abi: ERC20_ABI, functionName: 'name' })
            .then(name => upsertTokenMetadata({
              tokenAddress: event.tokenAddress,
              symbol: symbol as string,
              name:   name   as string,
              decimals: 18,
            }))
        )
        .catch(() => {});
    }

    const newCurve: CurveState = {
      tokenAddress:      event.tokenAddress,
      offersRemaining:   event.offersAfter,
      initialOffers:     event.offersAfter + event.amount,
      fundsRemaining:    event.fundsAfter,
      initialFunds:      event.fundsAfter + event.cost,
      fundsAccumulated:  event.cost,
      lastPrice:         event.price,
      lastActivityMs:    tsMs,
      firstSeenMs:       tsMs,
      purchaseCount:     1,
      fillVelocityPerMs: 0,
      fillPct:           computeFillPct(event.cost, event.fundsAfter + event.cost),
      graduated:         false,
    };
    upsertCurve(newCurve);
    return;
  }

  const dtMs      = tsMs - existing.lastActivityMs;
  const costDelta = event.cost;

  const alpha         = 0.3;
  const instantVelocity = dtMs > 0 ? Number(costDelta) / dtMs : 0;
  const newVelocity   = existing.purchaseCount === 1
    ? instantVelocity
    : alpha * instantVelocity + (1 - alpha) * existing.fillVelocityPerMs;

  const fundsAccumulated = existing.initialFunds - event.fundsAfter;

  const updated: CurveState = {
    ...existing,
    offersRemaining:  event.offersAfter,
    fundsRemaining:   event.fundsAfter,
    fundsAccumulated,
    lastPrice:        event.price,
    lastActivityMs:   tsMs,
    purchaseCount:    existing.purchaseCount + 1,
    fillVelocityPerMs: newVelocity,
    fillPct:          computeFillPct(fundsAccumulated, existing.initialFunds),
    graduated:        event.fundsAfter === 0n,
  };

  upsertCurve(updated);

  if (updated.graduated) {
    console.log(`[Indexer] Curve full (via purchase): ${event.tokenAddress}`);
  }
}

function computeFillPct(accumulated: bigint, initial: bigint): number {
  if (initial === 0n) return 0;
  return Math.min(100, Number((accumulated * 10000n) / initial) / 100);
}

async function processGraduation(
  token:       Address,
  pair:        Address,
  blockNumber: bigint,
): Promise<void> {
  console.log(`[Indexer] Graduation detected: ${token} → pair ${pair}`);

  markGraduated(token);

  try {
    const [reserve0, reserve1] = await publicClient.readContract({
      address:      pair,
      abi:          PANCAKE_PAIR_ABI,
      functionName: 'getReserves',
    }) as [bigint, bigint, number];

    const token0 = await publicClient.readContract({
      address:      pair,
      abi:          PANCAKE_PAIR_ABI,
      functionName: 'token0',
    }) as Address;

    const wbnbIsToken0 = token0.toLowerCase() === WBNB_ADDRESS.toLowerCase();
    const wbnbReserve  = wbnbIsToken0 ? reserve0 : reserve1;
    const tokenReserve = wbnbIsToken0 ? reserve1 : reserve0;

    const curve = getCurve(token);

    const graduated: GraduatedToken = {
      tokenAddress:       token,
      pairAddress:        pair,
      wbnbReserve,
      tokenReserve,
      graduatedAtMs:      nowMs(),
      graduationBlock:    blockNumber,
      finalFillPct:       curve?.fillPct ?? 100,
      finalPurchaseCount: curve?.purchaseCount ?? 0,
      curveLifespanMs:    curve ? nowMs() - curve.firstSeenMs : 0,
    };

    upsertGraduated(graduated);
    graduationListeners.forEach(fn => fn(token, graduated));

    console.log(
      `[Indexer] Graduated ${token}: ${formatBnb(wbnbReserve)} BNB + ${tokenReserve.toString()} tokens locked`,
    );
  } catch (err) {
    console.error(`[Indexer] Failed to read pair reserves for ${token}:`, (err as Error).message);
  }
}

export async function pruneInactiveCurves(): Promise<void> {
  const { getAllCurves, removeCurve } = await import('./store.js');
  const STALE_MS = 6 * 60 * 60 * 1000;
  const now      = nowMs();

  for (const curve of getAllCurves()) {
    if (now - curve.lastActivityMs > STALE_MS) {
      removeCurve(curve.tokenAddress);
    }
  }
}
