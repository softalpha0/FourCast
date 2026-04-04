import type { Address, Hash } from 'viem';

export interface CurveState {
  tokenAddress: Address;
  offersRemaining: bigint;
  initialOffers: bigint;
  fundsRemaining: bigint;
  initialFunds: bigint;
  fundsAccumulated: bigint;
  lastPrice: bigint;
  lastActivityMs: number;
  firstSeenMs: number;
  purchaseCount: number;
  fillVelocityPerMs: number;
  fillPct: number;
  graduated: boolean;
}

export interface PurchaseEvent {
  tokenAddress: Address;
  buyer: Address;
  price: bigint;
  amount: bigint;
  cost: bigint;
  fee: bigint;
  offersAfter: bigint;
  fundsAfter: bigint;
  blockNumber: bigint;
  txHash: Hash;
  timestampMs: number;
}

export interface GraduatedToken {
  tokenAddress: Address;
  pairAddress: Address;
  wbnbReserve: bigint;
  tokenReserve: bigint;
  graduatedAtMs: number;
  graduationBlock: bigint;
  finalFillPct: number;
  finalPurchaseCount: number;
  curveLifespanMs: number;
}

export interface LPYieldMetrics {
  tokenAddress: Address;
  pairAddress: Address;
  lockedBnbWei: bigint;
  totalLPSupply: bigint;
  volume24hBnbWei: bigint;
  volume7dBnbWei: bigint;
  fees24hBnbWei: bigint;
  annualizedYield: number;
  lastRefreshedMs: number;
}

export interface CurveScore {
  tokenAddress: Address;
  score: number;
  graduationProbability: number;
  expectedValueMultiple: number;
  estimatedMsToGraduation: number | null;
  recommendedPositionBnb: number;
  breakdown: {
    fillPctScore:  number;
    velocityScore: number;
    ageScore:      number;
    activityScore: number;
    oracleScore:   number;
    hotBonus:      number;
  };
  scoredAtMs: number;
}

export type PositionStatus =
  | 'open_curve'
  | 'open_pancake'
  | 'closing'
  | 'closed_profit'
  | 'closed_loss'
  | 'closed_rug';

export interface Position {
  id: string;
  tokenAddress: Address;
  status: PositionStatus;
  entryBnbWei: bigint;
  entryTokenAmount: bigint;
  entryPrice: bigint;
  entryTxHash: Hash | null;
  entryMs: number;
  entryScore: number;
  entryCurveFillPct: number;
  exitBnbWei: bigint | null;
  exitTxHash: Hash | null;
  exitMs: number | null;
  graduated: boolean;
  pairAddress: Address | null;
}

export interface PositionSummary {
  totalPositions: number;
  openPositions: number;
  totalBnbDeployed: number;
  totalBnbReturned: number;
  realizedPnlBnb: number;
  winRate: number;
}

export interface TokenMetadata {
  tokenAddress: Address;
  symbol: string;
  name: string;
  decimals: number;
}

export interface PurchaseHistoryEntry {
  buyer: Address;
  costWei: string;
  amountTokens: string;
  txHash: string;
  blockNumber: string;
  timestampMs: number;
}

export interface CurveWithScore {
  curve: CurveState;
  score: CurveScore;
}

export interface FourcastStatus {
  uptime: number;
  paperTrading: boolean;
  activeCurves: number;
  graduatedTokens: number;
  openPositions: number;
  lastIndexedBlock: string;
}
