import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../api';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';

const SUGGESTIONS = [
    'How much did I spend on food this month?',
    'What is my biggest expense category?',
    'Am I over budget anywhere?',
    'Give me tips to reduce my spending.',
    'Summarise my last 30 days of expenses.',
];

export default function Aria() {
    const { user } = useAuth();
    const toast = useToast();

    const [messages, setMessages] = useState([
        {
            role: 'assistant',
            content: `Hey ${user?.name?.split(' ')[0] || 'there'} 👋 I'm **Aria**, your AI finance advisor.\n\nI have full visibility into your expense history and budgets. Ask me anything — spending trends, budget advice, saving tips, or just a quick summary of where your money's going.`,
        },
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const bottomRef = useRef(null);
    const inputRef = useRef(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const send = useCallback(async (text) => {
        const msg = (text || input).trim();
        if (!msg || loading) return;
        setInput('');

        const userMsg = { role: 'user', content: msg };
        const history = messages.slice(1); // exclude the greeting
        setMessages(prev => [...prev, userMsg, { role: 'assistant', content: null }]);
        setLoading(true);

        try {
            const res = await api.chat({
                user_id: user.id,
                message: msg,
                history: history.map(m => ({ role: m.role, content: m.content })),
            });
            setMessages(prev => {
                const copy = [...prev];
                copy[copy.length - 1] = { role: 'assistant', content: res.reply };
                return copy;
            });
        } catch (e) {
            toast(e.message, 'error');
            setMessages(prev => prev.slice(0, -1)); // remove the placeholder
        } finally {
            setLoading(false);
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [input, loading, messages, user, toast]);

    // Simple markdown-lite renderer: bold and newlines
    const renderContent = (text) => {
        if (!text) return null;
        return text.split('\n').map((line, i) => {
            const parts = line.split(/\*\*(.*?)\*\*/g);
            return (
                <span key={i}>
                    {parts.map((p, j) => j % 2 === 1 ? <strong key={j}>{p}</strong> : p)}
                    {i < text.split('\n').length - 1 && <br />}
                </span>
            );
        });
    };

    return (
        <div className="page" style={{ maxWidth: 780, display: 'flex', flexDirection: 'column', height: 'calc(100vh - 80px)' }}>
            {/* Header */}
            <div style={{ marginBottom: '1.25rem', flexShrink: 0 }}>
                <p className="mono text-muted" style={{ fontSize: '.62rem', letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: '.3rem' }}>AI Finance Advisor</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div className="brand-icon" style={{ width: 40, height: 40, fontSize: '1.1rem', borderRadius: 12, background: 'linear-gradient(135deg, rgba(168,139,250,.25), rgba(56,189,248,.15))', border: '1px solid rgba(168,139,250,.3)' }}>✦</div>
                    <div>
                        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.9rem', fontWeight: 800, lineHeight: 1 }}>Aria</h1>
                        <p className="mono text-muted" style={{ fontSize: '.62rem', letterSpacing: '.06em' }}>powered by Groq · Llama 3.3</p>
                    </div>
                    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', background: 'rgba(52,211,153,.08)', border: '1px solid rgba(52,211,153,.2)', borderRadius: 20 }}>
                        <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--green)', boxShadow: '0 0 6px var(--green)' }} />
                        <span className="mono" style={{ fontSize: '.6rem', color: 'var(--green)' }}>Online</span>
                    </div>
                </div>
            </div>

            {/* Messages */}
            <div style={{
                flex: 1,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '.85rem',
                padding: '.25rem 0',
                scrollbarWidth: 'thin',
                scrollbarColor: 'var(--border) transparent',
            }}>
                {messages.map((m, i) => (
                    <div
                        key={i}
                        style={{
                            display: 'flex',
                            gap: 10,
                            flexDirection: m.role === 'user' ? 'row-reverse' : 'row',
                            alignItems: 'flex-start',
                        }}
                    >
                        {/* Avatar */}
                        <div style={{
                            width: 32, height: 32, borderRadius: 10, flexShrink: 0,
                            background: m.role === 'user'
                                ? 'linear-gradient(135deg, rgba(56,189,248,.25), rgba(56,189,248,.1))'
                                : 'linear-gradient(135deg, rgba(168,139,250,.25), rgba(56,189,248,.15))',
                            border: `1px solid ${m.role === 'user' ? 'rgba(56,189,248,.3)' : 'rgba(168,139,250,.3)'}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '.8rem', fontWeight: 700, fontFamily: 'var(--font-display)',
                            color: m.role === 'user' ? 'var(--cyan)' : 'var(--purple)',
                        }}>
                            {m.role === 'user' ? (user?.name?.[0]?.toUpperCase() || 'U') : '✦'}
                        </div>

                        {/* Bubble */}
                        <div style={{
                            maxWidth: '72%',
                            padding: '10px 14px',
                            borderRadius: m.role === 'user' ? '14px 4px 14px 14px' : '4px 14px 14px 14px',
                            background: m.role === 'user'
                                ? 'linear-gradient(135deg, rgba(56,189,248,.15), rgba(56,189,248,.08))'
                                : 'var(--s2)',
                            border: `1px solid ${m.role === 'user' ? 'rgba(56,189,248,.2)' : 'var(--border)'}`,
                            fontSize: '.88rem',
                            lineHeight: 1.6,
                            color: 'var(--text)',
                        }}>
                            {m.content === null ? (
                                <div style={{ display: 'flex', gap: 5, alignItems: 'center', padding: '2px 0' }}>
                                    {[0, 1, 2].map(j => (
                                        <div key={j} style={{
                                            width: 6, height: 6, borderRadius: '50%',
                                            background: 'var(--purple)',
                                            animation: `pulse 1.2s ease-in-out ${j * 0.2}s infinite`,
                                            opacity: 0.7,
                                        }} />
                                    ))}
                                    <style>{`@keyframes pulse { 0%,100%{transform:scale(1);opacity:.4} 50%{transform:scale(1.4);opacity:1} }`}</style>
                                </div>
                            ) : renderContent(m.content)}
                        </div>
                    </div>
                ))}
                <div ref={bottomRef} />
            </div>

            {/* Suggestions (shown only at start) */}
            {messages.length <= 1 && (
                <div style={{ flexShrink: 0, display: 'flex', flexWrap: 'wrap', gap: '.5rem', margin: '.75rem 0' }}>
                    {SUGGESTIONS.map(s => (
                        <button
                            key={s}
                            className="btn btn-ghost"
                            style={{ fontSize: '.72rem', padding: '6px 12px', borderRadius: 20, textAlign: 'left' }}
                            onClick={() => send(s)}
                        >
                            {s}
                        </button>
                    ))}
                </div>
            )}

            {/* Input */}
            <div style={{
                flexShrink: 0,
                display: 'flex',
                gap: '.75rem',
                padding: '.85rem',
                marginTop: '.5rem',
                background: 'var(--s2)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--r)',
            }}>
                <input
                    ref={inputRef}
                    type="text"
                    placeholder="Ask Aria about your finances…"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
                    disabled={loading}
                    style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', padding: '2px 4px', fontSize: '.9rem', color: 'var(--text)' }}
                />
                <button
                    className="btn btn-primary"
                    onClick={() => send()}
                    disabled={loading || !input.trim()}
                    style={{ padding: '8px 18px', fontSize: '.72rem', flexShrink: 0 }}
                >
                    {loading ? <span className="spinner" style={{ width: 14, height: 14 }} /> : 'Send ↑'}
                </button>
            </div>
        </div>
    );
}