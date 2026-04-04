'use client';
import { useState } from 'react';
import Link from 'next/link';
import type { CurveWithScore, MetaMap } from '@/app/dashboard/page';
import { BuyModal } from './TradeModal';

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function formatBnb(wei: string) {
  return (Number(wei) / 1e18).toFixed(3);
}

function timeAgo(ms: number) {
  const diff = Date.now() - ms;
  if (diff < 60_000)   return `${Math.round(diff / 1000)}s`;
  if (diff < 3600_000) return `${Math.round(diff / 60_000)}m`;
  return `${Math.round(diff / 3600_000)}h`;
}

function etaLabel(msToGrad: number | null) {
  if (msToGrad === null || msToGrad <= 0) return '—';
  const h = Math.floor(msToGrad / 3600_000);
  const m = Math.floor((msToGrad % 3600_000) / 60_000);
  if (h > 0) return `~${h}h ${m}m`;
  return `~${m}m`;
}

function ScorePill({ score }: { score: number }) {
  const [bg, border, text] =
    score >= 75 ? ['#10b98118', '#10b98140', '#10b981'] :
    score >= 60 ? ['#f59e0b18', '#f59e0b40', '#f59e0b'] :
    score >= 45 ? ['#3b82f618', '#3b82f640', '#3b82f6'] :
                  ['#ffffff08', '#ffffff15', '#64748b'];

  return (
    <span
      className="inline-flex items-center justify-center text-xs font-bold rounded-md px-2 py-0.5 font-mono"
      style={{ background: bg, border: `1px solid ${border}`, color: text, minWidth: 36 }}
    >
      {score}
    </span>
  );
}

function FillBar({ pct: rawPct }: { pct: number }) {
  const pct    = Math.max(0, Math.min(100, rawPct));
  const isHot  = pct > 80;
  const isMid  = pct > 40;
  const barColor = isHot ? '#10b981' : isMid ? '#f59e0b' : '#3b82f6';

  return (
    <div className="flex items-center gap-2 min-w-[100px]">
      <div className="flex-1 rounded-full overflow-hidden" style={{ height: 4, background: '#ffffff0a' }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width:      `${Math.max(2, pct)}%`,
            background: isHot
              ? 'linear-gradient(90deg, #10b981, #34d399)'
              : isMid
              ? 'linear-gradient(90deg, #f59e0b, #fbbf24)'
              : 'linear-gradient(90deg, #3b82f6, #60a5fa)',
          }}
        />
      </div>
      <span className="text-xs tabular-nums w-10 text-right" style={{ color: barColor, fontWeight: 600 }}>
        {rawPct < 0 ? '—' : `${pct.toFixed(1)}%`}
      </span>
    </div>
  );
}

function VelocityDot({ velocityPerMs }: { velocityPerMs: number }) {
  const bnbPerHr = (velocityPerMs * 3_600_000) / 1e18;
  const display  = bnbPerHr > 100 || bnbPerHr <= 0 ? null : bnbPerHr;
  const isHot = display !== null && display > 0.5;
  const isMed = display !== null && display > 0.1;

  return (
    <div className="flex items-center gap-1.5">
      <div
        className="rounded-full shrink-0"
        style={{
          width:  6,
          height: 6,
          background: isHot ? '#10b981' : isMed ? '#f59e0b' : '#3d5070',
        }}
      />
      <span className="text-xs font-mono" style={{ color: 'var(--text-mid)' }}>
        {display === null ? '—' : `${display.toFixed(2)}/h`}
      </span>
    </div>
  );
}

export default function CurvesTable({
  curves,
  meta,
  onTrade,
}: {
  curves: CurveWithScore[];
  meta: MetaMap;
  onTrade?: () => void;
}) {
  const [buyTarget, setBuyTarget] = useState<{ token: string; symbol?: string; recommended: number } | null>(null);
  const sorted = [...curves].sort((a, b) => (b.score?.score ?? 0) - (a.score?.score ?? 0));

  return (
    <div className="card flex flex-col" style={{ minHeight: 400 }}>
      <div
        className="flex items-center justify-between px-5 py-4"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-3">
          <div>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-hi)' }}>
              Active Bonding Curves
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-lo)' }}>
              Capital router · ranked by composite score
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono px-2 py-1 rounded-md"
            style={{ background: '#ffffff08', color: 'var(--text-mid)', border: '1px solid var(--border)' }}>
            {sorted.length} curves
          </span>
        </div>
      </div>

      <div className="overflow-x-auto flex-1">
        <table className="w-full text-xs" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-dim)' }}>
              {['Token', 'Fill', 'Score', 'Grad %', 'EV', 'ETA', 'BNB/min', 'BNB In', 'Buys', 'Age', ''].map(h => (
                <th
                  key={h}
                  className={`px-4 py-2.5 text-left font-medium uppercase tracking-wider ${h !== 'Token' && h !== 'Fill' && h !== '' ? 'text-right' : ''}`}
                  style={{ color: 'var(--text-lo)', fontSize: 10 }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr>
                <td colSpan={11} className="px-4 py-16 text-center text-sm" style={{ color: 'var(--text-lo)' }}>
                  <div className="flex flex-col items-center gap-2">
                    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <circle cx="16" cy="16" r="12" />
                      <path d="M12 16h8M16 12v8" strokeLinecap="round" />
                    </svg>
                    <span>Bootstrapping — scanning recent blocks…</span>
                  </div>
                </td>
              </tr>
            )}
            {sorted.map(({ curve, score }, i) => {
              const isTop = i < 3 && (score?.score ?? 0) >= 70;
              return (
                <tr
                  key={curve.tokenAddress}
                  className="data-row transition-colors"
                  style={{ borderBottom: '1px solid var(--border-dim)' }}
                >
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      {isTop && (
                        <div
                          className="text-xs font-bold rounded px-1"
                          style={{ background: '#f59e0b15', color: '#f59e0b', border: '1px solid #f59e0b30' }}
                        >
                          #{i + 1}
                        </div>
                      )}
                      <Link
                        href={`/dashboard/token/${curve.tokenAddress}`}
                        className="flex flex-col hover:opacity-80 transition-opacity"
                      >
                        {meta[curve.tokenAddress.toLowerCase()]?.symbol
                          ? <span className="font-semibold text-xs" style={{ color: '#e8edf5' }}>
                              {meta[curve.tokenAddress.toLowerCase()].symbol}
                            </span>
                          : null}
                        <span className="font-mono text-xs" style={{ color: '#60a5fa' }}>
                          {shortAddr(curve.tokenAddress)}
                        </span>
                      </Link>
                      {curve.graduated && (
                        <span
                          className="text-xs px-1.5 py-0.5 rounded font-medium"
                          style={{ background: '#10b98115', color: '#10b981', border: '1px solid #10b98130' }}
                        >
                          GRAD
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 min-w-[140px]">
                    <FillBar pct={curve.fillPct} />
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {score ? <ScorePill score={score.score} /> : <span style={{ color: 'var(--text-lo)' }}>—</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono" style={{ color: 'var(--text-mid)' }}>
                    {score ? `${(score.graduationProbability * 100).toFixed(0)}%` : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono font-semibold"
                    style={{ color: score && score.expectedValueMultiple >= 1.5 ? '#10b981' : 'var(--text-mid)' }}>
                    {score ? `${score.expectedValueMultiple.toFixed(1)}×` : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right" style={{ color: 'var(--text-lo)' }}>
                    {score ? etaLabel(score.estimatedMsToGraduation) : '—'}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex justify-end">
                      <VelocityDot velocityPerMs={curve.fillVelocityPerMs} />
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono" style={{ color: 'var(--text-mid)' }}>
                    {formatBnb(curve.fundsAccumulated)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono" style={{ color: 'var(--text-mid)' }}>
                    {curve.purchaseCount}
                  </td>
                  <td className="px-4 py-2.5 text-right" style={{ color: 'var(--text-lo)' }}>
                    {timeAgo(curve.firstSeenMs)}
                  </td>
                  <td className="px-4 py-2.5">
                    <button
                      onClick={() => setBuyTarget({
                        token:       curve.tokenAddress,
                        symbol:      meta[curve.tokenAddress.toLowerCase()]?.symbol,
                        recommended: score?.recommendedPositionBnb ?? 0.05,
                      })}
                      className="px-2.5 py-1 rounded-md text-xs font-bold transition-all hover:opacity-80"
                      style={{
                        background: '#f59e0b18',
                        border:     '1px solid #f59e0b35',
                        color:      '#f59e0b',
                        cursor:     'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Buy
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div
        className="px-5 py-3 flex flex-wrap gap-4 text-xs"
        style={{ borderTop: '1px solid var(--border-dim)', color: 'var(--text-lo)' }}
      >
        <span>Score = Fill(25) + Velocity(25) + Age(15) + Activity(15) + Oracle(20) + Hot(5)</span>
        <span className="ml-auto">Updates every 5s</span>
      </div>

      {buyTarget && (
        <BuyModal
          token={buyTarget.token}
          symbol={buyTarget.symbol}
          recommendedBnb={buyTarget.recommended}
          onClose={() => setBuyTarget(null)}
          onDone={() => { setBuyTarget(null); onTrade?.(); }}
        />
      )}
    </div>
  );
}
