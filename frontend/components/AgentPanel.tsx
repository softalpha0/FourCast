'use client';
import { useState, useRef, useEffect } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  ts: number;
}

const QUICK_PROMPTS = [
  'What are the top opportunities right now?',
  'Give me a market summary',
  'Show my positions and P&L',
  'Which token is most likely to graduate next?',
];

export default function AgentPanel() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input,    setInput]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [status,   setStatus]   = useState<'idle' | 'thinking' | 'error'>('idle');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function sendMessage(userText: string) {
    if (!userText.trim() || loading) return;
    const userMsg: Message = { role: 'user', content: userText.trim(), ts: Date.now() };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput('');
    setLoading(true);
    setStatus('thinking');

    try {
      const res = await fetch(`${API}/agent/chat`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          messages: next.map(m => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json() as { content?: string; error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? `Error ${res.status}`);
      setMessages(prev => [...prev, { role: 'assistant', content: data.content ?? '(no response)', ts: Date.now() }]);
      setStatus('idle');
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: `⚠ ${(err as Error).message}`, ts: Date.now() }]);
      setStatus('error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card flex flex-col" style={{ minHeight: 420, maxHeight: 580 }}>
      <div className="px-5 py-4 flex items-center justify-between shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
        <div>
          <h2 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--text-hi)' }}>
            <span className="w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold"
              style={{ background: '#7c3aed18', border: '1px solid #7c3aed40', color: '#a78bfa' }}>
              AI
            </span>
            FourCast Agent
          </h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-lo)' }}>
            DGrid · Llama 3.3 70B · Four.meme intelligence
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-md"
          style={{
            background: status === 'error' ? '#ef444412' : status === 'thinking' ? '#f59e0b12' : '#10b98112',
            border: `1px solid ${status === 'error' ? '#ef444430' : status === 'thinking' ? '#f59e0b30' : '#10b98130'}`,
            color: status === 'error' ? '#ef4444' : status === 'thinking' ? '#f59e0b' : '#10b981',
          }}>
          <div className="w-1.5 h-1.5 rounded-full"
            style={{ background: status === 'error' ? '#ef4444' : status === 'thinking' ? '#f59e0b' : '#10b981' }} />
          {status === 'thinking' ? 'Thinking…' : status === 'error' ? 'Error' : 'Ready'}
        </div>
      </div>

      {messages.length === 0 && (
        <div className="flex flex-wrap gap-1.5 px-5 pt-3 pb-1 shrink-0">
          {QUICK_PROMPTS.map(q => (
            <button key={q} onClick={() => sendMessage(q)} disabled={loading}
              className="text-xs px-2.5 py-1 rounded-md transition-all hover:opacity-80"
              style={{
                background: '#7c3aed12', border: '1px solid #7c3aed30', color: '#a78bfa',
                cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.5 : 1,
              }}>
              {q}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-5 py-3 flex flex-col gap-3" style={{ minHeight: 0 }}>
        {messages.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center py-8">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
              style={{ background: '#7c3aed15', border: '1px solid #7c3aed30', color: '#a78bfa' }}>
              ◈
            </div>
            <p className="text-xs" style={{ color: 'var(--text-lo)' }}>
              Ask about curves, positions, or market conditions
            </p>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex gap-2 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {m.role === 'assistant' && (
              <div className="w-6 h-6 rounded-lg shrink-0 flex items-center justify-center text-xs font-bold mt-0.5"
                style={{ background: '#7c3aed18', border: '1px solid #7c3aed40', color: '#a78bfa' }}>
                AI
              </div>
            )}
            <div className="text-xs rounded-xl px-3 py-2 max-w-[85%] whitespace-pre-wrap font-mono leading-relaxed"
              style={{
                background: m.role === 'user' ? '#f59e0b18' : '#ffffff08',
                border: `1px solid ${m.role === 'user' ? '#f59e0b30' : 'var(--border)'}`,
                color: m.role === 'user' ? '#fbbf24' : 'var(--text-mid)',
              }}>
              {m.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-2">
            <div className="w-6 h-6 rounded-lg shrink-0 flex items-center justify-center text-xs font-bold"
              style={{ background: '#7c3aed18', border: '1px solid #7c3aed40', color: '#a78bfa' }}>
              AI
            </div>
            <div className="text-xs rounded-xl px-3 py-2 flex items-center gap-1"
              style={{ background: '#ffffff08', border: '1px solid var(--border)', color: 'var(--text-lo)' }}>
              <span className="animate-pulse">●</span>
              <span className="animate-pulse" style={{ animationDelay: '0.2s' }}>●</span>
              <span className="animate-pulse" style={{ animationDelay: '0.4s' }}>●</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="px-5 pb-4 pt-2 shrink-0" style={{ borderTop: '1px solid var(--border-dim)' }}>
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
            placeholder="Ask about the market, positions, or a specific token…"
            className="flex-1 rounded-lg px-3 py-2 text-xs outline-none"
            style={{ background: '#ffffff08', border: '1px solid var(--border)', color: 'var(--text-hi)' }}
          />
          <button onClick={() => sendMessage(input)} disabled={loading || !input.trim()}
            className="px-3 py-2 rounded-lg text-xs font-bold"
            style={{
              background: input.trim() ? '#7c3aed' : '#7c3aed20',
              color: input.trim() ? '#fff' : '#7c3aed',
              border: 'none',
              cursor: (loading || !input.trim()) ? 'not-allowed' : 'pointer',
              opacity: (loading || !input.trim()) ? 0.5 : 1,
            }}>
            ↑
          </button>
        </div>
      </div>
    </div>
  );
}
