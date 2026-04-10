'use client';
import Link from 'next/link';
import type { LPYield, MetaMap } from '@/types';

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function formatBnb(wei: string) {
  const v = Number(wei) / 1e18;
  return v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(3);
}

function ApyBar({ apy }: { apy: number }) {
  const pct   = Math.min(apy * 100, 300);
  const width = Math.min((pct / 300) * 100, 100);
  const color = apy > 0.5 ? '#10b981' : apy > 0.2 ? '#f59e0b' : '#3b82f6';

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 rounded-full overflow-hidden" style={{ height: 3, background: '#ffffff08' }}>
        <div
          className="h-full rounded-full"
          style={{ width: `${width}%`, background: color }}
        />
      </div>
      <span className="text-xs font-bold font-mono w-16 text-right" style={{ color }}>
        {(apy * 100).toFixed(1)}%
      </span>
    </div>
  );
}

export default function OraclePanel({ yields, meta }: { yields: LPYield[]; meta: MetaMap }) {
  const sorted = [...yields].sort((a, b) => b.annualizedYield - a.annualizedYield);
  const totalLocked = yields.reduce((s, y) => s + Number(y.lockedBnbWei), 0);
  const avgApy = yields.length
    ? yields.reduce((s, y) => s + y.annualizedYield, 0) / yields.length
    : null;

  return (
    <div className="card">
      <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-hi)' }}>LP Yield Oracle</h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-lo)' }}>
              Burned LP pools · 0.17% fee forever
            </p>
          </div>
          {avgApy !== null && (
            <div className="text-right">
              <div className="text-xs" style={{ color: 'var(--text-lo)' }}>avg APY</div>
              <div className="text-sm font-bold" style={{ color: '#10b981' }}>
                {(avgApy * 100).toFixed(1)}%
              </div>
            </div>
          )}
        </div>

        {totalLocked > 0 && (
          <div
            className="mt-3 grid grid-cols-2 gap-3 p-3 rounded-lg"
            style={{ background: '#ffffff05', border: '1px solid var(--border-dim)' }}
          >
            <div>
              <div className="text-xs" style={{ color: 'var(--text-lo)' }}>Total Locked</div>
              <div className="text-sm font-bold font-mono" style={{ color: '#34d399' }}>
                {formatBnb(String(totalLocked))} BNB
              </div>
            </div>
            <div>
              <div className="text-xs" style={{ color: 'var(--text-lo)' }}>Pools Tracked</div>
              <div className="text-sm font-bold" style={{ color: 'var(--text-hi)' }}>
                {yields.length}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="divide-y" style={{ borderColor: 'var(--border-dim)' }}>
        {sorted.length === 0 && (
          <div className="px-5 py-10 text-center text-sm" style={{ color: 'var(--text-lo)' }}>
            <div className="flex flex-col items-center gap-2">
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="14" cy="14" r="10" />
                <path d="M14 10v4l3 3" strokeLinecap="round" />
              </svg>
              Waiting for first graduation…
            </div>
          </div>
        )}

        {sorted.slice(0, 8).map(y => (
          <div key={y.tokenAddress} className="px-5 py-3 data-row transition-colors">
            <div className="flex items-center justify-between mb-2">
              <Link
                href={`/dashboard/token/${y.tokenAddress}`}
                className="flex flex-col hover:opacity-80 transition-opacity"
              >
                {meta[y.tokenAddress.toLowerCase()]?.symbol && (
                  <span className="text-xs font-semibold" style={{ color: '#e8edf5' }}>
                    {meta[y.tokenAddress.toLowerCase()].symbol}
                  </span>
                )}
                <span className="text-xs font-mono" style={{ color: '#60a5fa' }}>
                  {shortAddr(y.tokenAddress)}
                </span>
              </Link>
              <a
                href={`https://pancakeswap.finance/info/pairs/${y.pairAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-mono hover:text-amber-400 transition-colors"
                style={{ color: 'var(--text-lo)' }}
              >
                pair {shortAddr(y.pairAddress)} ↗
              </a>
            </div>

            <ApyBar apy={y.annualizedYield} />

            <div className="flex items-center justify-between mt-1.5 text-xs" style={{ color: 'var(--text-lo)' }}>
              <span>{formatBnb(y.lockedBnbWei)} BNB locked</span>
              <span>{formatBnb(y.fees24hBnbWei)} BNB / 24h fees</span>
            </div>
          </div>
        ))}
      </div>

      {sorted.length > 8 && (
        <div
          className="px-5 py-3 text-xs text-center"
          style={{ borderTop: '1px solid var(--border-dim)', color: 'var(--text-lo)' }}
        >
          +{sorted.length - 8} more pools
        </div>
      )}
    </div>
  );
}
