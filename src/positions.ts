import { randomUUID } from 'crypto';
import { type Address } from 'viem';
import { getTopOpportunities } from './scorer.js';
import { buy, sell, getTokenBalance, getPancakePrice } from './executor.js';
import { quoteBuy } from './fourmeme-api.js';
import {
  getOpenPositions,
  getPositionByToken,
  upsertPosition,
  getPosition,
} from './store.js';
import {
  MAX_OPEN_POSITIONS,
  PAPER_TRADING,
  EXIT_ON_GRADUATION,
  POST_GRAD_HOLD_MS,
} from './config.js';
import { nowMs, toBnb, formatBnb } from './chain.js';
import type { Position, GraduatedToken, CurveScore } from './types.js';

export async function evaluateEntries(): Promise<void> {
  const open = getOpenPositions();
  if (open.length >= MAX_OPEN_POSITIONS) return;

  const opportunities = getTopOpportunities(5);

  for (const { curve, score } of opportunities) {
    if (getOpenPositions().length >= MAX_OPEN_POSITIONS) break;
    if (getPositionByToken(curve.tokenAddress)) continue;
    await openPosition(curve.tokenAddress, score);
  }
}

export async function openPosition(
  token:            Address,
  score:            CurveScore,
  overrideBnbWei?:  bigint,
): Promise<void> {
  const positionBnb = score.recommendedPositionBnb;
  if (!overrideBnbWei && positionBnb <= 0) return;

  const bnbWei = overrideBnbWei ?? BigInt(Math.round(positionBnb * 1e18));

  console.log(
    `[Positions] Opening position on ${token} | ` +
    `score=${score.score} | gradProb=${score.graduationProbability.toFixed(2)} | ` +
    `size=${formatBnb(bnbWei)}`,
  );

  const id = randomUUID();

  const pos: Position = {
    id,
    tokenAddress:       token,
    status:             'open_curve',
    entryBnbWei:        bnbWei,
    entryTokenAmount:   0n,
    entryPrice:         0n,
    entryTxHash:        null,
    entryMs:            nowMs(),
    entryScore:         score.score,
    entryCurveFillPct:  score.breakdown.fillPctScore ?? 0,
    exitBnbWei:         null,
    exitTxHash:         null,
    exitMs:             null,
    graduated:          false,
    pairAddress:        null,
  };

  upsertPosition(pos);

  const quote = await quoteBuy(token, bnbWei);
  if (quote === null) {
    console.warn(`[Positions] quoteBuy returned null for ${token} — curve may be gone, skipping`);
    upsertPosition({ ...pos, status: 'closed_loss', exitBnbWei: 0n, exitMs: nowMs() });
    return;
  }
  if (quote.totalRequired > (bnbWei * 110n) / 100n) {
    console.warn(
      `[Positions] Quote cost ${formatBnb(quote.totalRequired)} exceeds budget ${formatBnb(bnbWei)} — skipping ${token}`,
    );
    upsertPosition({ ...pos, status: 'closed_loss', exitBnbWei: 0n, exitMs: nowMs() });
    return;
  }

  if (PAPER_TRADING) {
    console.log(
      `[Positions] [PAPER] Would buy ${formatBnb(bnbWei)} of ${token} ` +
      `(quote: ~${quote.estimatedAmount} tokens, fee ${formatBnb(quote.estimatedFee)})`,
    );
    const simPrice = quote.estimatedAmount > 0n
      ? (bnbWei * 10n ** 18n) / quote.estimatedAmount
      : 0n;
    upsertPosition({ ...pos, entryTokenAmount: quote.estimatedAmount, entryPrice: simPrice });
    return;
  }

  const result = await buy(token, bnbWei);
  if (result) {
    upsertPosition({
      ...pos,
      entryTokenAmount: result.tokenAmount,
      entryPrice:       result.price,
      entryTxHash:      result.txHash,
    });
    console.log(`[Positions] Bought ${result.tokenAmount} tokens for ${formatBnb(bnbWei)}`);
  } else {
    upsertPosition({ ...pos, status: 'closed_loss', exitBnbWei: 0n, exitMs: nowMs() });
    console.warn(`[Positions] Buy failed for ${token} — position closed`);
  }
}

export async function handleGraduation(
  token:     Address,
  graduated: GraduatedToken,
): Promise<void> {
  const pos = getPositionByToken(token);
  if (!pos || pos.status !== 'open_curve') return;

  console.log(`[Positions] Graduation detected for held token ${token} → transitioning to PancakeSwap`);

  upsertPosition({
    ...pos,
    status:      'open_pancake',
    graduated:   true,
    pairAddress: graduated.pairAddress,
  });

  if (EXIT_ON_GRADUATION) {
    setTimeout(() => exitPosition(pos.id, 'graduation_hold_complete'), POST_GRAD_HOLD_MS);
  }
}

export async function exitPosition(posId: string, reason: string): Promise<void> {
  const pos = getPosition(posId);
  if (!pos || !pos.status.startsWith('open')) return;

  console.log(`[Positions] Exiting ${pos.tokenAddress} | reason=${reason}`);

  upsertPosition({ ...pos, status: 'closing' });

  if (PAPER_TRADING) {
    const simulatedReturn = await simulatePaperExit(pos);
    const status = simulatedReturn > pos.entryBnbWei ? 'closed_profit' : 'closed_loss';
    upsertPosition({
      ...pos,
      status,
      exitBnbWei: simulatedReturn,
      exitTxHash: null,
      exitMs:     nowMs(),
    });
    console.log(
      `[Positions] [PAPER] Exit ${pos.tokenAddress}: ` +
      `returned ${formatBnb(simulatedReturn)} (entry ${formatBnb(pos.entryBnbWei)})`,
    );
    return;
  }

  const tokenBalance = await getTokenBalance(pos.tokenAddress);
  if (tokenBalance === 0n) {
    upsertPosition({ ...pos, status: 'closed_rug', exitBnbWei: 0n, exitMs: nowMs() });
    return;
  }

  const result = await sell(pos.tokenAddress, tokenBalance, pos.pairAddress ?? undefined);
  if (result) {
    const status = result.bnbReceived > pos.entryBnbWei ? 'closed_profit' : 'closed_loss';
    upsertPosition({
      ...pos,
      status,
      exitBnbWei: result.bnbReceived,
      exitTxHash: result.txHash,
      exitMs:     nowMs(),
    });
    console.log(
      `[Positions] Exited ${pos.tokenAddress}: ` +
      `${formatBnb(result.bnbReceived)} returned (entry ${formatBnb(pos.entryBnbWei)})`,
    );
  } else {
    upsertPosition({ ...pos, status: pos.graduated ? 'open_pancake' : 'open_curve' });
    console.warn(`[Positions] Exit failed for ${pos.tokenAddress} — will retry`);
  }
}

export async function monitorOpenPositions(): Promise<void> {
  const open = getOpenPositions().filter(p => p.status === 'open_pancake');

  for (const pos of open) {
    if (!pos.pairAddress) continue;

    try {
      const currentBnbPerToken = await getPancakePrice(pos.tokenAddress, pos.pairAddress);
      if (currentBnbPerToken === null) continue;

      const drawdown = 1 - Number(currentBnbPerToken) / Number(pos.entryPrice);

      if (drawdown > 0.8) {
        console.warn(`[Positions] Rug signal for ${pos.tokenAddress}: ${(drawdown * 100).toFixed(0)}% drawdown`);
        await exitPosition(pos.id, 'rug_detected');
      }
    } catch {
    }
  }
}

async function simulatePaperExit(pos: Position): Promise<bigint> {
  if (pos.status === 'open_curve') {
    const { getCurve } = await import('./store.js');
    const curve = getCurve(pos.tokenAddress);
    if (!curve || pos.entryTokenAmount === 0n) return pos.entryBnbWei;
    const gross = (pos.entryTokenAmount * curve.lastPrice) / 10n ** 18n;
    return (gross * 99n) / 100n;
  }

  if (pos.status === 'open_pancake' && pos.pairAddress) {
    const price = await getPancakePrice(pos.tokenAddress, pos.pairAddress);
    if (!price || pos.entryTokenAmount === 0n) return pos.entryBnbWei;
    const gross = (pos.entryTokenAmount * price) / 10n ** 18n;
    return (gross * 99n) / 100n;
  }

  return pos.entryBnbWei;
}
