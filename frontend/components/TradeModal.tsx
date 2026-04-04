'use client';
import { useState } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

interface BuyQuote {
  estimatedAmount: string;
  estimatedCost:   string;
  estimatedFee:    string;
  totalRequired:   string;
}

interface SellQuote {
  estimatedFunds: string;
  estimatedFee:   string;
}

function formatBnb(wei: string) {
  return `${(Number(wei) / 1e18).toFixed(6)} BNB`;
}

function formatTokens(wei: string) {
  const n = Number(wei) / 1e18;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(2)}K`;
  return n.toFixed(4);
}

interface BuyModalProps {
  token:          string;
  symbol?:        string;
  recommendedBnb: number;
  onClose:        () => void;
  onDone:         () => void;
}

export function BuyModal({ token, symbol, recommendedBnb, onClose, onDone }: BuyModalProps) {
  const [bnb,     setBnb]     = useState(recommendedBnb > 0 ? recommendedBnb.toFixed(4) : '0.05');
  const [quote,   setQuote]   = useState<BuyQuote | null>(null);
  const [loading, setLoading] = useState(false);
  const [step,    setStep]    = useState<'idle' | 'quoted' | 'submitting' | 'done' | 'error'>('idle');
  const [errMsg,  setErrMsg]  = useState('');

  async function getQuote() {
    setLoading(true);
    setQuote(null);
    setStep('idle');
    try {
      const r = await fetch(`${API}/trade/quote/buy?token=${token}&bnb=${bnb}`);
      const d = await r.json();
      if (!r.ok) { setErrMsg(d.error ?? 'Quote failed'); setStep('error'); return; }
      setQuote(d);
      setStep('quoted');
    } catch {
      setErrMsg('Network error');
      setStep('error');
    } finally {
      setLoading(false);
    }
  }

  async function confirmBuy() {
    setStep('submitting');
    try {
      const r = await fetch(`${API}/positions/open/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bnb: parseFloat(bnb) }),
      });
      const d = await r.json();
      if (!r.ok) { setErrMsg(d.error ?? 'Buy failed'); setStep('error'); return; }
      setStep('done');
      setTimeout(() => { onDone(); onClose(); }, 1200);
    } catch {
      setErrMsg('Network error');
      setStep('error');
    }
  }

  return (
    <Overlay onClose={onClose}>
      <div style={{ color: 'var(--text-hi)' }}>
        <ModalHeader
          icon="↑"
          iconColor="#f59e0b"
          title={`Buy ${symbol ?? 'Token'}`}
          subtitle={`0x${token.slice(2, 8)}…${token.slice(-4)}`}
          onClose={onClose}
        />

        <div className="px-5 pb-5 flex flex-col gap-4 mt-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--text-lo)' }}>BNB AMOUNT</label>
            <div className="flex gap-2">
              <input
                type="number"
                min="0.001"
                step="0.001"
                value={bnb}
                onChange={e => { setBnb(e.target.value); setStep('idle'); setQuote(null); }}
                className="flex-1 rounded-lg px-3 py-2 text-sm font-mono outline-none"
                style={{
                  background: '#ffffff08',
                  border: '1px solid var(--border)',
                  color: 'var(--text-hi)',
                }}
              />
              <button
                onClick={getQuote}
                disabled={loading}
                className="px-4 py-2 rounded-lg text-xs font-bold transition-opacity"
                style={{
                  background: '#f59e0b20',
                  border: '1px solid #f59e0b50',
                  color: '#f59e0b',
                  opacity: loading ? 0.6 : 1,
                  cursor: loading ? 'not-allowed' : 'pointer',
                }}
              >
                {loading ? '…' : 'Quote'}
              </button>
            </div>
          </div>

          {quote && step === 'quoted' && (
            <div
              className="rounded-lg p-3 flex flex-col gap-2 text-xs font-mono"
              style={{ background: '#f59e0b08', border: '1px solid #f59e0b20' }}
            >
              <div className="flex justify-between">
                <span style={{ color: 'var(--text-lo)' }}>You receive</span>
                <span className="font-bold" style={{ color: '#f59e0b' }}>{formatTokens(quote.estimatedAmount)} tokens</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: 'var(--text-lo)' }}>Protocol fee</span>
                <span style={{ color: 'var(--text-mid)' }}>{formatBnb(quote.estimatedFee)}</span>
              </div>
              <div className="flex justify-between" style={{ borderTop: '1px solid #f59e0b15', paddingTop: 6 }}>
                <span style={{ color: 'var(--text-lo)' }}>Total required</span>
                <span className="font-bold" style={{ color: 'var(--text-hi)' }}>{formatBnb(quote.totalRequired)}</span>
              </div>
            </div>
          )}

          {step === 'error' && (
            <p className="text-xs px-3 py-2 rounded-lg" style={{ background: '#ef444415', color: '#ef4444', border: '1px solid #ef444430' }}>
              {errMsg}
            </p>
          )}

          {step === 'done' && (
            <p className="text-xs px-3 py-2 rounded-lg text-center font-bold" style={{ background: '#10b98115', color: '#10b981', border: '1px solid #10b98130' }}>
              Position opened ✓
            </p>
          )}

          <button
            onClick={step === 'quoted' ? confirmBuy : getQuote}
            disabled={step === 'submitting' || step === 'done'}
            className="w-full py-2.5 rounded-lg text-sm font-bold transition-all"
            style={{
              background: step === 'quoted' ? '#f59e0b' : '#f59e0b20',
              color:      step === 'quoted' ? '#000' : '#f59e0b',
              border:     step === 'quoted' ? 'none' : '1px solid #f59e0b40',
              opacity:    (step === 'submitting' || step === 'done') ? 0.6 : 1,
              cursor:     (step === 'submitting' || step === 'done') ? 'not-allowed' : 'pointer',
            }}
          >
            {step === 'submitting' ? 'Submitting…'
              : step === 'quoted'   ? 'Confirm Buy'
              : 'Get Quote First'}
          </button>
        </div>
      </div>
    </Overlay>
  );
}

interface CloseModalProps {
  posId:          string;
  token:          string;
  symbol?:        string;
  entryBnbWei:    string;
  tokenAmount:    string;
  onClose:        () => void;
  onDone:         () => void;
}

export function CloseModal({ posId, token, symbol, entryBnbWei, tokenAmount, onClose, onDone }: CloseModalProps) {
  const [quote,   setQuote]   = useState<SellQuote | null>(null);
  const [loading, setLoading] = useState(false);
  const [step,    setStep]    = useState<'idle' | 'quoted' | 'submitting' | 'done' | 'error'>('idle');
  const [errMsg,  setErrMsg]  = useState('');

  async function getQuote() {
    if (tokenAmount === '0') { setStep('quoted'); return; }
    setLoading(true);
    try {
      const r = await fetch(`${API}/trade/quote/sell?token=${token}&amount=${tokenAmount}`);
      const d = await r.json();
      if (!r.ok) { setErrMsg(d.error ?? 'Quote failed'); setStep('error'); return; }
      setQuote(d);
      setStep('quoted');
    } catch {
      setErrMsg('Network error');
      setStep('error');
    } finally {
      setLoading(false);
    }
  }

  async function confirmClose() {
    setStep('submitting');
    try {
      const r = await fetch(`${API}/positions/close/${posId}`, { method: 'POST' });
      const d = await r.json();
      if (!r.ok) { setErrMsg(d.error ?? 'Close failed'); setStep('error'); return; }
      setStep('done');
      setTimeout(() => { onDone(); onClose(); }, 1200);
    } catch {
      setErrMsg('Network error');
      setStep('error');
    }
  }

  const entryBnb = (Number(entryBnbWei) / 1e18).toFixed(4);

  return (
    <Overlay onClose={onClose}>
      <div style={{ color: 'var(--text-hi)' }}>
        <ModalHeader
          icon="↓"
          iconColor="#ef4444"
          title={`Close ${symbol ?? 'Position'}`}
          subtitle={`0x${token.slice(2, 8)}…${token.slice(-4)}`}
          onClose={onClose}
        />

        <div className="px-5 pb-5 flex flex-col gap-4 mt-4">
          <div
            className="rounded-lg p-3 flex flex-col gap-2 text-xs font-mono"
            style={{ background: '#ffffff05', border: '1px solid var(--border)' }}
          >
            <div className="flex justify-between">
              <span style={{ color: 'var(--text-lo)' }}>Entry cost</span>
              <span style={{ color: 'var(--text-mid)' }}>{entryBnb} BNB</span>
            </div>
            {quote && (
              <>
                <div className="flex justify-between">
                  <span style={{ color: 'var(--text-lo)' }}>Est. return</span>
                  <span className="font-bold" style={{ color: '#10b981' }}>{formatBnb(quote.estimatedFunds)}</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: 'var(--text-lo)' }}>Protocol fee</span>
                  <span style={{ color: 'var(--text-mid)' }}>{formatBnb(quote.estimatedFee)}</span>
                </div>
              </>
            )}
          </div>

          {step === 'error' && (
            <p className="text-xs px-3 py-2 rounded-lg" style={{ background: '#ef444415', color: '#ef4444', border: '1px solid #ef444430' }}>
              {errMsg}
            </p>
          )}

          {step === 'done' && (
            <p className="text-xs px-3 py-2 rounded-lg text-center font-bold" style={{ background: '#10b98115', color: '#10b981', border: '1px solid #10b98130' }}>
              Position closed ✓
            </p>
          )}

          {step === 'idle' && (
            <button
              onClick={getQuote}
              disabled={loading}
              className="w-full py-2.5 rounded-lg text-sm font-bold transition-all"
              style={{
                background: '#ef444420',
                border: '1px solid #ef444440',
                color: '#ef4444',
                opacity: loading ? 0.6 : 1,
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Getting quote…' : 'Get Sell Quote'}
            </button>
          )}

          {(step === 'quoted' || step === 'submitting') && (
            <button
              onClick={confirmClose}
              disabled={step === 'submitting'}
              className="w-full py-2.5 rounded-lg text-sm font-bold transition-all"
              style={{
                background: '#ef4444',
                color: '#fff',
                border: 'none',
                opacity: step === 'submitting' ? 0.6 : 1,
                cursor: step === 'submitting' ? 'not-allowed' : 'pointer',
              }}
            >
              {step === 'submitting' ? 'Closing…' : 'Confirm Close'}
            </button>
          )}
        </div>
      </div>
    </Overlay>
  );
}

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(8,13,26,0.85)', backdropFilter: 'blur(8px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-sm rounded-2xl"
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
        }}
      >
        {children}
      </div>
    </div>
  );
}

function ModalHeader({
  icon, iconColor, title, subtitle, onClose,
}: {
  icon: string; iconColor: string; title: string; subtitle: string; onClose: () => void;
}) {
  return (
    <div className="px-5 pt-5 flex items-center gap-3">
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center text-lg font-bold shrink-0"
        style={{ background: `${iconColor}18`, border: `1px solid ${iconColor}30`, color: iconColor }}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold truncate" style={{ color: 'var(--text-hi)' }}>{title}</p>
        <p className="text-xs font-mono" style={{ color: 'var(--text-lo)' }}>{subtitle}</p>
      </div>
      <button
        onClick={onClose}
        className="w-7 h-7 rounded-lg flex items-center justify-center text-xs transition-opacity hover:opacity-60"
        style={{ background: '#ffffff0a', color: 'var(--text-lo)' }}
      >
        ✕
      </button>
    </div>
  );
}
