import { useState, useEffect, useCallback } from 'react';
import { api, CAT, fmt, currentMonth } from '../api';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';

const CATEGORIES = Object.entries(CAT);

export default function Budget() {
    const { user } = useAuth();
    const toast = useToast();
    const month = currentMonth();

    const [budgets, setBudgets] = useState([]);
    const [overview, setOverview] = useState(null);
    const [income, setIncomeVal] = useState('');
    const [loading, setLoading] = useState(true);
    const [savingIncome, setSavingIncome] = useState(false);
    const [editCat, setEditCat] = useState(null);   // category key being edited
    const [editAmt, setEditAmt] = useState('');
    const [savingBudget, setSavingBudget] = useState(false);
    const [tab, setTab] = useState('budgets'); // 'budgets' | 'zbb'

    const load = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        try {
            const [buds, ov, inc] = await Promise.all([
                api.getBudgets(user.id),
                api.getZBBOverview(user.id, month),
                api.getIncome(user.id, month),
            ]);
            setBudgets(buds);
            setOverview(ov);
            if (inc?.amount) setIncomeVal(String(inc.amount));
        } catch (e) {
            toast(e.message, 'error');
        } finally {
            setLoading(false);
        }
    }, [user, month]);

    useEffect(() => { load(); }, [load]);

    const saveIncome = async () => {
        if (!income || isNaN(income) || Number(income) <= 0) return toast('Enter a valid income', 'error');
        setSavingIncome(true);
        try {
            await api.setIncome({ user_id: user.id, month, amount: Number(income) });
            toast('Income saved ✓', 'success');
            await load();
        } catch (e) {
            toast(e.message, 'error');
        } finally {
            setSavingIncome(false);
        }
    };

    const openEdit = (catKey) => {
        const existing = budgets.find(b => b.category === catKey);
        setEditAmt(existing ? String(existing.monthly_limit) : '');
        setEditCat(catKey);
    };

    const saveBudget = async () => {
        if (!editAmt || isNaN(editAmt) || Number(editAmt) < 0) return toast('Enter a valid amount', 'error');
        setSavingBudget(true);
        try {
            await api.upsertBudget({
                user_id: user.id,
                category: editCat,
                monthly_limit: Number(editAmt),
            });
            toast(`${CAT[editCat]?.label} budget saved ✓`, 'success');
            setEditCat(null);
            await load();
        } catch (e) {
            toast(e.message, 'error');
        } finally {
            setSavingBudget(false);
        }
    };

    const removeBudget = async (id) => {
        try {
            await api.deleteBudget(id);
            toast('Budget removed', 'success');
            await load();
        } catch (e) {
            toast(e.message, 'error');
        }
    };

    if (loading) {
        return (
            <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ textAlign: 'center' }}>
                    <div className="spinner" style={{ width: 32, height: 32, margin: '0 auto 1rem' }} />
                    <p className="text-muted mono" style={{ fontSize: '.7rem', letterSpacing: '.1em' }}>LOADING BUDGETS…</p>
                </div>
            </div>
        );
    }

    return (
        <div className="page" style={{ maxWidth: 820 }}>
            {/* Header */}
            <div style={{ marginBottom: '1.75rem', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <p className="mono text-muted" style={{ fontSize: '.62rem', letterSpacing: '.12em', textTransform: 'uppercase', marginBottom: '.3rem' }}>Finance Control</p>
                    <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.9rem', fontWeight: 800 }}>Budget & ZBB</h1>
                </div>
                {/* Tab switch */}
                <div style={{ display: 'flex', gap: '.5rem' }}>
                    {['budgets', 'zbb'].map(t => (
                        <button
                            key={t}
                            onClick={() => setTab(t)}
                            className={`btn ${tab === t ? 'btn-primary' : 'btn-ghost'}`}
                            style={{ fontSize: '.68rem', padding: '7px 16px' }}
                        >
                            {t === 'budgets' ? '⊡ Budgets' : '◈ ZBB Overview'}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── BUDGETS TAB ─────────────────────────────────── */}
            {tab === 'budgets' && (
                <>
                    {/* Income card */}
                    <div className="card" style={{ marginBottom: '1.5rem' }}>
                        <div className="card-inner">
                            <div className="section-header">
                                <div className="section-title"><span className="dot" style={{ background: 'var(--gold)' }} /> Monthly Income</div>
                                <span className="mono text-muted" style={{ fontSize: '.6rem' }}>{month}</span>
                            </div>
                            <div style={{ display: 'flex', gap: '.75rem', alignItems: 'center', marginTop: '.5rem' }}>
                                <div style={{ position: 'relative', flex: 1, maxWidth: 280 }}>
                                    <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-2)', fontSize: '.9rem', pointerEvents: 'none' }}>₹</span>
                                    <input
                                        type="number" min="0" step="100"
                                        placeholder="Enter monthly income"
                                        value={income}
                                        onChange={e => setIncomeVal(e.target.value)}
                                        style={{ paddingLeft: '1.75rem' }}
                                    />
                                </div>
                                <button className="btn btn-primary" onClick={saveIncome} disabled={savingIncome} style={{ fontSize: '.68rem' }}>
                                    {savingIncome ? <span className="spinner" style={{ width: 14, height: 14 }} /> : '✓ Save'}
                                </button>
                            </div>
                            {overview && overview.total_income > 0 && (
                                <div style={{ marginTop: '.75rem', display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                                    {[
                                        { label: 'Income', val: overview.total_income, color: 'var(--green)' },
                                        { label: 'Allocated', val: overview.total_allocated, color: 'var(--cyan)' },
                                        { label: 'Spent', val: overview.total_spent, color: 'var(--gold)' },
                                        { label: 'Unallocated', val: overview.unallocated, color: 'var(--purple)' },
                                    ].map(s => (
                                        <div key={s.label}>
                                            <div className="mono text-muted" style={{ fontSize: '.58rem', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 2 }}>{s.label}</div>
                                            <div className="mono" style={{ fontSize: '.95rem', fontWeight: 700, color: s.color }}>{fmt(s.val)}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Category budgets grid */}
                    <div className="card">
                        <div className="card-inner">
                            <div className="section-header" style={{ marginBottom: '1.25rem' }}>
                                <div className="section-title"><span className="dot" style={{ background: 'var(--purple)' }} /> Category Limits</div>
                                <span className="mono text-muted" style={{ fontSize: '.6rem' }}>{budgets.length} set</span>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '.85rem' }}>
                                {CATEGORIES.map(([key, c]) => {
                                    const b = budgets.find(x => x.category === key);
                                    const env = overview?.envelopes?.find(e => e.category === key);
                                    const pct = env ? Math.min(env.pct_used, 100) : 0;
                                    const over = env && env.spent > env.monthly_limit;
                                    return (
                                        <div
                                            key={key}
                                            style={{
                                                background: 'var(--s3)',
                                                border: `1px solid ${b ? c.color + '33' : 'var(--border)'}`,
                                                borderRadius: 'var(--r-sm)',
                                                padding: '12px 14px',
                                                transition: 'border-color .15s',
                                            }}
                                        >
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: b ? '.6rem' : 0 }}>
                                                <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: '.88rem' }}>
                                                    <span>{c.icon}</span>
                                                    <span style={{ color: b ? c.color : 'var(--text-2)' }}>{c.label}</span>
                                                </span>
                                                <div style={{ display: 'flex', gap: 4 }}>
                                                    <button
                                                        className="btn btn-ghost"
                                                        style={{ padding: '3px 8px', fontSize: '.58rem' }}
                                                        onClick={() => openEdit(key)}
                                                    >
                                                        {b ? 'Edit' : '+ Set'}
                                                    </button>
                                                    {b && (
                                                        <button
                                                            className="btn btn-ghost"
                                                            style={{ padding: '3px 6px', fontSize: '.65rem', color: 'var(--red, #f87171)' }}
                                                            onClick={() => removeBudget(b.id)}
                                                        >✕</button>
                                                    )}
                                                </div>
                                            </div>
                                            {b && (
                                                <>
                                                    <div className="budget-bar-wrap">
                                                        <div className="budget-bar-fill" style={{ width: `${pct}%`, background: over ? 'var(--red, #f87171)' : c.color }} />
                                                    </div>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '.35rem' }}>
                                                        <span className="mono text-muted" style={{ fontSize: '.6rem' }}>
                                                            {env ? fmt(env.spent) : '₹0'} spent
                                                        </span>
                                                        <span className="mono" style={{ fontSize: '.6rem', color: over ? 'var(--red, #f87171)' : c.color, fontWeight: 600 }}>
                                                            / {fmt(b.monthly_limit)}
                                                        </span>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* ── ZBB OVERVIEW TAB ─────────────────────────────── */}
            {tab === 'zbb' && overview && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    {/* Summary */}
                    <div className="stat-grid">
                        {[
                            { label: '⬡ Total Income', val: fmt(overview.total_income), color: 'green', sub: month },
                            { label: '⬡ Allocated', val: fmt(overview.total_allocated), color: 'cyan', sub: `${overview.total_income > 0 ? ((overview.total_allocated / overview.total_income) * 100).toFixed(0) : 0}% of income` },
                            { label: '⬡ Total Spent', val: fmt(overview.total_spent), color: 'gold', sub: `${overview.total_allocated > 0 ? ((overview.total_spent / overview.total_allocated) * 100).toFixed(0) : 0}% of budget` },
                            { label: '⬡ Unallocated', val: fmt(Math.max(0, overview.unallocated)), color: 'purple', sub: overview.unallocated < 0 ? '⚠ Over-allocated' : 'available to assign' },
                        ].map(s => (
                            <div key={s.label} className={`stat-card ${s.color}`}>
                                <div className="stat-label">{s.label}</div>
                                <div className={`stat-value text-${s.color}`}>{s.val}</div>
                                <div className="stat-sub">{s.sub}</div>
                            </div>
                        ))}
                    </div>

                    {/* Envelopes */}
                    {overview.envelopes.length === 0 ? (
                        <div className="card">
                            <div className="card-inner">
                                <div className="empty">
                                    <div className="empty-icon">⊡</div>
                                    <p>No budget envelopes yet — set some limits in the Budgets tab.</p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="card">
                            <div className="card-inner">
                                <div className="section-header" style={{ marginBottom: '1.25rem' }}>
                                    <div className="section-title"><span className="dot" style={{ background: 'var(--cyan)' }} /> Envelope Status</div>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '.85rem' }}>
                                    {overview.envelopes.map(env => {
                                        const c = CAT[env.category] || CAT.other;
                                        const pct = Math.min(env.pct_used, 100);
                                        const over = env.spent > env.monthly_limit;
                                        return (
                                            <div key={env.category} style={{ background: 'var(--s3)', borderRadius: 'var(--r-sm)', padding: '12px 14px' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '.6rem' }}>
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '.9rem' }}>
                                                        {c.icon} <span style={{ color: c.color, fontWeight: 500 }}>{c.label}</span>
                                                    </span>
                                                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                                        <span className="mono text-muted" style={{ fontSize: '.62rem' }}>
                                                            Remaining: <span style={{ color: over ? 'var(--red, #f87171)' : 'var(--green)' }}>{fmt(Math.max(0, env.remaining))}</span>
                                                        </span>
                                                        <span className="mono" style={{ fontSize: '.68rem', color: over ? 'var(--red, #f87171)' : c.color, fontWeight: 700 }}>
                                                            {pct.toFixed(0)}%
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="budget-bar-wrap" style={{ height: 7 }}>
                                                    <div className="budget-bar-fill" style={{ width: `${pct}%`, background: over ? 'var(--red, #f87171)' : c.color, height: '100%' }} />
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '.4rem' }}>
                                                    <span className="mono text-muted" style={{ fontSize: '.58rem' }}>Spent: {fmt(env.spent)}</span>
                                                    <span className="mono text-muted" style={{ fontSize: '.58rem' }}>Allocated: {fmt(env.allocated)}</span>
                                                    <span className="mono text-muted" style={{ fontSize: '.58rem' }}>Limit: {fmt(env.monthly_limit)}</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Edit budget modal */}
            {editCat && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(8px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                    <div className="card" style={{ width: '100%', maxWidth: 380 }}>
                        <div className="card-inner">
                            <div style={{ marginBottom: '1.25rem' }}>
                                <div style={{ fontSize: '1.5rem', marginBottom: '.5rem' }}>{CAT[editCat]?.icon}</div>
                                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', fontWeight: 700 }}>{CAT[editCat]?.label} Budget</h2>
                                <p className="text-muted" style={{ fontSize: '.82rem' }}>Set monthly spending limit</p>
                            </div>
                            <div className="field" style={{ marginBottom: '1rem' }}>
                                <label>Monthly Limit (₹)</label>
                                <input
                                    type="number" min="0" step="100"
                                    placeholder="e.g. 5000"
                                    value={editAmt}
                                    onChange={e => setEditAmt(e.target.value)}
                                    autoFocus
                                    onKeyDown={e => e.key === 'Enter' && saveBudget()}
                                />
                            </div>
                            <div style={{ display: 'flex', gap: '.75rem', justifyContent: 'flex-end' }}>
                                <button className="btn btn-ghost" onClick={() => setEditCat(null)}>Cancel</button>
                                <button className="btn btn-primary" onClick={saveBudget} disabled={savingBudget}>
                                    {savingBudget ? <span className="spinner" style={{ width: 14, height: 14 }} /> : '✓ Save Budget'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Tip */}
            <div style={{ marginTop: '1.25rem', padding: '12px 16px', background: 'var(--cyan-glow)', border: '1px solid var(--cyan-border)', borderRadius: 'var(--r-sm)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span>◈</span>
                <p style={{ fontSize: '.82rem', color: 'var(--text-2)', lineHeight: 1.5 }}>
                    <strong style={{ color: 'var(--cyan)' }}>Zero-Based Budgeting</strong> — assign every rupee of income to a category envelope so your income minus allocations equals zero.
                </p>
            </div>
        </div>
    );
}