import type { Address } from 'viem';
import type {
  CurveState,
  GraduatedToken,
  LPYieldMetrics,
  CurveScore,
  Position,
  PositionSummary,
  TokenMetadata,
  PurchaseHistoryEntry,
} from './types.js';
import { toBnb } from './chain.js';

const activeCurves    = new Map<Address, CurveState>();
const graduatedTokens = new Map<Address, GraduatedToken>();
const lpYields        = new Map<Address, LPYieldMetrics>();
const curveScores     = new Map<Address, CurveScore>();
const positions       = new Map<string, Position>();
const tokenMetadata   = new Map<Address, TokenMetadata>();
const purchaseHistory = new Map<Address, PurchaseHistoryEntry[]>();
const hotRankings     = new Map<string, number>();

let lastIndexedBlock = 0n;
let startedAtMs      = Date.now();

export function upsertCurve(state: CurveState): void {
  activeCurves.set(state.tokenAddress.toLowerCase() as Address, state);
}

export function getCurve(token: Address): CurveState | undefined {
  return activeCurves.get(token.toLowerCase() as Address);
}

export function getAllCurves(): CurveState[] {
  return Array.from(activeCurves.values()).filter(c => !c.graduated);
}

export function markGraduated(token: Address): void {
  const curve = activeCurves.get(token.toLowerCase() as Address);
  if (curve) {
    curve.graduated = true;
    upsertCurve(curve);
  }
}

export function removeCurve(token: Address): void {
  activeCurves.delete(token.toLowerCase() as Address);
}

export function upsertGraduated(token: GraduatedToken): void {
  graduatedTokens.set(token.tokenAddress.toLowerCase() as Address, token);
}

export function getGraduated(token: Address): GraduatedToken | undefined {
  return graduatedTokens.get(token.toLowerCase() as Address);
}

export function getAllGraduated(): GraduatedToken[] {
  return Array.from(graduatedTokens.values());
}

export function isKnownFourMemeToken(token: Address): boolean {
  const addr = token.toLowerCase() as Address;
  return activeCurves.has(addr) || graduatedTokens.has(addr);
}

export function upsertLPYield(metrics: LPYieldMetrics): void {
  lpYields.set(metrics.tokenAddress.toLowerCase() as Address, metrics);
}

export function getLPYield(token: Address): LPYieldMetrics | undefined {
  return lpYields.get(token.toLowerCase() as Address);
}

export function getAllLPYields(): LPYieldMetrics[] {
  return Array.from(lpYields.values());
}

export function getOracleStats(): {
  medianAnnualizedYield: number;
  avgCurveLifespanMs: number;
  avgPurchaseCountAtGrad: number;
  sampleSize: number;
} {
  const graduated = getAllGraduated();
  const yields    = getAllLPYields();

  if (!graduated.length) {
    return { medianAnnualizedYield: 0, avgCurveLifespanMs: 0, avgPurchaseCountAtGrad: 0, sampleSize: 0 };
  }

  const lifespans      = graduated.map(g => g.curveLifespanMs).filter(Boolean);
  const purchaseCounts = graduated.map(g => g.finalPurchaseCount).filter(Boolean);
  const annualYields   = yields.map(y => y.annualizedYield).filter(y => y > 0).sort((a, b) => a - b);

  const median = annualYields.length
    ? annualYields[Math.floor(annualYields.length / 2)]
    : 0;

  const avg = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / (arr.length || 1);

  return {
    medianAnnualizedYield: median,
    avgCurveLifespanMs:    avg(lifespans),
    avgPurchaseCountAtGrad: avg(purchaseCounts),
    sampleSize: graduated.length,
  };
}

export function upsertScore(score: CurveScore): void {
  curveScores.set(score.tokenAddress.toLowerCase() as Address, score);
}

export function getScore(token: Address): CurveScore | undefined {
  return curveScores.get(token.toLowerCase() as Address);
}

export function getRankedCurves(): Array<{ curve: CurveState; score: CurveScore }> {
  return getAllCurves()
    .map(curve => ({
      curve,
      score: curveScores.get(curve.tokenAddress.toLowerCase() as Address),
    }))
    .filter((x): x is { curve: CurveState; score: CurveScore } => x.score !== undefined)
    .sort((a, b) => b.score.score - a.score.score);
}

export function upsertPosition(pos: Position): void {
  positions.set(pos.id, pos);
}

export function getPosition(id: string): Position | undefined {
  return positions.get(id);
}

export function getPositionByToken(token: Address): Position | undefined {
  const addr = token.toLowerCase();
  return Array.from(positions.values()).find(
    p => p.tokenAddress.toLowerCase() === addr && (p.status === 'open_curve' || p.status === 'open_pancake'),
  );
}

export function getOpenPositions(): Position[] {
  return Array.from(positions.values()).filter(
    p => p.status === 'open_curve' || p.status === 'open_pancake',
  );
}

export function getAllPositions(): Position[] {
  return Array.from(positions.values()).sort((a, b) => b.entryMs - a.entryMs);
}

export function getPositionSummary(): PositionSummary {
  const all  = getAllPositions();
  const open = getOpenPositions();

  const closed = all.filter(p => p.exitBnbWei !== null);
  const deployed  = all.reduce((s, p) => s + toBnb(p.entryBnbWei), 0);
  const returned  = closed.reduce((s, p) => s + toBnb(p.exitBnbWei ?? 0n), 0);
  const wins      = closed.filter(p => (p.exitBnbWei ?? 0n) > p.entryBnbWei).length;

  return {
    totalPositions:    all.length,
    openPositions:     open.length,
    totalBnbDeployed:  deployed,
    totalBnbReturned:  returned,
    realizedPnlBnb:    returned - deployed + open.reduce((s, p) => s + toBnb(p.entryBnbWei), 0),
    winRate:           closed.length ? wins / closed.length : 0,
  };
}

export function upsertTokenMetadata(meta: TokenMetadata): void {
  tokenMetadata.set(meta.tokenAddress.toLowerCase() as Address, meta);
}

export function getTokenMetadata(token: Address): TokenMetadata | undefined {
  return tokenMetadata.get(token.toLowerCase() as Address);
}

export function getAllTokenMetadata(): TokenMetadata[] {
  return Array.from(tokenMetadata.values());
}

const MAX_HISTORY = 200;

export function appendPurchaseHistory(token: Address, entry: PurchaseHistoryEntry): void {
  const addr = token.toLowerCase() as Address;
  const list = purchaseHistory.get(addr) ?? [];
  list.push(entry);
  if (list.length > MAX_HISTORY) list.shift();
  purchaseHistory.set(addr, list);
}

export function getPurchaseHistory(token: Address): PurchaseHistoryEntry[] {
  return purchaseHistory.get(token.toLowerCase() as Address) ?? [];
}

export function upsertHotRankings(map: Map<string, number>): void {
  hotRankings.clear();
  for (const [addr, rank] of map) hotRankings.set(addr.toLowerCase(), rank);
}

export function getHotRank(token: Address): number {
  return hotRankings.get(token.toLowerCase() as Address) ?? 0;
}

export function getHotRankingsSize(): number {
  return hotRankings.size;
}

export function setLastIndexedBlock(block: bigint): void {
  lastIndexedBlock = block;
}

export function getLastIndexedBlock(): bigint {
  return lastIndexedBlock;
}

export function getSystemStats() {
  return {
    uptimeMs:       Date.now() - startedAtMs,
    activeCurves:   getAllCurves().length,
    graduatedTotal: getAllGraduated().length,
    openPositions:  getOpenPositions().length,
    lastIndexedBlock: lastIndexedBlock.toString(),
  };
}
