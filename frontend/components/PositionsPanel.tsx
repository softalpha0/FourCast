'use client';
import { useState } from 'react';
import Link from 'next/link';
import type { Position, MetaMap } from '@/app/dashboard/page';
import { CloseModal } from './TradeModal';

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function formatBnb(wei: string | null) {
  if (!wei) return '—';
  return `${(Number(wei) / 1e18).toFixed(4)} BNB`;
}

function timeAgo(ms: number) {
  const diff = Date.now() - ms;
  if (diff < 60_000)   return `${Math.round(diff / 1000)}s ago`;
  if (diff < 3600_000) return `${Math.round(diff / 60_000)}m ago`;
  return `${Math.round(diff / 3600_000)}h ago`;
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; border: string; text: string }> = {
  open_curve:    { label: 'ON CURVE',    bg: '#f59e0b12', border: '#f59e0b30', text: '#f59e0b' },
  open_pancake:  { label: 'PANCAKESWAP', bg: '#60a5fa12', border: '#60a5fa30', text: '#60a5fa' },
  closed_profit: { label: 'PROFIT',      bg: '#10b98112', border: '#10b98130', text: '#10b981' },
  closed_loss:   { label: 'LOSS',        bg: '#ef444412', border: '#ef444430', text: '#ef4444' },
  closed_rug:    { label: 'RUGGED',      bg: '#ef444420', border: '#ef444450', text: '#ef4444' },
  closing:       { label: 'CLOSING…',    bg: '#ffffff08', border: '#ffffff15', text: '#64748b' },
};

function StatusChip({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status.toUpperCase(), bg: '#ffffff08', border: '#ffffff15', text: '#64748b' };
  return (
    <span
      className="text-xs font-bold px-1.5 py-0.5 rounded"
      style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.text }}
    >
      {cfg.label}
    </span>
  );
}

function PnL({ pos }: { pos: Position }) {
  if (!pos.exitBnbWei) return null;
  const entry = Number(pos.entryBnbWei);
  const exit  = Number(pos.exitBnbWei);
  const pct   = ((exit - entry) / entry) * 100;
  const sign  = pct >= 0 ? '+' : '';
  const color = pct >= 0 ? '#10b981' : '#ef4444';
  return (
    <span className="text-xs font-bold font-mono" style={{ color }}>
      {sign}{pct.toFixed(1)}%
    </span>
  );
}

export default function PositionsPanel({
  positions,
  meta,
  onTrade,
}: {
  positions: Position[];
  meta: MetaMap;
  onTrade?: () => void;
}) {
  const [closeTarget, setCloseTarget] = useState<Position | null>(null);

  const open   = positions.filter(p => p.status.startsWith('open'));
  const closed = positions.filter(p => !p.status.startsWith('open')).slice(0, 5);
  const wins    = positions.filter(p => p.status === 'closed_profit').length;
  const total   = positions.filter(p => p.exitBnbWei !== null).length;
  const winRate = total ? Math.round((wins / total) * 100) : null;

  return (
    <div className="card">
      <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)' }}>
        <div>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-hi)' }}>Positions</h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-lo)' }}>
            {open.length} open
            {winRate !== null && ` · ${winRate}% win rate`}
          </p>
        </div>
        {winRate !== null && (
          <div
            className="text-sm font-bold px-3 py-1.5 rounded-lg"
            style={{
              background: winRate >= 50 ? '#10b98115' : '#ef444415',
              color:      winRate >= 50 ? '#10b981'   : '#ef4444',
              border:     `1px solid ${winRate >= 50 ? '#10b98130' : '#ef444430'}`,
            }}
          >
            {winRate}%
          </div>
        )}
      </div>

      <div className="divide-y" style={{ borderColor: 'var(--border-dim)' }}>
        {positions.length === 0 && (
          <div className="px-5 py-10 text-center text-sm" style={{ color: 'var(--text-lo)' }}>
            <div className="flex flex-col items-center gap-2">
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="4" y="7" width="20" height="14" rx="3" />
                <path d="M9 14h10M14 11v6" strokeLinecap="round" />
              </svg>
              No positions yet
            </div>
          </div>
        )}

        {[...open, ...closed].map(pos => {
          const isOpen = pos.status.startsWith('open');
          return (
            <div key={pos.id} className="px-5 py-3 flex items-center gap-3 data-row transition-colors">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Link
                    href={`/dashboard/token/${pos.tokenAddress}`}
                    className="flex flex-col hover:opacity-80 transition-opacity min-w-0"
                  >
                    {meta[pos.tokenAddress.toLowerCase()]?.symbol && (
                      <span className="text-xs font-semibold truncate" style={{ color: '#e8edf5' }}>
                        {meta[pos.tokenAddress.toLowerCase()].symbol}
                      </span>
                    )}
                    <span className="text-xs font-mono truncate" style={{ color: '#60a5fa' }}>
                      {shortAddr(pos.tokenAddress)}
                    </span>
                  </Link>
                  <StatusChip status={pos.status} />
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs" style={{ color: 'var(--text-lo)' }}>
                    score {pos.entryScore}
                  </span>
                  <span style={{ color: 'var(--border)' }}>·</span>
                  <span className="text-xs" style={{ color: 'var(--text-lo)' }}>
                    {timeAgo(pos.entryMs)}
                  </span>
                </div>
              </div>

              <div className="flex flex-col items-end gap-1 shrink-0">
                <span className="text-xs font-mono" style={{ color: 'var(--text-mid)' }}>
                  {formatBnb(pos.entryBnbWei)}
                </span>
                <PnL pos={pos} />
                {isOpen && (
                  <button
                    onClick={() => setCloseTarget(pos)}
                    className="px-2 py-0.5 rounded text-xs font-bold transition-all hover:opacity-80 mt-0.5"
                    style={{
                      background: '#ef444415',
                      border:     '1px solid #ef444430',
                      color:      '#ef4444',
                      cursor:     'pointer',
                    }}
                  >
                    Close
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {closeTarget && (
        <CloseModal
          posId={closeTarget.id}
          token={closeTarget.tokenAddress}
          symbol={meta[closeTarget.tokenAddress.toLowerCase()]?.symbol}
          entryBnbWei={closeTarget.entryBnbWei}
          tokenAmount={closeTarget.entryTokenAmount}
          onClose={() => setCloseTarget(null)}
          onDone={() => { setCloseTarget(null); onTrade?.(); }}
        />
      )}
    </div>
  );
}
