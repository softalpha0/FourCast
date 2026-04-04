import {
  createPublicClient,
  createWalletClient,
  http,
  webSocket,
  fallback,
  defineChain,
  type PublicClient,
  type WalletClient,
  type Chain,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { RPC_HTTP, RPC_WS, BSC_CHAIN_ID, PRIVATE_KEY } from './config.js';

const BSC_RPC_FALLBACKS = [
  RPC_HTTP,
  'https://bsc-dataseed.bnbchain.org',
  'https://bsc-dataseed1.bnbchain.org',
  'https://bsc-dataseed2.bnbchain.org',
  'https://rpc.ankr.com/bsc',
  'https://bsc.meowrpc.com',
];

export const bsc: Chain = defineChain({
  id: BSC_CHAIN_ID,
  name: 'BNB Smart Chain',
  nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
  rpcUrls: {
    default: {
      http:      [RPC_HTTP],
      webSocket: [RPC_WS],
    },
  },
  blockExplorers: {
    default: { name: 'BscScan', url: 'https://bscscan.com' },
  },
});

export const publicClient: PublicClient = createPublicClient({
  chain: bsc,
  transport: fallback(
    BSC_RPC_FALLBACKS.map(url => http(url, { timeout: 15_000, retryCount: 2, retryDelay: 500 })),
    { rank: false },
  ),
});

export const wsClient: PublicClient = createPublicClient({
  chain: bsc,
  transport: webSocket(RPC_WS, {
    timeout: 15_000,
    reconnect: {
      attempts: 10,
      delay: 2_000,
    },
  }),
});

export let walletClient: WalletClient | null = null;

if (PRIVATE_KEY) {
  const account = privateKeyToAccount(PRIVATE_KEY);
  walletClient = createWalletClient({
    account,
    chain: bsc,
    transport: fallback(
      BSC_RPC_FALLBACKS.map(url => http(url, { timeout: 20_000, retryCount: 2 })),
      { rank: false },
    ),
  });
  console.log(`[Chain] Wallet loaded: ${account.address}`);
} else {
  console.log('[Chain] No PRIVATE_KEY — running in read-only / paper trading mode.');
}

export async function getLatestBlock(): Promise<bigint> {
  const block = await publicClient.getBlockNumber();
  return block;
}

export function formatBnb(wei: bigint): string {
  const bnb = Number(wei) / 1e18;
  return bnb.toFixed(4) + ' BNB';
}

export function toBnb(wei: bigint): number {
  return Number(wei) / 1e18;
}

export function nowMs(): number {
  return Date.now();
}
