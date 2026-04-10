'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Logo from '@/components/Logo';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

type LiveStats = {
  activeCurves: number;
  graduated: number;
  openPositions: number;
};

function Counter({ target, suffix = '' }: { target: number; suffix?: string }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (target === 0) return;
    const step = Math.ceil(target / 40);
    const id = setInterval(() => {
      setVal(v => {
        if (v + step >= target) { clearInterval(id); return target; }
        return v + step;
      });
    }, 30);
    return () => clearInterval(id);
  }, [target]);
  return <>{val}{suffix}</>;
}


function FeatureCard({
  icon, title, tag, desc, points,
}: {
  icon: React.ReactNode;
  title: string;
  tag: string;
  desc: string;
  points: string[];
}) {
  return (
    <div
      className="rounded-2xl p-6 flex flex-col gap-4 group transition-all duration-300"
      style={{
        background:  'linear-gradient(145deg, #111d35, #0d1526)',
        border:      '1px solid #1e2f50',
        boxShadow:   '0 4px 24px #00000040',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.borderColor = '#f59e0b44';
        (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 40px #f59e0b0a, 0 4px 24px #00000060';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.borderColor = '#1e2f50';
        (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 24px #00000040';
      }}
    >
      <div className="flex items-start justify-between">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center"
          style={{ background: '#f59e0b15', border: '1px solid #f59e0b25' }}
        >
          {icon}
        </div>
        <span
          className="text-xs font-mono px-2 py-1 rounded-full"
          style={{ background: '#f59e0b10', color: '#f59e0b88', border: '1px solid #f59e0b20' }}
        >
          {tag}
        </span>
      </div>
      <div>
        <h3 className="text-base font-semibold mb-1" style={{ color: '#e8edf5' }}>{title}</h3>
        <p className="text-sm leading-relaxed" style={{ color: '#8fa3c0' }}>{desc}</p>
      </div>
      <ul className="flex flex-col gap-2">
        {points.map(p => (
          <li key={p} className="flex items-start gap-2 text-sm" style={{ color: '#6b87a8' }}>
            <span className="mt-1 shrink-0" style={{ color: '#f59e0b' }}>→</span>
            {p}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Step({ n, title, desc }: { n: number; title: string; desc: string }) {
  return (
    <div className="flex gap-4">
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 mt-0.5"
        style={{ background: '#f59e0b15', border: '1px solid #f59e0b30', color: '#f59e0b' }}
      >
        {n}
      </div>
      <div>
        <div className="text-sm font-semibold mb-1" style={{ color: '#e8edf5' }}>{title}</div>
        <div className="text-sm leading-relaxed" style={{ color: '#6b87a8' }}>{desc}</div>
      </div>
    </div>
  );
}

function StatPill({ label, value, live }: { label: string; value: React.ReactNode; live?: boolean }) {
  return (
    <div
      className="flex flex-col items-center gap-1 px-6 py-4 rounded-xl"
      style={{ background: '#111d35', border: '1px solid #1e2f50' }}
    >
      {live && (
        <div className="flex items-center gap-1.5 mb-1">
          <div className="w-1.5 h-1.5 rounded-full bg-green-400" style={{ animation: 'ping 2s ease-in-out infinite' }} />
          <span className="text-xs" style={{ color: '#10b98188' }}>LIVE</span>
        </div>
      )}
      <div className="text-2xl font-bold tabular-nums" style={{ color: '#f59e0b' }}>{value}</div>
      <div className="text-xs uppercase tracking-wider" style={{ color: '#3d5070' }}>{label}</div>
    </div>
  );
}

function TechBadge({ label }: { label: string }) {
  return (
    <span
      className="text-xs font-mono px-3 py-1.5 rounded-full"
      style={{ background: '#ffffff08', border: '1px solid #1e2f50', color: '#8fa3c0' }}
    >
      {label}
    </span>
  );
}

export default function Landing() {
  const [stats, setStats] = useState<LiveStats | null>(null);

  useEffect(() => {
    fetch(`${API}/status`)
      .then(r => r.json())
      .then(s => setStats({ activeCurves: s.activeCurves, graduated: s.graduated, openPositions: s.openPositions }))
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen flex flex-col" style={{ color: '#e8edf5' }}>

      <header
        className="sticky top-0 z-50 flex items-center justify-between px-6 md:px-10 h-14"
        style={{
          background: '#080d1aee',
          borderBottom: '1px solid #1e2f5055',
          backdropFilter: 'blur(16px)',
        }}
      >
        <Logo size={28} showText />

        <nav className="hidden md:flex items-center gap-8 text-sm" style={{ color: '#8fa3c0' }}>
          <a href="#features" className="hover:text-amber-400 transition-colors">Features</a>
          <a href="#skill" className="hover:text-amber-400 transition-colors">Agentic Skill</a>
          <a href="#how-it-works" className="hover:text-amber-400 transition-colors">How It Works</a>
          <a href="#tech" className="hover:text-amber-400 transition-colors">Technology</a>
        </nav>

        <Link
          href="/dashboard"
          className="text-sm font-semibold px-4 py-2 rounded-lg transition-all"
          style={{ background: '#f59e0b', color: '#080d1a' }}
          onMouseEnter={e => (e.currentTarget.style.background = '#fbbf24')}
          onMouseLeave={e => (e.currentTarget.style.background = '#f59e0b')}
        >
          Launch App →
        </Link>
      </header>

      <section className="relative flex flex-col items-center text-center px-6 pt-24 pb-20 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, #f59e0b08 0%, transparent 70%)', top: '-100px' }} />

        <div
          className="flex items-center gap-2 text-xs font-mono px-3 py-1.5 rounded-full mb-6"
          style={{ background: '#f59e0b10', border: '1px solid #f59e0b25', color: '#f59e0b' }}
        >
          <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
          BNB Chain · Four.meme DeFi Intelligence
        </div>

        <h1 className="text-5xl md:text-7xl font-bold leading-tight tracking-tight mb-6 max-w-4xl">
          Predict{' '}
          <span style={{
            background: 'linear-gradient(135deg, #f59e0b, #fbbf24)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            graduations
          </span>
          <br />before they happen
        </h1>

        <p className="text-lg md:text-xl max-w-2xl leading-relaxed mb-10" style={{ color: '#8fa3c0' }}>
          FourCast watches every bonding curve on Four.meme in real time — scoring momentum,
          routing capital to the highest-conviction opportunities, and tracking locked LP yield forever.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all"
            style={{ background: '#f59e0b', color: '#080d1a' }}
            onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = '#fbbf24'; (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(-1px)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = '#f59e0b'; (e.currentTarget as HTMLAnchorElement).style.transform = 'none'; }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <rect x="2" y="2" width="5" height="5" rx="1" />
              <rect x="9" y="2" width="5" height="5" rx="1" />
              <rect x="2" y="9" width="5" height="5" rx="1" />
              <rect x="9" y="9" width="5" height="5" rx="1" />
            </svg>
            Open Dashboard
          </Link>
          <a
            href="https://bscscan.com/address/0x5c952063c7fc8610FFDB798152D69F0B9550762b"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-all"
            style={{ background: '#ffffff08', border: '1px solid #1e2f50', color: '#8fa3c0' }}
            onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.borderColor = '#f59e0b44'; (e.currentTarget as HTMLAnchorElement).style.color = '#f59e0b'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.borderColor = '#1e2f50'; (e.currentTarget as HTMLAnchorElement).style.color = '#8fa3c0'; }}
          >
            View Contract ↗
          </a>
        </div>

        <div className="mt-16 flex flex-wrap justify-center gap-4">
          <StatPill
            label="Curves Tracked"
            value={stats ? <Counter target={stats.activeCurves} /> : '—'}
            live
          />
          <StatPill
            label="Graduated Tokens"
            value={stats ? <Counter target={stats.graduated} /> : '—'}
            live
          />
          <StatPill
            label="Positions Managed"
            value={stats ? <Counter target={stats.openPositions} /> : '—'}
            live
          />
          <StatPill
            label="Graduation Rate"
            value={<>~<Counter target={18} />%</>}
          />
        </div>
      </section>

      <section id="features" className="px-6 md:px-10 py-20 max-w-6xl mx-auto w-full">
        <div className="text-center mb-12">
          <p className="text-xs font-mono uppercase tracking-widest mb-3" style={{ color: '#f59e0b88' }}>Three Primitives</p>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Everything you need to trade Four.meme</h2>
          <p className="text-base max-w-xl mx-auto" style={{ color: '#8fa3c0' }}>
            One unified system combining on-chain intelligence, capital routing, and yield analytics.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-5">
          <FeatureCard
            icon={
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round">
                <path d="M3 17L7 11L10 14L14 7L17 10" />
                <circle cx="17" cy="10" r="1.5" fill="#f59e0b" stroke="none" />
              </svg>
            }
            tag="Primitive 1"
            title="Bonding Curve Capital Router"
            desc="Scores every active Four.meme bonding curve 0–100 using five weighted signals and routes capital to the highest-conviction opportunities."
            points={[
              'Fill % momentum (25 pts) — how far along the curve is',
              'Fill velocity EMA (25 pts) — buy rate per millisecond',
              'Curve age (15 pts) — newer curves score higher',
              'Purchase activity (15 pts) — unique buy frequency',
              'Oracle history (20 pts) — past graduation yield',
            ]}
          />
          <FeatureCard
            icon={
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round">
                <circle cx="10" cy="10" r="7" />
                <path d="M10 6v4l3 3" />
              </svg>
            }
            tag="Primitive 2"
            title="Graduation Position Manager"
            desc="Opens positions on high-scoring curves and follows them through graduation onto PancakeSwap V2 — automatically managing the full lifecycle."
            points={[
              'Entry on bonding curve when score ≥ threshold',
              'Tracks token through PairCreated graduation event',
              'Holds post-graduation for configurable duration',
              'Rug detection via reserve monitoring',
              'Full paper trading mode for safe testing',
            ]}
          />
          <FeatureCard
            icon={
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round">
                <path d="M4 16c0-4 4-6 6-6s6 2 6 6" />
                <circle cx="10" cy="6" r="3" />
                <path d="M1 16h18" />
              </svg>
            }
            tag="Primitive 3"
            title="Locked LP Yield Oracle"
            desc="Four.meme burns all LP tokens at graduation — creating permanently locked liquidity that generates 0.17% fees forever with no way to exit."
            points={[
              'Tracks every graduated token\'s PancakeSwap pair',
              'Monitors Swap events to calculate 24h volume',
              'Computes annualized yield on burned LP value',
              'Feeds back into scorer as oracle signal',
              'Compounds as more tokens graduate daily',
            ]}
          />
        </div>
      </section>

      <div className="mx-6 md:mx-10 max-w-6xl" style={{ borderTop: '1px solid #1e2f50', margin: '0 auto', maxWidth: '72rem' }} />

      <section id="skill" className="px-6 md:px-10 py-20 max-w-6xl mx-auto w-full">
        <div className="text-center mb-12">
          <p className="text-xs font-mono uppercase tracking-widest mb-3" style={{ color: '#f59e0b88' }}>
            Four.meme Agentic Skill
          </p>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Built on{' '}
            <span style={{ color: '#f59e0b' }}>@four-meme/four-meme-ai</span>
          </h2>
          <p className="text-base max-w-2xl mx-auto" style={{ color: '#8fa3c0' }}>
            FourCast integrates the official Four.meme agentic skill package — Five on-chain capabilities
            wired directly into the scoring pipeline, position manager, and AI agent.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="flex flex-col gap-3">
            {[
              {
                skill: 'Rankings',
                how: 'Live HOT ranking refreshed every 60s — injects the hot bonus signal (5 pts) into every curve score in real time.',
              },
              {
                skill: 'Buy / Sell Quotes',
                how: 'TokenManagerHelper3.tryBuy simulates every entry on-chain before capital is committed — real price, fee, and slippage validated first.',
              },
              {
                skill: 'Execute Buy / Sell',
                how: 'buyTokenAMAP and sellToken on the Four.meme proxy are called by the executor for live on-chain entries and exits.',
              },
              {
                skill: 'On-chain Events',
                how: 'TokenPurchase events are the primary data source — every buy is indexed in real time to build fill%, velocity, and activity signals.',
              },
              {
                skill: 'Token Info',
                how: 'TokenManagerHelper3.getTokenInfo returns live offers, funds, price, and graduation status for every tracked token.',
              },
            ].map(({ skill, how }) => (
              <div
                key={skill}
                className="flex gap-4 p-4 rounded-xl"
                style={{ background: '#111d35', border: '1px solid #f59e0b18' }}
              >
                <div
                  className="shrink-0 px-2 py-1 rounded-md text-xs font-mono font-bold h-fit"
                  style={{ background: '#f59e0b15', border: '1px solid #f59e0b30', color: '#f59e0b' }}
                >
                  {skill}
                </div>
                <p className="text-sm leading-relaxed" style={{ color: '#6b87a8' }}>{how}</p>
              </div>
            ))}
          </div>

          <div
            className="rounded-2xl p-6 font-mono text-xs flex flex-col gap-3 h-fit"
            style={{ background: '#111d35', border: '1px solid #f59e0b25' }}
          >
            <div className="text-xs mb-1" style={{ color: '#f59e0b44' }}>Skills used by FourCast</div>
            {[
              { name: 'Rankings', tag: 'HOT · PROGRESS · VOL', color: '#f59e0b' },
              { name: 'Buy/sell quotes', tag: 'tryBuy · trySell', color: '#60a5fa' },
              { name: 'Execute buy/sell', tag: 'buyTokenAMAP · sellToken', color: '#a78bfa' },
              { name: 'On-chain events', tag: 'TokenPurchase', color: '#34d399' },
              { name: 'Token info', tag: 'getTokenInfo', color: '#f472b6' },
            ].map(({ name, tag, color }) => (
              <div
                key={name}
                className="flex items-center justify-between p-2.5 rounded-lg"
                style={{ background: '#ffffff04', border: `1px solid ${color}18` }}
              >
                <span style={{ color }}>{name}</span>
                <span className="text-xs" style={{ color: '#3d5070' }}>{tag}</span>
              </div>
            ))}
            <a
              href="https://four.meme/agentic"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 text-xs text-center py-2 rounded-lg transition-colors"
              style={{ color: '#f59e0b88', border: '1px solid #f59e0b20' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#f59e0b')}
              onMouseLeave={e => (e.currentTarget.style.color = '#f59e0b88')}
            >
              four.meme/agentic ↗
            </a>
          </div>
        </div>
      </section>

      <div className="mx-6 md:mx-10 max-w-6xl" style={{ borderTop: '1px solid #1e2f50', margin: '0 auto', maxWidth: '72rem' }} />

      <section id="how-it-works" className="px-6 md:px-10 py-20 max-w-6xl mx-auto w-full">
        <div className="max-w-2xl">
          <div>
            <p className="text-xs font-mono uppercase tracking-widest mb-3" style={{ color: '#f59e0b88' }}>How It Works</p>
            <h2 className="text-3xl font-bold mb-4">From raw events to executed trades</h2>
            <p className="text-base mb-8" style={{ color: '#8fa3c0' }}>
              FourCast ingests the BSC blockchain in real time, building a live model of every bonding curve — then acts on it.
            </p>
            <div className="flex flex-col gap-6">
              <Step
                n={1}
                title="Bootstrap"
                desc="On startup, scans the last 600 blocks (~30 min) for TokenPurchase events to build initial curve state for all active tokens."
              />
              <Step
                n={2}
                title="Live Polling"
                desc="Every 5 seconds, fetches new TokenPurchase and PairCreated events in parallel using HTTP polling — compatible with all public BSC RPCs."
              />
              <Step
                n={3}
                title="Score & Route"
                desc="Each curve is scored every 30 seconds using the five-factor model. Capital is routed to curves exceeding the minimum score threshold."
              />
              <Step
                n={4}
                title="Follow Through Graduation"
                desc="When a PairCreated event is detected for a tracked token, the position transitions to PancakeSwap V2 tracking mode automatically."
              />
              <Step
                n={5}
                title="Yield Analytics"
                desc="Graduated pairs are polled every 15 minutes for Swap volume. Annualized yield is computed and fed back into the scorer as the oracle signal."
              />
            </div>
          </div>

        </div>
      </section>

      <section id="tech" className="px-6 md:px-10 py-16" style={{ background: '#0a1120', borderTop: '1px solid #1e2f5055', borderBottom: '1px solid #1e2f5055' }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-xs font-mono uppercase tracking-widest mb-3" style={{ color: '#f59e0b88' }}>Technology</p>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            {[
              'TypeScript', 'Node.js', 'BNB Chain', 'PancakeSwap V2',
              '@four-meme/four-meme-ai', 'Groq · Llama 3.3 70B', 'Next.js 15',
            ].map(t => <TechBadge key={t} label={t} />)}
          </div>

          <div className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Block time', value: '~3s', sub: 'BSC mainnet' },
              { label: 'Poll interval', value: '5s', sub: 'HTTP getLogs' },
              { label: 'Score factors', value: '5', sub: 'weighted signals' },
              { label: 'LP fee', value: '0.17%', sub: 'per swap, forever' },
            ].map(m => (
              <div
                key={m.label}
                className="rounded-xl p-4 text-center"
                style={{ background: '#111d35', border: '1px solid #1e2f50' }}
              >
                <div className="text-2xl font-bold mb-1" style={{ color: '#e8edf5' }}>{m.value}</div>
                <div className="text-xs font-medium mb-0.5" style={{ color: '#8fa3c0' }}>{m.label}</div>
                <div className="text-xs" style={{ color: '#3d5070' }}>{m.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 md:px-10 py-24 text-center max-w-3xl mx-auto w-full">
        <div
          className="rounded-2xl p-10 relative overflow-hidden"
          style={{ background: 'linear-gradient(135deg, #111d35, #0d1526)', border: '1px solid #f59e0b25' }}
        >
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(ellipse at center top, #f59e0b08, transparent 60%)' }} />
          <h2 className="text-3xl md:text-4xl font-bold mb-4 relative">
            Start tracking the curve
          </h2>
          <p className="text-base mb-8 relative" style={{ color: '#8fa3c0' }}>
            Live on BNB Chain mainnet. Paper trading mode enabled by default — no private key needed to explore.
          </p>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl text-sm font-bold transition-all relative"
            style={{ background: '#f59e0b', color: '#080d1a' }}
            onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = '#fbbf24'; (e.currentTarget as HTMLAnchorElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLAnchorElement).style.boxShadow = '0 8px 32px #f59e0b30'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = '#f59e0b'; (e.currentTarget as HTMLAnchorElement).style.transform = 'none'; (e.currentTarget as HTMLAnchorElement).style.boxShadow = 'none'; }}
          >
            Open Dashboard →
          </Link>
        </div>
      </section>

      <footer
        className="px-6 md:px-10 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs"
        style={{ borderTop: '1px solid #1e2f5055', color: '#3d5070' }}
      >
        <div className="flex items-center gap-2">
          <Logo size={18} />
          <span>FourCast v1.0.0 · Four.meme DeFi Intelligence on BNB Chain</span>
        </div>
        <div className="flex items-center gap-4">
          <a href="https://four.meme" target="_blank" rel="noopener noreferrer" className="hover:text-amber-400 transition-colors">four.meme</a>
          <a href="https://bscscan.com/address/0x5c952063c7fc8610FFDB798152D69F0B9550762b" target="_blank" rel="noopener noreferrer" className="hover:text-amber-400 transition-colors">contract</a>
          <Link href="/dashboard" className="hover:text-amber-400 transition-colors">dashboard</Link>
        </div>
      </footer>
    </div>
  );
}
