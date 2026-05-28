import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, CAT } from '../api';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';

const CATEGORIES = Object.entries(CAT);

export default function AddExpense() {
    const { user } = useAuth();
    const toast = useToast();
    const navigate = useNavigate();

    const [form, setForm] = useState({
        description: '',
        amount: '',
        category: '',
        date: new Date().toISOString().slice(0, 10),
    });
    const [classifying, setClassifying] = useState(false);
    const [suggestion, setSuggestion] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const debounceRef = useRef(null);

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    // Auto-classify on description change
    useEffect(() => {
        if (form.description.length < 3) { setSuggestion(null); return; }
        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(async () => {
            setClassifying(true);
            try {
                const res = await api.classify(form.description);
                setSuggestion(res);
                if (res.confidence > 0.5 && !form.category) {
                    set('category', res.category);
                }
            } catch { } finally {
                setClassifying(false);
            }
        }, 600);
    }, [form.description]);

    const submit = async () => {
        if (!form.description.trim()) return toast('Add a description', 'error');
        if (!form.amount || isNaN(form.amount) || Number(form.amount) <= 0) return toast('Enter a valid amount', 'error');
        if (!form.category) return toast('Select a category', 'error');
        setSubmitting(true);
        try {
            await api.addExpense({
                description: form.description.trim(),
                amount: Number(form.amount),
                category: form.category,
                date: form.date,
                user_id: user.id,
            });
            toast('Expense added! 🎉', 'success');
            // Check gamification
            try { await api.checkGamification(user.id); } catch { }
            navigate('/');
        } catch (e) {
            toast(e.message, 'error');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="page" style={{ maxWidth: 680 }}>
            {/* Header */}
            <div style={{ marginBottom: '2rem' }}>
                <p className="mono text-muted" style={{ fontSize: '.62rem', letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: '.3rem' }}>New Entry</p>
                <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.9rem', fontWeight: 800 }}>Add Expense</h1>
            </div>

            <div className="card">
                <div className="card-inner" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    {/* Description + AI classify */}
                    <div className="field">
                        <label>Description</label>
                        <div style={{ position: 'relative' }}>
                            <input
                                type="text"
                                placeholder="e.g. Lunch at Saravana Bhavan"
                                value={form.description}
                                onChange={e => set('description', e.target.value)}
                                style={{ paddingRight: classifying ? '2.5rem' : undefined }}
                            />
                            {classifying && (
                                <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)' }}>
                                    <div className="spinner" style={{ width: 14, height: 14, borderWidth: 1.5 }} />
                                </div>
                            )}
                        </div>
                        {suggestion && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'var(--cyan-glow)', border: '1px solid var(--cyan-border)', borderRadius: 'var(--r-sm)', marginTop: '.25rem' }}>
                                <span style={{ fontSize: '.85rem' }}>{CAT[suggestion.category]?.icon}</span>
                                <span className="mono" style={{ fontSize: '.62rem', color: 'var(--cyan)' }}>
                                    AI suggests: <strong>{CAT[suggestion.category]?.label}</strong>
                                </span>
                                <span className="mono text-muted" style={{ fontSize: '.58rem', marginLeft: 'auto' }}>
                                    {(suggestion.confidence * 100).toFixed(0)}% confident
                                </span>
                                {form.category !== suggestion.category && (
                                    <button
                                        className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: '.58rem', marginLeft: 4 }}
                                        onClick={() => set('category', suggestion.category)}
                                    >
                                        Apply
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Amount + Date row */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div className="field">
                            <label>Amount (₹)</label>
                            <input
                                type="number" min="0" step="0.01"
                                placeholder="0.00"
                                value={form.amount}
                                onChange={e => set('amount', e.target.value)}
                            />
                        </div>
                        <div className="field">
                            <label>Date</label>
                            <input
                                type="date"
                                value={form.date}
                                onChange={e => set('date', e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Category picker */}
                    <div className="field">
                        <label>Category</label>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '.5rem' }}>
                            {CATEGORIES.map(([key, c]) => (
                                <button
                                    key={key}
                                    onClick={() => set('category', key)}
                                    style={{
                                        background: form.category === key ? c.color + '22' : 'var(--s3)',
                                        border: `1px solid ${form.category === key ? c.color + '55' : 'var(--border)'}`,
                                        borderRadius: 'var(--r-sm)',
                                        padding: '.7rem .5rem',
                                        cursor: 'pointer',
                                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                                        transition: 'all .15s',
                                        color: form.category === key ? c.color : 'var(--text-2)',
                                    }}
                                >
                                    <span style={{ fontSize: '1.2rem' }}>{c.icon}</span>
                                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '.55rem', letterSpacing: '.05em', textTransform: 'uppercase' }}>
                                        {c.label}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="divider" />

                    <div style={{ display: 'flex', gap: '.75rem', justifyContent: 'flex-end' }}>
                        <button className="btn btn-ghost" onClick={() => navigate('/')}>Cancel</button>
                        <button className="btn btn-primary" onClick={submit} disabled={submitting}>
                            {submitting ? <span className="spinner" style={{ width: 14, height: 14 }} /> : '✓ Save Expense'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Recent tip */}
            <div style={{ marginTop: '1.25rem', padding: '12px 16px', background: 'var(--gold-glow)', border: '1px solid rgba(251,191,36,.15)', borderRadius: 'var(--r-sm)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span>✦</span>
                <p style={{ fontSize: '.82rem', color: 'var(--text-2)', lineHeight: 1.5 }}>
                    <strong className="text-gold">AI auto-classify</strong> — just type a description and the AI will suggest the right category for you automatically.
                </p>
            </div>
        </div>
    );
}