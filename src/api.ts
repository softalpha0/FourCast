import express, { type Request, type Response } from 'express';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';
import { PORT, PAPER_TRADING } from './config.js';
import { handleAgentChat } from './groq-chat.js';
import {
  getAllCurves,
  getRankedCurves,
  getCurve,
  getScore,
  getAllGraduated,
  getGraduated,
  getLPYield,
  getAllLPYields,
  getOracleStats,
  getAllPositions,
  getOpenPositions,
  getPositionSummary,
  getSystemStats,
  getTokenMetadata,
  getAllTokenMetadata,
  getPurchaseHistory,
} from './store.js';
import { scoreCurve } from './scorer.js';
import { refreshTokenYield } from './oracle.js';
import { openPosition, exitPosition } from './positions.js';
import { quoteBuy, quoteSell } from './fourmeme-api.js';

const app = express();
app.use(express.json());

app.set('json replacer', (_key: string, value: unknown) =>
  typeof value === 'bigint' ? value.toString() : value
);

app.use((_req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (_req.method === 'OPTIONS') { res.sendStatus(204); return; }
  next();
});

app.get('/status', (_req: Request, res: Response) => {
  const stats = getSystemStats();
  res.json({
    ok:               true,
    paperTrading:     PAPER_TRADING,
    uptime:           stats.uptimeMs,
    activeCurves:     stats.activeCurves,
    graduated:        stats.graduatedTotal,
    openPositions:    stats.openPositions,
    lastIndexedBlock: stats.lastIndexedBlock,
  });
});

app.get('/curves', (_req: Request, res: Response) => {
  const curves = getAllCurves().map(curve => ({
    curve,
    score: getScore(curve.tokenAddress) ?? null,
  }));
  curves.sort((a, b) => (b.score?.score ?? -1) - (a.score?.score ?? -1));
  res.json(curves);
});

app.get('/curves/top', (req: Request, res: Response) => {
  const limit = parseInt((req.query.limit as string) ?? '10');
  const top   = getRankedCurves().slice(0, Math.min(limit, 50));
  res.json(top);
});

app.get('/curves/:token/history', (req: Request, res: Response) => {
  const token = String(req.params.token).toLowerCase() as `0x${string}`;
  res.json(getPurchaseHistory(token));
});

app.get('/curves/:token', (req: Request, res: Response) => {
  const token = String(req.params.token).toLowerCase() as `0x${string}`;
  const curve = getCurve(token);
  if (!curve) return res.status(404).json({ error: 'Token not found in active curves' });

  const score     = getScore(token);
  const meta      = getTokenMetadata(token);
  const graduated = getGraduated(token);
  const lpYield   = getLPYield(token);
  res.json({ curve, score: score ?? null, meta: meta ?? null, graduated: graduated ?? null, lpYield: lpYield ?? null });
});

app.get('/tokens', (_req: Request, res: Response) => {
  const all = getAllTokenMetadata();
  const byAddress: Record<string, { symbol: string; name: string; decimals: number }> = {};
  for (const m of all) {
    byAddress[m.tokenAddress.toLowerCase()] = { symbol: m.symbol, name: m.name, decimals: m.decimals };
  }
  res.json(byAddress);
});

app.get('/graduated', (_req: Request, res: Response) => {
  const graduated = getAllGraduated().map(g => ({
    ...g,
    lpYield: getLPYield(g.tokenAddress) ?? null,
  }));
  graduated.sort((a, b) => b.graduatedAtMs - a.graduatedAtMs);
  res.json(graduated);
});

app.get('/graduated/:token', (req: Request, res: Response) => {
  const token     = String(req.params.token).toLowerCase() as `0x${string}`;
  const graduated = getGraduated(token);
  if (!graduated) return res.status(404).json({ error: 'Token not found in graduated set' });

  const lpYield = getLPYield(token);
  res.json({ ...graduated, lpYield: lpYield ?? null });
});

app.get('/oracle/stats', (_req: Request, res: Response) => {
  res.json(getOracleStats());
});

app.get('/oracle', (_req: Request, res: Response) => {
  const yields = getAllLPYields().sort((a, b) => b.annualizedYield - a.annualizedYield);
  res.json(yields);
});

app.get('/oracle/:token', async (req: Request, res: Response) => {
  const token   = String(req.params.token).toLowerCase() as `0x${string}`;
  const refresh = req.query.refresh === 'true';

  let metrics = getLPYield(token);

  if (!metrics || refresh) {
    const store     = await import('./store.js');
    const graduated = store.getGraduated(token);
    const result    = await refreshTokenYield(token, graduated?.pairAddress);
    if (result) metrics = result;
  }

  if (!metrics) return res.status(404).json({ error: 'No oracle data for this token' });
  res.json(metrics);
});

app.get('/positions', (_req: Request, res: Response) => {
  res.json(getAllPositions());
});

app.get('/positions/open', (_req: Request, res: Response) => {
  res.json(getOpenPositions());
});

app.get('/positions/summary', (_req: Request, res: Response) => {
  res.json(getPositionSummary());
});

app.post('/positions/open/:token', async (req: Request, res: Response) => {
  const token = String(req.params.token).toLowerCase() as `0x${string}`;
  const curve = getCurve(token);
  if (!curve) return res.status(404).json({ error: 'Token not in active curves' });

  const score = getScore(token) ?? scoreCurve(curve);
  const body  = req.body as { bnb?: number };
  const overrideBnbWei = body.bnb ? BigInt(Math.round(body.bnb * 1e18)) : undefined;

  try {
    await openPosition(token, score, overrideBnbWei);
    res.json({ ok: true, message: `Position opened for ${token}` });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post('/positions/close/:posId', async (req: Request, res: Response) => {
  const posId = String(req.params.posId);
  const { getPosition } = await import('./store.js');
  const pos = getPosition(posId);

  if (!pos) return res.status(404).json({ error: 'Position not found' });
  if (!pos.status.startsWith('open')) return res.status(400).json({ error: 'Position is not open' });

  await exitPosition(posId, 'manual');
  res.json({ ok: true, message: `Exit initiated for position ${posId}` });
});

app.get('/trade/quote/buy', async (req: Request, res: Response) => {
  const token = String(req.query.token ?? '').toLowerCase() as `0x${string}`;
  const bnb   = parseFloat(String(req.query.bnb ?? '0'));

  if (!token || bnb <= 0) return res.status(400).json({ error: 'token and bnb are required' });

  const bnbWei = BigInt(Math.round(bnb * 1e18));
  const quote  = await quoteBuy(token, bnbWei);

  if (!quote) return res.status(502).json({ error: 'Quote unavailable — curve may be inactive' });
  res.json(quote);
});

app.get('/trade/quote/sell', async (req: Request, res: Response) => {
  const token  = String(req.query.token ?? '').toLowerCase() as `0x${string}`;
  const amount = String(req.query.amount ?? '0');

  if (!token || amount === '0') return res.status(400).json({ error: 'token and amount are required' });

  const amountWei = BigInt(amount);
  const quote     = await quoteSell(token, amountWei);

  if (!quote) return res.status(502).json({ error: 'Sell quote unavailable' });
  res.json(quote);
});

app.post('/agent/chat', handleAgentChat);

app.post('/agent/tool/:toolName', async (req: Request, res: Response) => {
  const AGENT_PORT = process.env.AGENT_PORT ?? '7380';
  const AUTH_TOKEN = process.env.OPENSERV_AUTH_TOKEN ?? '';
  const { toolName } = req.params;
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (AUTH_TOKEN) {
      const tokenHash = await bcrypt.hash(AUTH_TOKEN, 10);
      headers['x-openserv-auth-token'] = tokenHash;
    }
    const body = { action: { type: 'do-task' }, args: req.body ?? {} };
    const r = await fetch(`http://localhost:${AGENT_PORT}/tools/${toolName}`, {
      method: 'POST',
      headers,
      body:   JSON.stringify(body),
    });
    const data = await r.json() as { result?: string };
    res.status(r.status).json({ result: data.result ?? JSON.stringify(data) });
  } catch (err) {
    res.status(502).json({ error: `Agent unreachable: ${(err as Error).message}` });
  }
});

export function startApiServer(): void {
  const server = app.listen(PORT, () => {
    console.log(`[API] FourCast API running on http://localhost:${PORT}`);
    console.log(`[API] Paper trading: ${PAPER_TRADING}`);
  });
  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`[API] Port ${PORT} already in use — is the full server (npm run dev) already running?`);
    } else {
      console.error('[API] Server error:', err.message);
    }
    process.exit(1);
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  startApiServer();
}
