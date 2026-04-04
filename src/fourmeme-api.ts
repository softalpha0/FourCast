import type { Address } from 'viem';
import { publicClient } from './chain.js';
import { FOURMEME_HELPER } from './config.js';

const API_BASE = 'https://four.meme/meme-api/v1';
const TIMEOUT_MS = 8_000;

const TRY_BUY_ABI = [
  {
    name: 'tryBuy',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'token',  type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'funds',  type: 'uint256' },
    ],
    outputs: [
      { name: 'tokenManager',    type: 'address' },
      { name: 'quote',           type: 'address' },
      { name: 'estimatedAmount', type: 'uint256' },
      { name: 'estimatedCost',   type: 'uint256' },
      { name: 'estimatedFee',    type: 'uint256' },
      { name: 'amountMsgValue',  type: 'uint256' },
      { name: 'amountApproval',  type: 'uint256' },
      { name: 'amountFunds',     type: 'uint256' },
    ],
  },
] as const;

const TRY_SELL_ABI = [
  {
    name: 'trySell',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'token',  type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [
      { name: 'tokenManager', type: 'address' },
      { name: 'quote',        type: 'address' },
      { name: 'funds',        type: 'uint256' },
      { name: 'fee',          type: 'uint256' },
    ],
  },
] as const;

export type RankingType =
  | 'HOT' | 'NEW' | 'PROGRESS'
  | 'VOL_DAY_1' | 'VOL_HOUR_4' | 'VOL_HOUR_1' | 'VOL_MIN_30' | 'VOL_MIN_5'
  | 'DEX' | 'CAP' | 'BURN';

export interface FourMemeRankedToken {
  address:  string;
  symbol:   string;
  name:     string;
  progress: number;
  rank:     number;
}

export interface BuyQuote {
  estimatedAmount: bigint;
  estimatedCost:   bigint;
  estimatedFee:    bigint;
  totalRequired:   bigint;
}

export interface SellQuote {
  estimatedFunds: bigint;
  estimatedFee:   bigint;
}

export async function getHotRankings(pageSize = 50): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  try {
    const res = await fetch(`${API_BASE}/public/token/ranking`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body:    JSON.stringify({ type: 'HOT', pageSize }),
      signal:  AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return map;

    const data = (await res.json()) as { data?: { list?: Record<string, unknown>[] } };
    const list = data?.data?.list ?? [];

    for (let i = 0; i < list.length; i++) {
      const item = list[i];
      const addr = (
        (item['address'] ?? item['tokenAddress'] ?? item['contractAddress'] ?? '') as string
      ).toLowerCase();
      if (addr) map.set(addr, i + 1);
    }

    if (map.size > 0) {
      console.log(`[FourMemeAPI] Hot rankings refreshed: ${map.size} tokens`);
    }
  } catch (err) {
    console.warn('[FourMemeAPI] Hot rankings unavailable:', (err as Error).message);
  }
  return map;
}

export async function getRankings(
  type: RankingType,
  pageSize = 20,
): Promise<FourMemeRankedToken[]> {
  try {
    const res = await fetch(`${API_BASE}/public/token/ranking`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body:    JSON.stringify({ type, pageSize }),
      signal:  AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return [];

    const data = (await res.json()) as { data?: { list?: Record<string, unknown>[] } };
    const list = data?.data?.list ?? [];

    return list.map((item, i) => ({
      address:  ((item['address'] ?? item['tokenAddress'] ?? '') as string).toLowerCase(),
      symbol:   (item['symbol'] ?? '') as string,
      name:     (item['name']   ?? '') as string,
      progress: Number(item['progress'] ?? item['fundProgress'] ?? 0),
      rank:     i + 1,
    }));
  } catch {
    return [];
  }
}

export async function quoteBuy(
  token:    Address,
  fundsWei: bigint,
): Promise<BuyQuote | null> {
  try {
    const result = await publicClient.readContract({
      address:      FOURMEME_HELPER,
      abi:          TRY_BUY_ABI,
      functionName: 'tryBuy',
      args:         [token, 0n, fundsWei],
    }) as [string, string, bigint, bigint, bigint, bigint, bigint, bigint];

    const [, , estimatedAmount, estimatedCost, estimatedFee, amountMsgValue] = result;
    return { estimatedAmount, estimatedCost, estimatedFee, totalRequired: amountMsgValue };
  } catch {
    return null;
  }
}

export async function quoteSell(
  token:     Address,
  amountWei: bigint,
): Promise<SellQuote | null> {
  try {
    const result = await publicClient.readContract({
      address:      FOURMEME_HELPER,
      abi:          TRY_SELL_ABI,
      functionName: 'trySell',
      args:         [token, amountWei],
    }) as [string, string, bigint, bigint];

    const [, , funds, fee] = result;
    return { estimatedFunds: funds, estimatedFee: fee };
  } catch {
    return null;
  }
}

export function startHotRankingsRefresh(
  onUpdate: (map: Map<string, number>) => void,
  intervalMs = 60_000,
): () => void {
  let running = true;

  async function loop() {
    while (running) {
      const map = await getHotRankings(50);
      if (map.size > 0) onUpdate(map);
      await new Promise(r => setTimeout(r, intervalMs));
    }
  }

  loop();
  return () => { running = false; };
}
