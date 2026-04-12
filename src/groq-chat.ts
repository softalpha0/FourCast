import { type Request, type Response } from 'express';

const DGRID_API = 'https://api.dgrid.ai/v1/chat/completions';
const DGRID_KEY = process.env.DGRID_API_KEY ?? '';
const GROQ_API = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_KEY = process.env.GROQ_API_KEY ?? '';
const FOURCAST_API = process.env.FOURCAST_API_URL ?? 'http://localhost:3000';

interface GroqMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: GroqToolCall[];
  tool_call_id?: string;
  name?: string;
}

interface GroqToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

interface GroqResponse {
  choices: [{
    message: GroqMessage;
    finish_reason: string;
  }];
}

const SYSTEM_PROMPT = `You are FourCast Agent — an autonomous DeFi intelligence agent for Four.meme bonding curves on BNB Chain.

You analyze active meme token bonding curves, score them, and help users make trading decisions. Use the available tools to fetch real-time data and provide actionable insights.

Scoring model (0–100):
- Fill % (25 pts): Sweet spot 30–75%. Too early = risk, too late = no upside.
- Velocity (25 pts): BNB/hr accumulation. <2h to graduation = excellent.
- Age (15 pts): Fresh curves score higher. Old slow curves = weak demand.
- Activity (15 pts): Purchase count signals organic vs bot demand.
- Oracle (20 pts): Historical LP yield from graduated tokens.
- Hot Bonus (5 pts): Four.meme hot rankings confirmation.

Graduation = bonding curve fills 18 BNB → token auto-lists on PancakeSwap V2 with locked LP.

Be concise. Lead with the most actionable insight. Use tool data — never hallucinate numbers. When analyzing multiple tokens, always call getTopOpportunities first, then drill into specifics.`;

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'getTopOpportunities',
      description: 'Fetch the top-scored bonding curves from FourCast. Returns ranked list with score breakdown, graduation probability, EV multiple, and recommended position size.',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Number of curves to return (default 10, max 50)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'analyzeToken',
      description: 'Deep-analyze a specific bonding curve token. Returns full score breakdown, curve state, oracle data.',
      parameters: {
        type: 'object',
        required: ['token'],
        properties: {
          token: { type: 'string', description: 'Token contract address (0x...)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getMarketSummary',
      description: 'Get a high-level summary of current Four.meme market conditions: total curves, graduation rate, LP oracle stats.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getPositions',
      description: 'Get all open and recent closed positions with P&L summary.',
      parameters: {
        type: 'object',
        properties: {
          openOnly: { type: 'boolean', description: 'If true, only return open positions' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getBuyQuote',
      description: 'Get an on-chain buy quote for a specific token and BNB amount.',
      parameters: {
        type: 'object',
        required: ['token', 'bnb'],
        properties: {
          token: { type: 'string', description: 'Token contract address' },
          bnb:   { type: 'number', description: 'BNB amount to spend' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'openTrade',
      description: 'Open a position on a bonding curve token. Call getBuyQuote first.',
      parameters: {
        type: 'object',
        required: ['token', 'bnb'],
        properties: {
          token: { type: 'string', description: 'Token contract address to buy' },
          bnb:   { type: 'number', description: 'BNB amount to spend' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getSellQuote',
      description: 'Get an on-chain sell quote for a token position.',
      parameters: {
        type: 'object',
        required: ['token', 'amount'],
        properties: {
          token:  { type: 'string', description: 'Token contract address' },
          amount: { type: 'string', description: 'Token amount in wei' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'closePosition',
      description: 'Close an open position by position ID.',
      parameters: {
        type: 'object',
        required: ['positionId'],
        properties: {
          positionId: { type: 'string', description: 'Position ID (UUID)' },
        },
      },
    },
  },
];

async function callFourCastTool(name: string, args: Record<string, unknown>): Promise<string> {
  try {
    switch (name) {
      case 'getTopOpportunities': {
        const limit = Math.min((args.limit as number) ?? 10, 50);
        const data = await fetch(`${FOURCAST_API}/curves/top?limit=${limit}`).then(r => r.json()) as Array<{
          curve: { tokenAddress: string; fillPct: number; purchaseCount: number; fundsAccumulated: string };
          score: { score: number; graduationProbability: number; expectedValueMultiple: number; estimatedMsToGraduation: number | null; recommendedPositionBnb: number; breakdown: Record<string, number> };
        }>;
        if (!Array.isArray(data) || data.length === 0) return 'No curves meet the minimum score threshold right now.';
        const lines = data.map((item, i) => {
          const { curve, score } = item;
          const eta = score.estimatedMsToGraduation
            ? `~${(score.estimatedMsToGraduation / 3_600_000).toFixed(1)}h to grad`
            : 'no velocity';
          return `${i + 1}. ${curve.tokenAddress}\n   Score: ${score.score}/100 | Grad prob: ${(score.graduationProbability * 100).toFixed(0)}% | EV: ${score.expectedValueMultiple.toFixed(1)}x\n   Fill: ${curve.fillPct.toFixed(1)}% | Buys: ${curve.purchaseCount} | ${eta}\n   Recommended: ${score.recommendedPositionBnb.toFixed(4)} BNB`;
        });
        return `Top ${data.length} opportunities:\n\n${lines.join('\n\n')}`;
      }

      case 'analyzeToken': {
        const token = args.token as string;
        const data = await fetch(`${FOURCAST_API}/curves/${token}`).then(r => r.json()) as {
          curve: { tokenAddress: string; fillPct: number; purchaseCount: number; fundsAccumulated: string; initialFunds: string; fillVelocityPerMs: number; firstSeenMs: number };
          score: { score: number; graduationProbability: number; expectedValueMultiple: number; estimatedMsToGraduation: number | null; recommendedPositionBnb: number; breakdown: Record<string, number> } | null;
          meta: { symbol: string; name: string } | null;
          lpYield: { annualizedYield: number; fees24hBnbWei: string } | null;
        };
        const { curve, score, meta, lpYield } = data;
        const symbol = meta?.symbol ?? 'UNKNOWN';
        const bnbIn = (Number(curve.fundsAccumulated) / 1e18).toFixed(3);
        const bnbTotal = (Number(curve.initialFunds) / 1e18).toFixed(3);
        const ageHours = ((Date.now() - curve.firstSeenMs) / 3_600_000).toFixed(1);
        const bnbPerHr = ((curve.fillVelocityPerMs * 3_600_000) / 1e18).toFixed(3);
        let out = `${symbol} (${token})\nFill: ${curve.fillPct.toFixed(1)}% (${bnbIn}/${bnbTotal} BNB)\nAge: ${ageHours}h | Velocity: ${bnbPerHr} BNB/hr | Buys: ${curve.purchaseCount}`;
        if (score) {
          out += `\nScore: ${score.score}/100 | Grad prob: ${(score.graduationProbability * 100).toFixed(0)}% | EV: ${score.expectedValueMultiple.toFixed(1)}x\nRecommended: ${score.recommendedPositionBnb.toFixed(4)} BNB`;
          if (score.estimatedMsToGraduation) out += `\nETA to graduation: ~${(score.estimatedMsToGraduation / 3_600_000).toFixed(1)}h`;
        }
        if (lpYield) out += `\nLP APY: ${(lpYield.annualizedYield * 100).toFixed(1)}% | 24h fees: ${(Number(lpYield.fees24hBnbWei) / 1e18).toFixed(4)} BNB`;
        return out;
      }

      case 'getMarketSummary': {
        const [status, oracle] = await Promise.all([
          fetch(`${FOURCAST_API}/status`).then(r => r.json()) as Promise<{ activeCurves: number; graduated: number; openPositions: number; uptime: number; paperTrading: boolean; lastIndexedBlock: string }>,
          fetch(`${FOURCAST_API}/oracle/stats`).then(r => r.json()) as Promise<{ medianAnnualizedYield: number; avgCurveLifespanMs: number; avgPurchaseCountAtGrad: number; sampleSize: number }>,
        ]);
        const uptimeH = (status.uptime / 3_600_000).toFixed(1);
        const lifespanH = oracle.sampleSize > 0 ? (oracle.avgCurveLifespanMs / 3_600_000).toFixed(1) : 'N/A';
        return `Active curves: ${status.activeCurves} | Graduated: ${status.graduated} | Open positions: ${status.openPositions}\nLast block: #${status.lastIndexedBlock} | Uptime: ${uptimeH}h | Mode: ${status.paperTrading ? 'PAPER' : 'LIVE'}\nLP Oracle (${oracle.sampleSize} samples): Median APY ${(oracle.medianAnnualizedYield * 100).toFixed(1)}% | Avg lifespan ${lifespanH}h`;
      }

      case 'getPositions': {
        const [positions, summary] = await Promise.all([
          fetch(`${FOURCAST_API}${args.openOnly ? '/positions/open' : '/positions'}`).then(r => r.json()) as Promise<Array<{ id: string; tokenAddress: string; status: string; entryBnbWei: string; entryMs: number; exitBnbWei: string | null }>>,
          fetch(`${FOURCAST_API}/positions/summary`).then(r => r.json()) as Promise<{ openPositions: number; winRate: number; realizedPnlBnb: number }>,
        ]);
        if (positions.length === 0) return 'No positions.';
        const lines = positions.map(p => {
          const entry = (Number(p.entryBnbWei) / 1e18).toFixed(4);
          const age = Math.round((Date.now() - p.entryMs) / 60_000);
          const pnl = p.exitBnbWei ? ` | PnL: ${(((Number(p.exitBnbWei) - Number(p.entryBnbWei)) / Number(p.entryBnbWei)) * 100).toFixed(1)}%` : '';
          return `• ${p.id.slice(0, 8)}… ${p.tokenAddress.slice(0, 10)}… | ${p.status} | ${entry} BNB | ${age}m old${pnl}`;
        });
        return `${summary.openPositions} open | Win rate: ${(summary.winRate * 100).toFixed(0)}% | PnL: ${summary.realizedPnlBnb.toFixed(4)} BNB\n${lines.join('\n')}`;
      }

      case 'getBuyQuote': {
        const data = await fetch(`${FOURCAST_API}/trade/quote/buy?token=${args.token}&bnb=${args.bnb}`).then(r => r.json()) as { estimatedAmount: string; estimatedFee: string; totalRequired: string };
        const tokens = Number(data.estimatedAmount) / 1e18;
        const fmt = tokens >= 1_000_000 ? `${(tokens / 1_000_000).toFixed(2)}M` : tokens.toFixed(2);
        return `Buy quote: ${fmt} tokens | Fee: ${(Number(data.estimatedFee) / 1e18).toFixed(6)} BNB | Total: ${(Number(data.totalRequired) / 1e18).toFixed(6)} BNB`;
      }

      case 'openTrade': {
        const result = await fetch(`${FOURCAST_API}/positions/open/${args.token}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bnb: args.bnb }),
        }).then(r => r.json()) as { ok: boolean; message: string };
        return result.message ?? (result.ok ? 'Position opened.' : 'Failed.');
      }

      case 'getSellQuote': {
        const data = await fetch(`${FOURCAST_API}/trade/quote/sell?token=${args.token}&amount=${args.amount}`).then(r => r.json()) as { estimatedFunds: string; estimatedFee: string };
        return `Sell quote: ${(Number(data.estimatedFunds) / 1e18).toFixed(6)} BNB returned | Fee: ${(Number(data.estimatedFee) / 1e18).toFixed(6)} BNB`;
      }

      case 'closePosition': {
        const result = await fetch(`${FOURCAST_API}/positions/close/${args.positionId}`, { method: 'POST' }).then(r => r.json()) as { ok: boolean; message: string };
        return result.message ?? (result.ok ? 'Position closed.' : 'Failed.');
      }

      default:
        return `Unknown tool: ${name}`;
    }
  } catch (err) {
    return `Tool error: ${(err as Error).message}`;
  }
}

export async function handleAgentChat(req: Request, res: Response): Promise<void> {
  const activeKey = DGRID_KEY || GROQ_KEY;
  const activeAPI = DGRID_KEY ? DGRID_API : GROQ_API;
  const activeModel = DGRID_KEY ? 'groq/llama-3.3-70b-versatile' : 'llama-3.3-70b-versatile';

  if (!activeKey) {
    res.status(503).json({ error: 'No AI API key configured' });
    return;
  }

  const body = req.body as { messages?: Array<{ role: string; content: string }> };
  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    res.status(400).json({ error: 'messages array required' });
    return;
  }

  const messages: GroqMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...body.messages.map(m => ({ role: m.role as GroqMessage['role'], content: m.content })),
  ];

  try {
    for (let iteration = 0; iteration < 5; iteration++) {
      let apiRes = await fetch(activeAPI, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${activeKey}` },
        body: JSON.stringify({ model: activeModel, messages, tools: TOOLS, tool_choice: 'auto', max_tokens: 2048 }),
      });

      if (!apiRes.ok && DGRID_KEY && GROQ_KEY) {
        apiRes = await fetch(GROQ_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${GROQ_KEY}` },
          body: JSON.stringify({ model: 'llama-3.3-70b-versatile', messages, tools: TOOLS, tool_choice: 'auto', max_tokens: 2048 }),
        });
      }

      if (!apiRes.ok) {
        const errText = await apiRes.text();
        res.status(502).json({ error: `AI API error: ${errText}` });
        return;
      }

      const data = await apiRes.json() as GroqResponse;
      const msg = data.choices[0].message;

      messages.push(msg);

      if (data.choices[0].finish_reason !== 'tool_calls' || !msg.tool_calls?.length) {
        res.json({ content: msg.content ?? '' });
        return;
      }

      const toolResults = await Promise.all(
        msg.tool_calls.map(async tc => {
          const args = JSON.parse(tc.function.arguments) as Record<string, unknown>;
          const result = await callFourCastTool(tc.function.name, args);
          return {
            role: 'tool' as const,
            tool_call_id: tc.id,
            name: tc.function.name,
            content: result,
          };
        }),
      );

      messages.push(...toolResults);
    }

    res.json({ content: 'Reached iteration limit without a final answer. Please try again.' });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
}
