import {
  type Address,
  type Hash,
  parseEther,
  encodeFunctionData,
} from 'viem';
import {
  publicClient,
  walletClient,
  bsc,
  formatBnb,
  nowMs,
} from './chain.js';
import {
  FOURMEME_PROXY,
  FOURMEME_ABI,
  PANCAKE_ROUTER_V2,
  PANCAKE_ROUTER_ABI,
  PANCAKE_PAIR_ABI,
  WBNB_ADDRESS,
  PAPER_TRADING,
} from './config.js';

export interface BuyResult {
  txHash:      Hash;
  tokenAmount: bigint;
  price:       bigint;
}

export interface SellResult {
  txHash:      Hash;
  bnbReceived: bigint;
}

const SLIPPAGE_BPS = 200n;

function deadline(): bigint {
  return BigInt(Math.floor(nowMs() / 1000) + 180);
}

export async function buy(
  token:  Address,
  bnbWei: bigint,
): Promise<BuyResult | null> {
  if (PAPER_TRADING || !walletClient) {
    console.log(`[Executor] [PAPER] buy ${formatBnb(bnbWei)} of ${token}`);
    return null;
  }

  try {
    const { result: tokenAmountOut } = await publicClient.simulateContract({
      account:      walletClient.account!,
      address:      FOURMEME_PROXY,
      abi:          FOURMEME_ABI,
      functionName: 'buyTokenAMAP',
      args:         [token, bnbWei, 0n],
      value:        bnbWei,
    }).catch(() => ({ result: null }));

    const minTokens = tokenAmountOut
      ? (tokenAmountOut * (10000n - SLIPPAGE_BPS)) / 10000n
      : 0n;

    const txHash = await walletClient.writeContract({
      chain:        bsc,
      account:      walletClient.account!,
      address:      FOURMEME_PROXY,
      abi:          FOURMEME_ABI,
      functionName: 'buyTokenAMAP',
      args:         [token, bnbWei, minTokens],
      value:        bnbWei,
    });

    console.log(`[Executor] Buy tx: ${txHash}`);
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

    if (receipt.status !== 'success') {
      console.error(`[Executor] Buy tx reverted: ${txHash}`);
      return null;
    }

    const tokenBalance = await getTokenBalance(token);
    const price        = tokenBalance > 0n ? (bnbWei * 10n ** 18n) / tokenBalance : 0n;

    return { txHash, tokenAmount: tokenBalance, price };
  } catch (err) {
    console.error('[Executor] Buy failed:', (err as Error).message);
    return null;
  }
}

export async function sellOnCurve(
  token:       Address,
  tokenAmount: bigint,
): Promise<SellResult | null> {
  if (PAPER_TRADING || !walletClient) {
    console.log(`[Executor] [PAPER] sellOnCurve ${tokenAmount} of ${token}`);
    return null;
  }

  try {
    await approveToken(token, FOURMEME_PROXY, tokenAmount);

    const minBnb = 0n;

    const txHash = await walletClient.writeContract({
      chain:        bsc,
      account:      walletClient.account!,
      address:      FOURMEME_PROXY,
      abi:          FOURMEME_ABI,
      functionName: 'sellToken',
      args:         [token, tokenAmount],
    });

    console.log(`[Executor] Sell (curve) tx: ${txHash}`);
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

    if (receipt.status !== 'success') return null;

    const bnbReceived = 0n;
    return { txHash, bnbReceived };
  } catch (err) {
    console.error('[Executor] Sell (curve) failed:', (err as Error).message);
    return null;
  }
}

export async function sell(
  token:        Address,
  tokenAmount:  bigint,
  pairAddress?: Address,
): Promise<SellResult | null> {
  if (PAPER_TRADING || !walletClient) {
    console.log(`[Executor] [PAPER] sell ${tokenAmount} of ${token} on PancakeSwap`);
    return null;
  }

  try {
    await approveToken(token, PANCAKE_ROUTER_V2, tokenAmount);

    const amounts = await publicClient.readContract({
      address:      PANCAKE_ROUTER_V2,
      abi:          PANCAKE_ROUTER_ABI,
      functionName: 'getAmountsOut',
      args:         [tokenAmount, [token, WBNB_ADDRESS]],
    }) as bigint[];

    const expectedBnb = amounts[1] ?? 0n;
    const minBnb      = (expectedBnb * (10000n - SLIPPAGE_BPS)) / 10000n;

    const txHash = await walletClient.writeContract({
      chain:        bsc,
      account:      walletClient.account!,
      address:      PANCAKE_ROUTER_V2,
      abi:          PANCAKE_ROUTER_ABI,
      functionName: 'swapExactTokensForETHSupportingFeeOnTransferTokens',
      args:         [tokenAmount, minBnb, [token, WBNB_ADDRESS], walletClient.account!.address, deadline()],
    });

    console.log(`[Executor] Sell (PancakeSwap) tx: ${txHash}`);
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

    if (receipt.status !== 'success') return null;

    return { txHash, bnbReceived: expectedBnb };
  } catch (err) {
    console.error('[Executor] Sell (PancakeSwap) failed:', (err as Error).message);
    return null;
  }
}

export async function getPancakePrice(
  token:       Address,
  pairAddress: Address,
): Promise<bigint | null> {
  try {
    const [reserve0, reserve1] = await publicClient.readContract({
      address:      pairAddress,
      abi:          PANCAKE_PAIR_ABI,
      functionName: 'getReserves',
    }) as [bigint, bigint, number];

    const token0 = await publicClient.readContract({
      address:      pairAddress,
      abi:          PANCAKE_PAIR_ABI,
      functionName: 'token0',
    }) as Address;

    const wbnbIsToken0 = token0.toLowerCase() === WBNB_ADDRESS.toLowerCase();
    const bnbReserve   = wbnbIsToken0 ? reserve0 : reserve1;
    const tokReserve   = wbnbIsToken0 ? reserve1 : reserve0;

    if (tokReserve === 0n) return null;
    return (bnbReserve * 10n ** 18n) / tokReserve;
  } catch {
    return null;
  }
}

const ERC20_BALANCE_ABI = [
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount',  type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

export async function getTokenBalance(token: Address): Promise<bigint> {
  if (!walletClient?.account) return 0n;
  try {
    return await publicClient.readContract({
      address:      token,
      abi:          ERC20_BALANCE_ABI,
      functionName: 'balanceOf',
      args:         [walletClient.account.address],
    }) as bigint;
  } catch {
    return 0n;
  }
}

async function approveToken(
  token:   Address,
  spender: Address,
  amount:  bigint,
): Promise<void> {
  if (!walletClient) return;

  const txHash = await walletClient.writeContract({
    chain:        bsc,
    account:      walletClient.account!,
    address:      token,
    abi:          ERC20_BALANCE_ABI,
    functionName: 'approve',
    args:         [spender, amount],
  });

  await publicClient.waitForTransactionReceipt({ hash: txHash });
}
