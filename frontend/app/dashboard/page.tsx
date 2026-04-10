'use client';

import { useEffect, useState, useCallback } from 'react';
import Navbar from '@/components/Navbar';
import MetricsBar from '@/components/MetricsBar';
import CurvesTable from '@/components/CurvesTable';
import PositionsPanel from '@/components/PositionsPanel';
import OraclePanel from '@/components/OraclePanel';
import AgentPanel from '@/components/AgentPanel';
import type { SystemStatus, CurveWithScore, Position, LPYield, MetaMap } from '@/types';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

export default function Dashboard() {
  const [status,    setStatus]    = useState<SystemStatus | null>(null);
  const [curves,    setCurves]    = useState<CurveWithScore[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [yields,    setYields]    = useState<LPYield[]>([]);
  const [meta,      setMeta]      = useState<MetaMap>({});
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [connected,   setConnected]   = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [s, c, p, y, m] = await Promise.all([
        fetch(`${API}/status`).then(r => r.json()),
        fetch(`${API}/curves`).then(r => r.json()),
        fetch(`${API}/positions`).then(r => r.json()),
        fetch(`${API}/oracle`).then(r => r.json()),
        fetch(`${API}/tokens`).then(r => r.json()),
      ]);
      setStatus(s);
      setCurves(c);
      setPositions(p);
      setYields(y);
      setMeta(m);
      setLastRefresh(new Date());
      setConnected(true);
    } catch {
      setConnected(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 15_000);
    return () => clearInterval(interval);
  }, [refresh]);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar
        status={status}
        connected={connected}
        lastRefresh={lastRefresh}
        onRefresh={refresh}
      />

      <MetricsBar status={status} positions={positions} yields={yields} />

      <main className="flex-1 px-4 md:px-6 py-5 grid grid-cols-1 xl:grid-cols-3 gap-5 max-w-[1600px] mx-auto w-full">
        <div className="xl:col-span-2">
          <CurvesTable curves={curves} meta={meta} onTrade={refresh} />
        </div>
        <div className="flex flex-col gap-5">
          <PositionsPanel positions={positions} meta={meta} onTrade={refresh} />
          <OraclePanel yields={yields} meta={meta} />
          <AgentPanel />
        </div>
      </main>

      <footer className="border-t px-6 py-3 flex items-center justify-between text-xs"
        style={{ borderColor: 'var(--border)', color: 'var(--text-lo)' }}>
        <div className="flex items-center gap-4">
          <span>FourCast v1.0.0</span>
          <span style={{ color: 'var(--border)' }}>·</span>
          <span>BNB Chain Mainnet</span>
          <span style={{ color: 'var(--border)' }}>·</span>
          <span>0.17% LP fee oracle</span>
        </div>
        <div className="flex items-center gap-4">
          {status?.lastIndexedBlock && (
            <span className="font-mono">block #{status.lastIndexedBlock}</span>
          )}
          <a
            href="https://four.meme"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-amber-400 transition-colors"
            style={{ color: 'var(--text-lo)' }}
          >
            four.meme
          </a>
        </div>
      </footer>
    </div>
  );
}
