import 'dotenv/config';
import { Agent } from '@openserv-labs/sdk';
import { z } from 'zod';

const FOURCAST_API = process.env.FOURCAST_API_URL ?? 'http://localhost:3000';
const OPENSERV_API_KEY = process.env.OPENSERV_API_KEY ?? '';

if (!OPENSERV_API_KEY) {
  console.error('[Agent] OPENSERV_API_KEY not set in .env');
  process.exit(1);
}

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${FOURCAST_API}${path}`, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText })) as { error: string };
    throw new Error(err.error ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

const agent = new Agent({
  apiKey: OPENSERV_API_KEY,
  port:   7380,
  systemPrompt: `You are FourCast Agent — an autonomous DeFi intelligence agent for Four.meme bonding curves on BNB Chain.

You analyze active meme token bonding curves, score them using a multi-factor model, and execute paper or live trades.

Scoring model (0–100):
- Fill %      (25 pts): Sweet spot is 30–75% filled. Too early = uncertainty, too late = no upside.
- Velocity    (25 pts): BNB/hr accumulation rate. <2h to graduation = excellent.
- Age         (15 pts): Fresh curves score higher. Old slow curves = weak demand.
- Activity    (15 pts): Purchase count signals organic vs bot demand.
- Oracle      (20 pts): Historical LP yield data from graduated tokens.
- Hot Bonus   ( 5 pts): Four.meme's own hot rankings as external signal confirmation.

Graduation = bonding curve fills 18 BNB → token auto-listed on PancakeSwap V2 with locked LP.

When analyzing curves, explain your reasoning. When asked to trade, always get a quote first, show the user the estimate, then confirm.`,
});

agent.addCapability({
  name: 'getTopOpportunities',
  description:
    'Fetch the top-scored bonding curves from FourCast. Returns ranked list with score breakdown, ' +
    'graduation probability, EV multiple, and recommended position size.',
  schema: z.object({
    limit: z.number().optional().describe('Number of curves to return (default 10, max 50)'),
  }),
  async run({ args }) {
    const limit = Math.min(args.limit ?? 10, 50);
    const data = await api<unknown[]>(`/curves/top?limit=${limit}`);

    if (!Array.isArray(data) || data.length === 0) {
      return 'No curves meet the minimum score threshold right now. The scorer may still be bootstrapping.';
    }

    const lines = (data as Array<{
      curve: { tokenAddress: string; fillPct: number; purchaseCount: number; fundsAccumulated: string };
      score: {
        score: number;
        graduationProbability: number;
        expectedValueMultiple: number;
        estimatedMsToGraduation: number | null;
        recommendedPositionBnb: number;
        breakdown: { fillPctScore: number; velocityScore: number; ageScore: number; activityScore: number; oracleScore: number; hotBonus: number };
      };
    }>).map((item, i) => {
      const { curve, score } = item;
      const eta = score.estimatedMsToGraduation
        ? `~${(score.estimatedMsToGraduation / 3_600_000).toFixed(1)}h to grad`
        : 'no velocity';
      return (
        `${i + 1}. ${curve.tokenAddress}\n` +
        `   Score: ${score.score}/100 | Grad prob: ${(score.graduationProbability * 100).toFixed(0)}% | EV: ${score.expectedValueMultiple.toFixed(1)}x\n` +
        `   Fill: ${curve.fillPct.toFixed(1)}% | Buys: ${curve.purchaseCount} | ${eta}\n` +
        `   Breakdown → Fill:${score.breakdown.fillPctScore} Vel:${score.breakdown.velocityScore} Age:${score.breakdown.ageScore} Activity:${score.breakdown.activityScore} Oracle:${score.breakdown.oracleScore} Hot:${score.breakdown.hotBonus}\n` +
        `   Recommended size: ${score.recommendedPositionBnb.toFixed(4)} BNB`
      );
    });

    return `Top ${data.length} opportunities:\n\n${lines.join('\n\n')}`;
  },
});

agent.addCapability({
  name: 'analyzeToken',
  description:
    'Deep-analyze a specific bonding curve token. Returns full score breakdown, curve state, ' +
    'oracle data, and an AI interpretation of the opportunity.',
  schema: z.object({
    token: z.string().describe('Token contract address (0x...)'),
  }),
  async run({ args }) {
    const data = await api<{
      curve: { tokenAddress: string; fillPct: number; purchaseCount: number; fundsAccumulated: string; initialFunds: string; fillVelocityPerMs: number; firstSeenMs: number; lastPrice: string };
      score: { score: number; graduationProbability: number; expectedValueMultiple: number; estimatedMsToGraduation: number | null; recommendedPositionBnb: number; breakdown: Record<string, number> } | null;
      meta: { symbol: string; name: string } | null;
      graduated: unknown;
      lpYield: { annualizedYield: number; fees24hBnbWei: string } | null;
    }>(`/curves/${args.token}`);

    const { curve, score, meta, lpYield } = data;
    const symbol = meta?.symbol ?? 'UNKNOWN';
    const bnbIn = (Number(curve.fundsAccumulated) / 1e18).toFixed(3);
    const bnbTotal = (Number(curve.initialFunds) / 1e18).toFixed(3);
    const ageHours = ((Date.now() - curve.firstSeenMs) / 3_600_000).toFixed(1);
    const bnbPerHr = ((curve.fillVelocityPerMs * 3_600_000) / 1e18).toFixed(3);

    let out = `Token: ${symbol} (${args.token})\n`;
    out += `Fill: ${curve.fillPct.toFixed(1)}% (${bnbIn}/${bnbTotal} BNB)\n`;
    out += `Age: ${ageHours}h | Velocity: ${bnbPerHr} BNB/hr | Buys: ${curve.purchaseCount}\n`;

    if (score) {
      out += `\nScore: ${score.score}/100\n`;
      out += `Graduation probability: ${(score.graduationProbability * 100).toFixed(0)}%\n`;
      out += `EV multiple: ${score.expectedValueMultiple.toFixed(1)}x\n`;
      out += `Recommended position: ${score.recommendedPositionBnb.toFixed(4)} BNB\n`;
      out += `\nBreakdown:\n`;
      for (const [k, v] of Object.entries(score.breakdown)) {
        out += `  ${k}: ${v}\n`;
      }
      if (score.estimatedMsToGraduation) {
        out += `ETA to graduation: ~${(score.estimatedMsToGraduation / 3_600_000).toFixed(1)}h\n`;
      }
    }

    if (lpYield) {
      out += `\nLP Oracle (post-graduation):\n`;
      out += `  Annualized yield: ${(lpYield.annualizedYield * 100).toFixed(1)}%\n`;
      out += `  24h fees: ${(Number(lpYield.fees24hBnbWei) / 1e18).toFixed(4)} BNB\n`;
    }

    return out;
  },
});

agent.addCapability({
  name: 'getBuyQuote',
  description:
    'Get an on-chain buy quote from TokenManagerHelper3.tryBuy for a specific token and BNB amount. ' +
    'Always call this before executing a buy to confirm current price.',
  schema: z.object({
    token: z.string().describe('Token contract address'),
    bnb:   z.number().describe('BNB amount to spend'),
  }),
  async run({ args }) {
    const data = await api<{
      estimatedAmount: string;
      estimatedCost:   string;
      estimatedFee:    string;
      totalRequired:   string;
    }>(`/trade/quote/buy?token=${args.token}&bnb=${args.bnb}`);

    const tokens = (Number(data.estimatedAmount) / 1e18);
    const fee    = (Number(data.estimatedFee) / 1e18).toFixed(6);
    const total  = (Number(data.totalRequired) / 1e18).toFixed(6);
    const fmt    = tokens >= 1_000_000 ? `${(tokens / 1_000_000).toFixed(2)}M` : tokens.toFixed(2);

    return (
      `Buy quote for ${args.bnb} BNB of ${args.token}:\n` +
      `  Estimated tokens received: ${fmt}\n` +
      `  Protocol fee: ${fee} BNB\n` +
      `  Total required (msg.value): ${total} BNB`
    );
  },
});

agent.addCapability({
  name: 'openTrade',
  description:
    'Open a position on a bonding curve token. Call getBuyQuote first, show the user the estimate, ' +
    'then call this to execute. In paper trading mode no real transaction is sent.',
  schema: z.object({
    token: z.string().describe('Token contract address to buy'),
    bnb:   z.number().describe('BNB amount to spend'),
  }),
  async run({ args }) {
    const result = await api<{ ok: boolean; message: string }>(`/positions/open/${args.token}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ bnb: args.bnb }),
    });
    return result.message ?? (result.ok ? 'Position opened.' : 'Failed to open position.');
  },
});

agent.addCapability({
  name: 'getSellQuote',
  description: 'Get an on-chain sell quote via TokenManagerHelper3.trySell for a token position.',
  schema: z.object({
    token:  z.string().describe('Token contract address'),
    amount: z.string().describe('Token amount in wei (from position entryTokenAmount)'),
  }),
  async run({ args }) {
    const data = await api<{ estimatedFunds: string; estimatedFee: string }>(
      `/trade/quote/sell?token=${args.token}&amount=${args.amount}`,
    );
    const bnb = (Number(data.estimatedFunds) / 1e18).toFixed(6);
    const fee = (Number(data.estimatedFee) / 1e18).toFixed(6);
    return `Sell quote: ~${bnb} BNB returned, fee ${fee} BNB`;
  },
});

agent.addCapability({
  name: 'closePosition',
  description: 'Close an open position by position ID. Get positions first to find the ID.',
  schema: z.object({
    positionId: z.string().describe('Position ID (UUID) to close'),
  }),
  async run({ args }) {
    const result = await api<{ ok: boolean; message: string }>(`/positions/close/${args.positionId}`, {
      method: 'POST',
    });
    return result.message ?? (result.ok ? 'Position closed.' : 'Failed to close position.');
  },
});

agent.addCapability({
  name: 'getPositions',
  description: 'Get all open and recent closed positions with P&L summary.',
  schema: z.object({
    openOnly: z.boolean().optional().describe('If true, only return open positions'),
  }),
  async run({ args }) {
    const [positions, summary] = await Promise.all([
      api<Array<{
        id: string;
        tokenAddress: string;
        status: string;
        entryBnbWei: string;
        entryTokenAmount: string;
        entryScore: number;
        entryMs: number;
        exitBnbWei: string | null;
      }>>(args.openOnly ? '/positions/open' : '/positions'),
      api<{ totalPositions: number; openPositions: number; realizedPnlBnb: number; winRate: number }>('/positions/summary'),
    ]);

    if (positions.length === 0) return 'No positions.';

    const lines = positions.map(p => {
      const entry = (Number(p.entryBnbWei) / 1e18).toFixed(4);
      const age   = Math.round((Date.now() - p.entryMs) / 60_000);
      const pnl   = p.exitBnbWei
        ? ` | PnL: ${(((Number(p.exitBnbWei) - Number(p.entryBnbWei)) / Number(p.entryBnbWei)) * 100).toFixed(1)}%`
        : '';
      return `• ${p.id.slice(0, 8)}… | ${p.tokenAddress.slice(0, 10)}… | ${p.status} | ${entry} BNB | ${age}m ago${pnl}`;
    });

    return (
      `Positions (${summary.openPositions} open | Win rate: ${(summary.winRate * 100).toFixed(0)}% | Realized PnL: ${summary.realizedPnlBnb.toFixed(4)} BNB):\n\n` +
      lines.join('\n')
    );
  },
});

agent.addCapability({
  name: 'getMarketSummary',
  description:
    'Get a high-level summary of current Four.meme market conditions: total curves, ' +
    'graduation rate, LP oracle stats, and system status.',
  schema: z.object({}),
  async run() {
    const [status, oracle] = await Promise.all([
      api<{ activeCurves: number; graduated: number; openPositions: number; uptime: number; paperTrading: boolean; lastIndexedBlock: string }>('/status'),
      api<{ medianAnnualizedYield: number; avgCurveLifespanMs: number; avgPurchaseCountAtGrad: number; sampleSize: number }>('/oracle/stats'),
    ]);

    const uptimeH = (status.uptime / 3_600_000).toFixed(1);
    const lifespanH = oracle.sampleSize > 0
      ? (oracle.avgCurveLifespanMs / 3_600_000).toFixed(1)
      : 'N/A';

    return (
      `FourCast Market Summary\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `Active curves:      ${status.activeCurves}\n` +
      `Total graduated:    ${status.graduated}\n` +
      `Open positions:     ${status.openPositions}\n` +
      `Last block indexed: #${status.lastIndexedBlock}\n` +
      `Agent uptime:       ${uptimeH}h\n` +
      `Mode:               ${status.paperTrading ? 'PAPER TRADING' : 'LIVE'}\n` +
      `\nLP Oracle (${oracle.sampleSize} graduated samples):\n` +
      `  Median APY:           ${(oracle.medianAnnualizedYield * 100).toFixed(1)}%\n` +
      `  Avg curve lifespan:   ${lifespanH}h\n` +
      `  Avg buys at grad:     ${oracle.avgPurchaseCountAtGrad.toFixed(0)}`
    );
  },
});

agent.start().then(() => {
  console.log('[FourCast Agent] OpenServ agent running on port 7380');
  console.log('[FourCast Agent] Connected to FourCast API at', FOURCAST_API);
}).catch(err => {
  console.error('[FourCast Agent] Failed to start:', err.message);
  process.exit(1);
});
