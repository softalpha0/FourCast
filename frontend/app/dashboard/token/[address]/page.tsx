'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

type CurveDetail = {
  curve: {
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
  } | null;
  score: {
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
  } | null;
  meta: { symbol: string; name: string; decimals: number } | null;
  graduated: {
    pairAddress: string;
    wbnbReserve: string;
    tokenReserve: string;
    graduatedAtMs: number;
    finalFillPct: number;
    finalPurchaseCount: number;
    curveLifespanMs: number;
  } | null;
  lpYield: {
    lockedBnbWei: string;
    volume24hBnbWei: string;
    fees24hBnbWei: string;
    annualizedYield: number;
  } | null;
};

type HistoryEntry = {
  buyer: string;
  costWei: string;
  amountTokens: string;
  txHash: string;
  blockNumber: string;
  timestampMs: number;
};

function bnb(wei: string | undefined | null, dp = 4) {
  if (!wei) return '—';
  return (Number(wei) / 1e18).toFixed(dp);
}

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function timeAgo(ms: number) {
  const d = Date.now() - ms;
  if (d < 60_000) return `${Math.round(d / 1000)}s ago`;
  if (d < 3_600_000) return `${Math.round(d / 60_000)}m ago`;
  if (d < 86_400_000) return `${Math.round(d / 3_600_000)}h ago`;
  return `${Math.round(d / 86_400_000)}d ago`;
}

function ScoreBar({ label, value, max = 25, color = '#f59e0b' }: { label: string; value: number; max?: number; color?: string }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs w-20 shrink-0" style={{ color: 'var(--text-mid)' }}>{label}</span>
      <div className="flex-1 rounded-full overflow-hidden" style={{ height: 6, background: '#ffffff08' }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-xs font-bold font-mono w-8 text-right" style={{ color }}>{value.toFixed(0)}</span>
      <span className="text-xs w-8" style={{ color: 'var(--text-lo)' }}>/{max}</span>
    </div>
  );
}

export default function TokenDetailPage() {
  const { address } = useParams<{ address: string }>();
  const [detail,  setDetail]  = useState<CurveDetail | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!address) return;
    const load = async () => {
      setLoading(true);
      try {
        const [d, h] = await Promise.all([
          fetch(`${API}/curves/${address}`).then(r => r.json()),
          fetch(`${API}/curves/${address}/history`).then(r => r.json()),
        ]);
        setDetail(d.error ? null : d);
        setHistory(Array.isArray(h) ? h.slice().reverse() : []);
      } catch {
        setDetail(null);
      }
      setLoading(false);
    };
    load();
    const id = setInterval(load, 15_000);
    return () => clearInterval(id);
  }, [address]);

  const { curve, score, meta, graduated, lpYield } = detail ?? {};
  const symbol = meta?.symbol ?? shortAddr(address ?? '');
  const fillPct = Math.max(0, Math.min(100, curve?.fillPct ?? 0));

  return (
    <div className="min-h-screen px-4 md:px-8 py-6 max-w-5xl mx-auto" style={{ color: 'var(--text-hi)' }}>

      <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm mb-6 hover:text-amber-400 transition-colors"
        style={{ color: 'var(--text-lo)' }}>
        ← Dashboard
      </Link>

      {loading && !detail && (
        <div className="text-center py-24" style={{ color: 'var(--text-lo)' }}>Loading…</div>
      )}

      {!loading && !detail && (
        <div className="text-center py-24" style={{ color: 'var(--text-lo)' }}>
          Token not found in active curves.
        </div>
      )}

      {detail && (
        <div className="flex flex-col gap-6">

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold">{symbol}</h1>
                {meta?.name && meta.name !== symbol && (
                  <span className="text-sm" style={{ color: 'var(--text-lo)' }}>{meta.name}</span>
                )}
                {curve?.graduated && (
                  <span className="text-xs px-2 py-0.5 rounded font-bold"
                    style={{ background: '#10b98115', color: '#10b981', border: '1px solid #10b98130' }}>
                    GRADUATED
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-xs font-mono" style={{ color: 'var(--text-lo)' }}>{address}</span>
                <a href={`https://bscscan.com/token/${address}`} target="_blank" rel="noopener noreferrer"
                  className="text-xs hover:text-amber-400 transition-colors" style={{ color: 'var(--text-lo)' }}>
                  BscScan ↗
                </a>
                <a href={`https://four.meme/token/${address}`} target="_blank" rel="noopener noreferrer"
                  className="text-xs hover:text-amber-400 transition-colors" style={{ color: 'var(--text-lo)' }}>
                  Four.meme ↗
                </a>
              </div>
            </div>
            {score && (
              <div className="text-right">
                <div className="text-4xl font-bold" style={{
                  color: score.score >= 75 ? '#10b981' : score.score >= 55 ? '#f59e0b' : '#60a5fa'
                }}>
                  {score.score}
                </div>
                <div className="text-xs" style={{ color: 'var(--text-lo)' }}>composite score</div>
              </div>
            )}
          </div>

          <div className="grid md:grid-cols-2 gap-5">

            <div className="card p-5">
              <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-hi)' }}>Bonding Curve</h2>
              {curve ? (
                <div className="flex flex-col gap-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs" style={{ color: 'var(--text-lo)' }}>Fill Progress</span>
                      <span className="text-sm font-bold font-mono"
                        style={{ color: fillPct > 80 ? '#10b981' : fillPct > 40 ? '#f59e0b' : '#60a5fa' }}>
                        {fillPct.toFixed(1)}%
                      </span>
                    </div>
                    <div className="rounded-full overflow-hidden" style={{ height: 8, background: '#ffffff08' }}>
                      <div className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.max(2, fillPct)}%`,
                          background: fillPct > 80
                            ? 'linear-gradient(90deg,#10b981,#34d399)'
                            : fillPct > 40
                            ? 'linear-gradient(90deg,#f59e0b,#fbbf24)'
                            : 'linear-gradient(90deg,#3b82f6,#60a5fa)',
                        }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    {[
                      { label: 'BNB Accumulated', value: `${bnb(curve.fundsAccumulated, 4)} BNB` },
                      { label: 'Capacity',         value: `${bnb(curve.initialFunds, 2)} BNB` },
                      { label: 'Purchases',         value: String(curve.purchaseCount) },
                      { label: 'Last Price',        value: `${bnb(curve.lastPrice, 8)} BNB` },
                      { label: 'First Seen',        value: timeAgo(curve.firstSeenMs) },
                      { label: 'Last Activity',     value: timeAgo(curve.lastActivityMs) },
                    ].map(({ label, value }) => (
                      <div key={label} className="p-3 rounded-lg"
                        style={{ background: '#ffffff05', border: '1px solid var(--border-dim)' }}>
                        <div style={{ color: 'var(--text-lo)' }}>{label}</div>
                        <div className="font-mono font-semibold mt-0.5" style={{ color: 'var(--text-hi)' }}>{value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : graduated ? (
                <div className="text-sm" style={{ color: 'var(--text-lo)' }}>
                  Token has graduated — curve closed.
                </div>
              ) : (
                <div className="text-sm" style={{ color: 'var(--text-lo)' }}>No curve data.</div>
              )}
            </div>

            <div className="card p-5">
              <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-hi)' }}>Score Breakdown</h2>
              {score ? (
                <div className="flex flex-col gap-5">
                  <div className="flex flex-col gap-3">
                    <ScoreBar label="Fill %"    value={score.breakdown.fillPctScore}   max={25} color="#f59e0b" />
                    <ScoreBar label="Velocity"  value={score.breakdown.velocityScore}  max={25} color="#60a5fa" />
                    <ScoreBar label="Age"        value={score.breakdown.ageScore}       max={15} color="#a78bfa" />
                    <ScoreBar label="Activity"   value={score.breakdown.activityScore}  max={15} color="#34d399" />
                    <ScoreBar label="Oracle"     value={score.breakdown.oracleScore}    max={20} color="#f472b6" />
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs pt-2"
                    style={{ borderTop: '1px solid var(--border-dim)' }}>
                    <div>
                      <span style={{ color: 'var(--text-lo)' }}>Grad Probability</span>
                      <div className="font-bold font-mono mt-0.5" style={{ color: '#10b981' }}>
                        {(score.graduationProbability * 100).toFixed(0)}%
                      </div>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-lo)' }}>EV Multiple</span>
                      <div className="font-bold font-mono mt-0.5" style={{ color: '#f59e0b' }}>
                        {score.expectedValueMultiple.toFixed(2)}×
                      </div>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-lo)' }}>ETA to Grad</span>
                      <div className="font-bold font-mono mt-0.5" style={{ color: 'var(--text-hi)' }}>
                        {score.estimatedMsToGraduation
                          ? `~${Math.round(score.estimatedMsToGraduation / 60_000)}m`
                          : '—'}
                      </div>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-lo)' }}>Rec. Position</span>
                      <div className="font-bold font-mono mt-0.5" style={{ color: 'var(--text-hi)' }}>
                        {score.recommendedPositionBnb.toFixed(4)} BNB
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-sm" style={{ color: 'var(--text-lo)' }}>Score not yet computed.</div>
              )}
            </div>

            {graduated && (
              <div className="card p-5">
                <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-hi)' }}>Graduation Info</h2>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  {[
                    { label: 'Graduated',    value: timeAgo(graduated.graduatedAtMs) },
                    { label: 'Final Fill',   value: `${graduated.finalFillPct.toFixed(1)}%` },
                    { label: 'Final Buys',   value: String(graduated.finalPurchaseCount) },
                    { label: 'Lifespan',     value: `${Math.round(graduated.curveLifespanMs / 60_000)}m` },
                    { label: 'WBNB Locked',  value: `${bnb(graduated.wbnbReserve, 3)} BNB` },
                    { label: 'Pair',         value: shortAddr(graduated.pairAddress) },
                  ].map(({ label, value }) => (
                    <div key={label} className="p-3 rounded-lg"
                      style={{ background: '#ffffff05', border: '1px solid var(--border-dim)' }}>
                      <div style={{ color: 'var(--text-lo)' }}>{label}</div>
                      <div className="font-mono font-semibold mt-0.5" style={{ color: 'var(--text-hi)' }}>{value}</div>
                    </div>
                  ))}
                </div>
                <a href={`https://pancakeswap.finance/info/pairs/${graduated.pairAddress}`}
                  target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 mt-3 text-xs hover:text-amber-400 transition-colors"
                  style={{ color: 'var(--text-lo)' }}>
                  View on PancakeSwap ↗
                </a>
              </div>
            )}

            {lpYield && (
              <div className="card p-5">
                <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-hi)' }}>LP Yield Oracle</h2>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  {[
                    { label: 'APY',          value: `${(lpYield.annualizedYield * 100).toFixed(2)}%`, accent: '#10b981' },
                    { label: 'Locked BNB',   value: `${bnb(lpYield.lockedBnbWei, 3)} BNB` },
                    { label: '24h Volume',   value: `${bnb(lpYield.volume24hBnbWei, 4)} BNB` },
                    { label: '24h Fees',     value: `${bnb(lpYield.fees24hBnbWei, 6)} BNB` },
                  ].map(({ label, value, accent }) => (
                    <div key={label} className="p-3 rounded-lg"
                      style={{ background: '#ffffff05', border: '1px solid var(--border-dim)' }}>
                      <div style={{ color: 'var(--text-lo)' }}>{label}</div>
                      <div className="font-mono font-semibold mt-0.5" style={{ color: accent ?? 'var(--text-hi)' }}>{value}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="card">
            <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)' }}>
              <div>
                <h2 className="text-sm font-semibold" style={{ color: 'var(--text-hi)' }}>Purchase History</h2>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-lo)' }}>
                  Last {history.length} buys recorded (max 200)
                </p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-dim)' }}>
                    {['Time', 'Buyer', 'BNB Spent', 'Block', 'Tx'].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left font-medium"
                        style={{ color: 'var(--text-lo)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {history.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center" style={{ color: 'var(--text-lo)' }}>
                        No purchase history recorded yet.
                      </td>
                    </tr>
                  )}
                  {history.map((h, i) => (
                    <tr key={i} className="data-row" style={{ borderBottom: '1px solid var(--border-dim)' }}>
                      <td className="px-4 py-2.5" style={{ color: 'var(--text-lo)' }}>{timeAgo(h.timestampMs)}</td>
                      <td className="px-4 py-2.5">
                        <a href={`https://bscscan.com/address/${h.buyer}`} target="_blank" rel="noopener noreferrer"
                          className="font-mono hover:text-amber-400 transition-colors" style={{ color: '#60a5fa' }}>
                          {shortAddr(h.buyer)}
                        </a>
                      </td>
                      <td className="px-4 py-2.5 font-mono" style={{ color: '#f59e0b' }}>
                        {bnb(h.costWei, 5)} BNB
                      </td>
                      <td className="px-4 py-2.5 font-mono" style={{ color: 'var(--text-lo)' }}>
                        {h.blockNumber}
                      </td>
                      <td className="px-4 py-2.5">
                        <a href={`https://bscscan.com/tx/${h.txHash}`} target="_blank" rel="noopener noreferrer"
                          className="font-mono hover:text-amber-400 transition-colors" style={{ color: 'var(--text-lo)' }}>
                          {shortAddr(h.txHash)}
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
