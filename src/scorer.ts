import { type Address } from 'viem';
import {
  getAllCurves,
  getOracleStats,
  upsertScore,
  getRankedCurves,
  getHotRank,
} from './store.js';
import { oracleScoreForGraduatedToken } from './oracle.js';
import {
  MAX_POSITION_BNB,
  MAX_OPEN_POSITIONS,
  MIN_CURVE_SCORE,
  MIN_GRADUATION_PROB,
  GRADUATION_THRESHOLD_WEI,
} from './config.js';
import { toBnb } from './chain.js';
import type { CurveState, CurveScore } from './types.js';

export function scoreAllCurves(): void {
  const curves = getAllCurves();
  const oracle = getOracleStats();

  for (const curve of curves) {
    const score = scoreCurve(curve, oracle);
    upsertScore(score);
  }
}

export function scoreCurve(
  curve: CurveState,
  oracle = getOracleStats(),
): CurveScore {
  const now = Date.now();

  const fill = curve.fillPct;
  let fillPctScore: number;
  if      (fill < 5)          fillPctScore = 2;
  else if (fill < 20)         fillPctScore = 8 + (fill - 5) * 0.4;
  else if (fill < 40)         fillPctScore = 14 + (fill - 20) * 0.35;
  else if (fill < 65)         fillPctScore = 21 + (fill - 40) * 0.16;
  else if (fill < 85)         fillPctScore = 25 - (fill - 65) * 0.5;
  else                        fillPctScore = 5;

  const bnbPerHour = curve.fillVelocityPerMs * 3_600_000;
  const gradBnb    = toBnb(GRADUATION_THRESHOLD_WEI);
  const hoursToGrad = curve.fillVelocityPerMs > 0
    ? (toBnb(curve.fundsRemaining) / bnbPerHour)
    : Infinity;

  let velocityScore: number;
  if (hoursToGrad === Infinity) velocityScore = 0;
  else if (hoursToGrad < 1)    velocityScore = 25;
  else if (hoursToGrad < 2)    velocityScore = 22;
  else if (hoursToGrad < 4)    velocityScore = 18;
  else if (hoursToGrad < 8)    velocityScore = 12;
  else if (hoursToGrad < 24)   velocityScore = 6;
  else                         velocityScore = 1;

  const ageHours = (now - curve.firstSeenMs) / 3_600_000;
  let ageScore: number;
  if      (ageHours < 1)   ageScore = 15;
  else if (ageHours < 4)   ageScore = 12;
  else if (ageHours < 12)  ageScore = 8;
  else if (ageHours < 24)  ageScore = 4;
  else if (ageHours < 72)  ageScore = 1;
  else                     ageScore = 0;

  const activity = curve.purchaseCount;
  let activityScore: number;
  if      (activity >= 30)  activityScore = 15;
  else if (activity >= 15)  activityScore = 12;
  else if (activity >= 8)   activityScore = 9;
  else if (activity >= 4)   activityScore = 6;
  else if (activity >= 2)   activityScore = 3;
  else                      activityScore = 1;

  let oracleScore = 0;
  if (oracle.sampleSize >= 3) {
    const expectedLifespan = oracle.avgCurveLifespanMs;
    const currentLifespan  = now - curve.firstSeenMs;
    const paceFactor = expectedLifespan > 0
      ? 1 - Math.min(1, currentLifespan / expectedLifespan)
      : 0.5;
    const activityFactor = oracle.avgPurchaseCountAtGrad > 0
      ? Math.min(1, curve.purchaseCount / oracle.avgPurchaseCountAtGrad)
      : 0.5;
    const yieldFactor = Math.min(1, oracle.medianAnnualizedYield / 0.3);

    oracleScore = Math.round(
      (paceFactor * 0.4 + activityFactor * 0.3 + yieldFactor * 0.3) * 20,
    );
  } else {
    oracleScore = 10;
  }

  const hotRank = getHotRank(curve.tokenAddress);
  const hotBonus =
    hotRank === 0  ? 0 :
    hotRank <= 5   ? 5 :
    hotRank <= 10  ? 4 :
    hotRank <= 20  ? 3 :
    hotRank <= 50  ? 2 : 1;

  const rawScore = fillPctScore + velocityScore + ageScore + activityScore + oracleScore + hotBonus;
  const score    = Math.min(100, Math.max(0, Math.round(rawScore)));

  const gradProb = estimateGraduationProbability(curve, hoursToGrad);

  const evMultiple = estimateEVMultiple(curve);

  const msToGrad = hoursToGrad === Infinity ? null : hoursToGrad * 3_600_000;

  const recommended = recommendPositionSize(score, gradProb);

  return {
    tokenAddress:           curve.tokenAddress,
    score,
    graduationProbability:  gradProb,
    expectedValueMultiple:  evMultiple,
    estimatedMsToGraduation: msToGrad,
    recommendedPositionBnb: recommended,
    breakdown: {
      fillPctScore:  Math.round(fillPctScore),
      velocityScore: Math.round(velocityScore),
      ageScore:      Math.round(ageScore),
      activityScore: Math.round(activityScore),
      oracleScore:   Math.round(oracleScore),
      hotBonus:      Math.round(hotBonus),
    },
    scoredAtMs: now,
  };
}

function estimateGraduationProbability(curve: CurveState, hoursToGrad: number): number {
  let base: number;
  if      (curve.fillPct >= 95)  base = 0.97;
  else if (curve.fillPct >= 80)  base = 0.85;
  else if (curve.fillPct >= 60)  base = 0.65;
  else if (curve.fillPct >= 40)  base = 0.45;
  else if (curve.fillPct >= 20)  base = 0.25;
  else if (curve.fillPct >= 5)   base = 0.12;
  else                           base = 0.04;

  if (hoursToGrad < 6 && hoursToGrad !== Infinity) {
    const velBoost = Math.max(0, (6 - hoursToGrad) / 6) * 0.2;
    base = Math.min(0.98, base + velBoost);
  }

  const ageHours = (Date.now() - curve.firstSeenMs) / 3_600_000;
  if (ageHours > 48 && curve.fillPct < 30) {
    base *= 0.3;
  }

  return Math.min(0.98, Math.max(0.01, base));
}

function estimateEVMultiple(curve: CurveState): number {
  if (curve.lastPrice === 0n || curve.initialFunds === 0n) return 1;

  const totalSupply      = curve.initialOffers;
  const pancakeTokens    = (totalSupply * 20n) / 100n;
  const pancakeBnb       = curve.initialFunds;
  const pancakePrice     = pancakeBnb > 0n && pancakeTokens > 0n
    ? pancakeBnb / pancakeTokens
    : curve.lastPrice;

  if (curve.lastPrice === 0n) return 1;

  const multiple = Number(pancakePrice) / Number(curve.lastPrice);
  return Math.max(1, Math.min(20, multiple));
}

function recommendPositionSize(score: number, gradProb: number): number {
  if (score < MIN_CURVE_SCORE || gradProb < MIN_GRADUATION_PROB) return 0;

  const conviction = (score / 100) * gradProb;
  const base       = MAX_POSITION_BNB * conviction;

  return Math.round(base * 1000) / 1000;
}

export function getTopOpportunities(limit = 10): ReturnType<typeof getRankedCurves> {
  return getRankedCurves()
    .filter(({ score }) => score.score >= MIN_CURVE_SCORE && score.graduationProbability >= MIN_GRADUATION_PROB)
    .slice(0, limit);
}
