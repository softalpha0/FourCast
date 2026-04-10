export type SystemStatus = {
  ok: boolean;
  paperTrading: boolean;
  uptime: number;
  activeCurves: number;
  graduated: number;
  openPositions: number;
  lastIndexedBlock: string;
};

export type CurveScore = {
  score: number;
  graduationProbability: number;
  expectedValueMultiple: number;
  estimatedMsToGraduation: number | null;
  recommendedPositionBnb: number;
  breakdown: {
    fillPctScore: number;
    velocityScore: number;
    ageScore: number;
    activityScore: number;
    oracleScore: number;
  };
};

export type CurveState = {
  tokenAddress: string;
  fillPct: number;
  fundsAccumulated: string;
  initialFunds: string;
  lastPrice: string;
  purchaseCount: number;
  fillVelocityPerMs: number;
  firstSeenMs: number;
  lastActivityMs: number;
  graduated: boolean;
};

export type CurveWithScore = { curve: CurveState; score: CurveScore | null };

export type Position = {
  id: string;
  tokenAddress: string;
  status: string;
  entryBnbWei: string;
  entryTokenAmount: string;
  entryScore: number;
  entryMs: number;
  exitBnbWei: string | null;
  exitMs: number | null;
  graduated: boolean;
};

export type LPYield = {
  tokenAddress: string;
  pairAddress: string;
  lockedBnbWei: string;
  volume24hBnbWei: string;
  fees24hBnbWei: string;
  annualizedYield: number;
  lastRefreshedMs: number;
};

export type TokenMeta = { symbol: string; name: string; decimals: number };
export type MetaMap   = Record<string, TokenMeta>;
