'use client';
import Link from 'next/link';
import type { SystemStatus } from '@/types';
import Logo from '@/components/Logo';

interface NavbarProps {
  status:      SystemStatus | null;
  connected:   boolean;
  lastRefresh: Date | null;
  onRefresh:   () => void;
}

export default function Navbar({ status, connected, lastRefresh, onRefresh }: NavbarProps) {
  return (
    <header
      className="sticky top-0 z-50 flex items-center justify-between px-5 md:px-8 h-14"
      style={{
        background:   'linear-gradient(to bottom, #0d1526ee, #0d1526cc)',
        borderBottom: '1px solid var(--border)',
        backdropFilter: 'blur(16px)',
      }}
    >
      <Link
        href="/"
        className="flex items-center justify-center w-8 h-8 rounded-lg mr-1 transition-all hover:opacity-80"
        style={{ background: '#ffffff08', border: '1px solid var(--border)', color: 'var(--text-mid)' }}
        title="Back to home"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 2L4 7l5 5" />
        </svg>
      </Link>

      <div className="flex items-center gap-3">
        <Logo size={30} showText />
        <span
          className="hidden sm:block text-xs px-2 py-0.5 rounded-full font-mono"
          style={{
            background:  '#f59e0b12',
            color:       '#f59e0b99',
            border:      '1px solid #f59e0b22',
          }}
        >
          BNB Chain
        </span>
        {status?.paperTrading && (
          <span
            className="text-xs px-2 py-0.5 rounded-full font-semibold"
            style={{ background: '#ef444418', color: '#ef4444', border: '1px solid #ef444430' }}
          >
            Paper
          </span>
        )}
      </div>

      <nav className="hidden md:flex items-center gap-6 text-sm" style={{ color: 'var(--text-mid)' }}>
        <span className="hover:text-amber-400 cursor-default transition-colors">Curves</span>
        <span className="hover:text-amber-400 cursor-default transition-colors">Positions</span>
        <span className="hover:text-amber-400 cursor-default transition-colors">Oracle</span>
        <a
          href="https://bscscan.com/address/0x5c952063c7fc8610FFDB798152D69F0B9550762b"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-amber-400 transition-colors"
        >
          Contract ↗
        </a>
      </nav>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="relative" style={{ width: 8, height: 8 }}>
            <div
              className="absolute inset-0 rounded-full"
              style={{ background: connected ? '#10b981' : '#ef4444' }}
            />
            {connected && (
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  background: '#10b981',
                  animation: 'ping 2s ease-in-out infinite',
                  opacity: 0.4,
                }}
              />
            )}
          </div>
          <span className="text-xs hidden sm:block" style={{ color: 'var(--text-mid)' }}>
            {connected ? 'Live' : 'Offline'}
          </span>
        </div>

        {lastRefresh && (
          <span className="text-xs hidden md:block font-mono" style={{ color: 'var(--text-lo)' }} suppressHydrationWarning>
            {lastRefresh.toLocaleTimeString()}
          </span>
        )}

        <button
          onClick={onRefresh}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all"
          style={{
            background:  '#ffffff08',
            border:      '1px solid var(--border)',
            color:       'var(--text-mid)',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = '#f59e0b55';
            (e.currentTarget as HTMLButtonElement).style.color = '#f59e0b';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)';
            (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-mid)';
          }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M10.5 2A5 5 0 1 0 11 6" />
            <path d="M8.5 2H10.5V4" />
          </svg>
          Refresh
        </button>
      </div>
    </header>
  );
}
