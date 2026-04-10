'use client';
import type { SystemStatus, Position, LPYield } from '@/types';

interface MetricsBarProps {
  status:    SystemStatus | null;
  positions: Position[];
  yields:    LPYield[];
}

function Metric({
  label, value, sub, accent,
}: {
  label:   string;
  value:   string | number;
  sub?:    string;
  accent?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs uppercase tracking-widest font-medium" style={{ color: 'var(--text-lo)' }}>
        {label}
      </span>
      <span className="text-2xl font-bold tabular-nums leading-none" style={{ color: accent ?? 'var(--text-hi)' }}>
        {value}
      </span>
      {sub && <span className="text-xs" style={{ color: 'var(--text-lo)' }}>{sub}</span>}
    </div>
  );
}

function Divider() {
  return (
    <div className="h-10 w-px hidden sm:block" style={{ background: 'var(--border)' }} />
  );
}

export default function MetricsBar({ status, positions, yields }: MetricsBarProps) {
  const openPositions  = positions.filter(p => p.status.startsWith('open'));
  const closedWins     = positions.filter(p => p.status === 'closed_profit').length;
  const closedTotal    = positions.filter(p => p.exitBnbWei !== null).length;
  const winRate        = closedTotal ? `${Math.round((closedWins / closedTotal) * 100)}%` : '—';

  const totalLockedBnb = yields.reduce((sum, y) => sum + Number(y.lockedBnbWei), 0);
  const lockedDisplay  = totalLockedBnb > 0
    ? `${(totalLockedBnb / 1e18).toFixed(2)} BNB`
    : '—';

  const uptimeMin = status ? Math.floor(status.uptime / 60_000) : null;
  const uptimeDisplay = uptimeMin !== null
    ? uptimeMin >= 60
      ? `${Math.floor(uptimeMin / 60)}h ${uptimeMin % 60}m`
      : `${uptimeMin}m`
    : '—';

  return (
    <div
      className="px-5 md:px-8 py-4 flex items-center gap-6 overflow-x-auto"
      style={{ borderBottom: '1px solid var(--border-dim)', background: '#0a1120' }}
    >
      <Metric
        label="Active Curves"
        value={status?.activeCurves ?? '—'}
        sub="bonding curve stage"
        accent="#f59e0b"
      />
      <Divider />
      <Metric
        label="Graduated"
        value={status?.graduated ?? '—'}
        sub="→ PancakeSwap V2"
        accent="#60a5fa"
      />
      <Divider />
      <Metric
        label="Open Positions"
        value={openPositions.length > 0 ? openPositions.length : (status?.openPositions ?? '—')}
        sub={`win rate ${winRate}`}
        accent="#a78bfa"
      />
      <Divider />
      <Metric
        label="Locked LP"
        value={lockedDisplay}
        sub="burned forever"
        accent="#34d399"
      />
      <Divider />
      <Metric
        label="Uptime"
        value={uptimeDisplay}
        sub={status?.paperTrading ? 'paper trading' : 'live execution'}
      />
    </div>
  );
}
