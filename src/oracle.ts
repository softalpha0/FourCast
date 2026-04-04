import { type Address } from 'viem';
import { publicClient, toBnb } from './chain.js';
import {
  PANCAKE_FACTORY_V2,
  PANCAKE_FACTORY_ABI,
  PANCAKE_PAIR_ABI,
  WBNB_ADDRESS,
  LP_FEE_RATE,
} from './config.js';
import {
  getAllGraduated,
  getAllLPYields,
  upsertLPYield,
  getLPYield,
} from './store.js';
import type { LPYieldMetrics } from './types.js';

const REFRESH_INTERVAL_MS = 15 * 60 * 1000;

const BLOCKS_PER_DAY  = 28_800n;
const BLOCKS_PER_WEEK = BLOCKS_PER_DAY * 7n;

export async function refreshAllYields(): Promise<void> {
  const graduated = getAllGraduated();
  console.log(`[Oracle] Refreshing yield metrics for ${graduated.length} graduated tokens`);

  const BATCH = 5;
  for (let i = 0; i < graduated.length; i += BATCH) {
    const batch = graduated.slice(i, i + BATCH);
    await Promise.allSettled(batch.map(g => refreshTokenYield(g.tokenAddress, g.pairAddress)));
  }
}

export async function refreshTokenYield(
  token: Address,
  pairAddress?: Address,
): Promise<LPYieldMetrics | null> {
  const existing = getLPYield(token);
  if (existing && Date.now() - existing.lastRefreshedMs < REFRESH_INTERVAL_MS) {
    return existing;
  }

  const pair = pairAddress ?? await getPairAddress(token);
  if (!pair || pair === '0x0000000000000000000000000000000000000000') return null;

  try {
    const metrics = await computeYieldMetrics(token, pair);
    if (metrics) {
      upsertLPYield(metrics);
      console.log(
        `[Oracle] ${token}: locked ${toBnb(metrics.lockedBnbWei).toFixed(3)} BNB | ` +
        `24h vol ${toBnb(metrics.volume24hBnbWei).toFixed(3)} BNB | ` +
        `APY ${(metrics.annualizedYield * 100).toFixed(1)}%`,
      );
    }
    return metrics;
  } catch (err) {
    console.warn(`[Oracle] Failed to compute yield for ${token}:`, (err as Error).message);
    return null;
  }
}

async function computeYieldMetrics(
  token: Address,
  pair:  Address,
): Promise<LPYieldMetrics | null> {
  const [reserveData, token0Addr, totalSupply] = await Promise.all([
    publicClient.readContract({
      address:      pair,
      abi:          PANCAKE_PAIR_ABI,
      functionName: 'getReserves',
    }),
    publicClient.readContract({
      address:      pair,
      abi:          PANCAKE_PAIR_ABI,
      functionName: 'token0',
    }),
    publicClient.readContract({
      address:      pair,
      abi:          PANCAKE_PAIR_ABI,
      functionName: 'totalSupply',
    }),
  ]) as [[bigint, bigint, number], Address, bigint];

  const [reserve0, reserve1] = reserveData;
  const wbnbIsToken0 = (token0Addr as string).toLowerCase() === WBNB_ADDRESS.toLowerCase();
  const lockedBnbWei = wbnbIsToken0 ? reserve0 : reserve1;

  if (lockedBnbWei === 0n) return null;

  const latestBlock = await publicClient.getBlockNumber();

  const [volume24h, volume7d] = await Promise.all([
    getSwapVolumeBnb(pair, latestBlock - BLOCKS_PER_DAY, latestBlock, wbnbIsToken0),
    getSwapVolumeBnb(pair, latestBlock - BLOCKS_PER_WEEK, latestBlock, wbnbIsToken0),
  ]);

  const fees24h = BigInt(Math.round(Number(volume24h) * LP_FEE_RATE));

  const annualizedYield = lockedBnbWei > 0n
    ? (Number(fees24h) * 365) / Number(lockedBnbWei)
    : 0;

  return {
    tokenAddress:    token,
    pairAddress:     pair,
    lockedBnbWei,
    totalLPSupply:   totalSupply,
    volume24hBnbWei: volume24h,
    volume7dBnbWei:  volume7d,
    fees24hBnbWei:   fees24h,
    annualizedYield,
    lastRefreshedMs: Date.now(),
  };
}

async function getSwapVolumeBnb(
  pair:         Address,
  fromBlock:    bigint,
  toBlock:      bigint,
  wbnbIsToken0: boolean,
): Promise<bigint> {
  try {
    const logs = await publicClient.getLogs({
      address:   pair,
      event:     PANCAKE_PAIR_ABI.find(x => 'name' in x && x.name === 'Swap')!,
      fromBlock: fromBlock > 0n ? fromBlock : 0n,
      toBlock,
    });

    let totalVolumeWei = 0n;
    for (const log of logs) {
      try {
        const { decodeEventLog } = await import('viem');
        const decoded = decodeEventLog({
          abi:       PANCAKE_PAIR_ABI,
          data:      log.data,
          topics:    log.topics,
          eventName: 'Swap',
        });
        const { amount0In, amount1In } = decoded.args as {
          amount0In: bigint;
          amount1In: bigint;
        };
        const bnbIn = wbnbIsToken0 ? amount0In : amount1In;
        totalVolumeWei += bnbIn;
      } catch {
      }
    }
    return totalVolumeWei;
  } catch {
    return 0n;
  }
}

async function getPairAddress(token: Address): Promise<Address | null> {
  try {
    const pair = await publicClient.readContract({
      address:      PANCAKE_FACTORY_V2,
      abi:          PANCAKE_FACTORY_ABI,
      functionName: 'getPair',
      args:         [token, WBNB_ADDRESS],
    }) as Address;
    return pair;
  } catch {
    return null;
  }
}

export function oracleScoreForGraduatedToken(token: Address): number {
  const yield_ = getLPYield(token);
  if (!yield_) return 0;

  const bnbScore = Math.min(40, (toBnb(yield_.lockedBnbWei) / 30) * 40);

  const dailyVol  = toBnb(yield_.volume24hBnbWei);
  const volScore  = Math.min(30, (dailyVol / 5) * 30);

  const yieldScore = Math.min(30, (yield_.annualizedYield / 0.5) * 30);

  return Math.round(bnbScore + volScore + yieldScore);
}

export function getMedianAnnualizedYield(): number {
  const yields = getAllLPYields()
    .map(y => y.annualizedYield)
    .filter(y => y > 0)
    .sort((a, b) => a - b);

  if (!yields.length) return 0;
  return yields[Math.floor(yields.length / 2)];
}
