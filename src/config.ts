import 'dotenv/config';

export const BSC_CHAIN_ID = 56;

export const RPC_HTTP = process.env.BSC_RPC_HTTP ?? 'https://bsc-rpc.publicnode.com';
export const RPC_WS   = process.env.BSC_RPC_WS   ?? 'wss://bsc-rpc.publicnode.com';

export const FOURMEME_PROXY = '0x5c952063c7fc8610FFDB798152D69F0B9550762b' as const;

export const TOKEN_PURCHASE_TOPIC =
  '0x7db52723a3b2cdd6164364b3b766e65e540d7be48ffa89582956d8eaebe62942' as const;

export const GRADUATION_THRESHOLD_WEI = 18n * 10n ** 18n;

export const FOURMEME_ABI = [
  {
    type: 'event',
    name: 'TokenPurchase',
    inputs: [
      { name: 'token',   type: 'address', indexed: false },
      { name: 'account', type: 'address', indexed: false },
      { name: 'price',   type: 'uint256', indexed: false },
      { name: 'amount',  type: 'uint256', indexed: false },
      { name: 'cost',    type: 'uint256', indexed: false },
      { name: 'fee',     type: 'uint256', indexed: false },
      { name: 'offers',  type: 'uint256', indexed: false },
      { name: 'funds',   type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'TokenSale',
    inputs: [
      { name: 'token',   type: 'address', indexed: false },
      { name: 'account', type: 'address', indexed: false },
      { name: 'amount',  type: 'uint256', indexed: false },
      { name: 'funds',   type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'function',
    name: 'buyTokenAMAP',
    stateMutability: 'payable',
    inputs: [
      { name: 'token',     type: 'address' },
      { name: 'funds',     type: 'uint256' },
      { name: 'minAmount', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'sellToken',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'token',  type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
  },
] as const;

export const FOURMEME_HELPER = '0xF251F83e40a78868FcfA3FA4599Dad6494E46034' as const;

export const FOURMEME_HELPER_ABI = [
  {
    type: 'function',
    name: 'getTokenInfo',
    stateMutability: 'view',
    inputs: [{ name: 'token', type: 'address' }],
    outputs: [
      { name: 'version',       type: 'uint256' },
      { name: 'manager',       type: 'address' },
      { name: 'quoteToken',    type: 'address' },
      { name: 'lastPrice',     type: 'uint256' },
      { name: 'tradingFeeRate',type: 'uint256' },
      { name: 'minTradingFee', type: 'uint256' },
      { name: 'launchTime',    type: 'uint256' },
      { name: 'offers',        type: 'uint256' },
      { name: 'maxOffers',     type: 'uint256' },
      { name: 'funds',         type: 'uint256' },
      { name: 'maxFunds',      type: 'uint256' },
      { name: 'liquidityAdded',type: 'bool'    },
    ],
  },
] as const;

export const ERC20_ABI = [
  { type: 'function', name: 'symbol',   inputs: [], outputs: [{ type: 'string' }], stateMutability: 'view' },
  { type: 'function', name: 'name',     inputs: [], outputs: [{ type: 'string' }], stateMutability: 'view' },
  { type: 'function', name: 'decimals', inputs: [], outputs: [{ type: 'uint8'  }], stateMutability: 'view' },
] as const;

export const PANCAKE_FACTORY_V2 = '0xca143ce32fe78f1f7019d7d551a6402fc5350c73' as const;
export const PANCAKE_ROUTER_V2  = '0x10ED43C718714eb63d5aA57B78B54704E256024E' as const;
export const WBNB_ADDRESS       = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c' as const;

export const PANCAKE_FACTORY_ABI = [
  {
    type: 'event',
    name: 'PairCreated',
    inputs: [
      { name: 'token0', type: 'address', indexed: true },
      { name: 'token1', type: 'address', indexed: true },
      { name: 'pair',   type: 'address', indexed: true },
      { name: 'index',  type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'function',
    name: 'getPair',
    stateMutability: 'view',
    inputs: [
      { name: 'tokenA', type: 'address' },
      { name: 'tokenB', type: 'address' },
    ],
    outputs: [{ name: 'pair', type: 'address' }],
  },
] as const;

export const PANCAKE_ROUTER_ABI = [
  {
    type: 'function',
    name: 'swapExactETHForTokens',
    stateMutability: 'payable',
    inputs: [
      { name: 'amountOutMin', type: 'uint256' },
      { name: 'path',         type: 'address[]' },
      { name: 'to',           type: 'address' },
      { name: 'deadline',     type: 'uint256' },
    ],
    outputs: [{ name: 'amounts', type: 'uint256[]' }],
  },
  {
    type: 'function',
    name: 'swapExactTokensForETHSupportingFeeOnTransferTokens',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'amountIn',     type: 'uint256' },
      { name: 'amountOutMin', type: 'uint256' },
      { name: 'path',         type: 'address[]' },
      { name: 'to',           type: 'address' },
      { name: 'deadline',     type: 'uint256' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'getAmountsOut',
    stateMutability: 'view',
    inputs: [
      { name: 'amountIn', type: 'uint256' },
      { name: 'path',     type: 'address[]' },
    ],
    outputs: [{ name: 'amounts', type: 'uint256[]' }],
  },
] as const;

export const PANCAKE_PAIR_ABI = [
  {
    type: 'function',
    name: 'getReserves',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'reserve0',           type: 'uint112' },
      { name: 'reserve1',           type: 'uint112' },
      { name: 'blockTimestampLast', type: 'uint32'  },
    ],
  },
  {
    type: 'function',
    name: 'token0',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    type: 'function',
    name: 'token1',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    type: 'function',
    name: 'totalSupply',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'event',
    name: 'Swap',
    inputs: [
      { name: 'sender',     type: 'address', indexed: true  },
      { name: 'amount0In',  type: 'uint256', indexed: false },
      { name: 'amount1In',  type: 'uint256', indexed: false },
      { name: 'amount0Out', type: 'uint256', indexed: false },
      { name: 'amount1Out', type: 'uint256', indexed: false },
      { name: 'to',         type: 'address', indexed: true  },
    ],
  },
] as const;

export const PAPER_TRADING = process.env.PAPER_TRADING !== 'false';
export const PORT          = Number(process.env.PORT ?? 3000);

export const MAX_POSITION_BNB          = parseFloat(process.env.MAX_POSITION_BNB          ?? '0.05');
export const MAX_OPEN_POSITIONS        = parseInt(process.env.MAX_OPEN_POSITIONS           ?? '5');
export const MIN_CURVE_SCORE           = parseInt(process.env.MIN_CURVE_SCORE              ?? '60');
export const MIN_GRADUATION_PROB       = parseFloat(process.env.MIN_GRADUATION_PROBABILITY ?? '0.3');
export const EXIT_ON_GRADUATION        = process.env.EXIT_ON_GRADUATION !== 'false';
export const POST_GRAD_HOLD_MS         = parseInt(process.env.POST_GRAD_HOLD_MINUTES ?? '30') * 60_000;

export const BSCSCAN_API_KEY = process.env.BSCSCAN_API_KEY ?? '';
export const PRIVATE_KEY     = process.env.PRIVATE_KEY as `0x${string}` | undefined;

export const BSC_BLOCK_TIME_MS = 3_000;

export const BOOTSTRAP_BLOCKS = 600n;

export const LP_FEE_RATE = 0.0017;
