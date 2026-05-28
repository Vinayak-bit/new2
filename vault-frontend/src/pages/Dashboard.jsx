import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
    PieChart, Pie, Cell, Customized, ResponsiveContainer,
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip
} from 'recharts';
import { api, CAT, fmt, currentMonth } from '../api';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function DonutCenter({ cx, cy, hovered, total }) {
    const d = hovered;
    return (
        <g>
            <text x={cx} y={cy - 10} textAnchor="middle" fill={d ? '#ffffff' : '#94a3b8'} fontSize={d ? 11 : 10} fontFamily="JetBrains Mono" fontWeight={700}>
                {d ? d.name : 'Total'}
            </text>
            <text x={cx} y={cy + 10} textAnchor="middle" fill="#e2e8f0" fontSize={13} fontFamily="JetBrains Mono" fontWeight={700}>
                {d ? fmt(d.value) : fmt(total)}
            </text>
        </g>
    );
}

export default function Dashboard() {
    const { user } = useAuth();
    const toast = useToast();
    const [expenses, setExpenses] = useState([]);
    const [budgets, setBudgets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const [search, setSearch] = useState('');
    const [streaks, setStreaks] = useState([]);
    const [achievements, setAchievements] = useState([]);
    const [hoveredSlice, setHoveredSlice] = useState(null);

    const load = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        try {
            const [exps, buds, strs, achs] = await Promise.all([
                api.getExpenses(user.id),
                api.getBudgets(user.id),
                api.getStreaks(user.id),
                api.getAchievements(user.id),
            ]);
            setExpenses(exps);
            setBudgets(buds);
            setStreaks(strs);
            setAchievements(achs.slice(0, 6));
        } catch (e) {
            toast(e.message, 'error');
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => { load(); }, [load]);

    // Derived
    const month = currentMonth();
    const monthExps = expenses.filter(e => e.date.startsWith(month));
    const totalMonth = monthExps.reduce((s, e) => s + e.amount, 0);
    const totalAll = expenses.reduce((s, e) => s + e.amount, 0);

    // Previous month
    const prevMonth = (() => {
        const d = new Date(); d.setMonth(d.getMonth() - 1);
        return d.toISOString().slice(0, 7);
    })();
    const prevMonthTotal = expenses.filter(e => e.date.startsWith(prevMonth)).reduce((s, e) => s + e.amount, 0);
    const momDiff = prevMonthTotal ? ((totalMonth - prevMonthTotal) / prevMonthTotal * 100) : 0;

    // Category summary this month
    const catSummary = Object.entries(
        monthExps.reduce((acc, e) => {
            acc[e.category] = (acc[e.category] || 0) + e.amount;
            return acc;
        }, {})
    ).sort((a, b) => b[1] - a[1]);

    // Donut data
    const donutData = catSummary.map(([cat, val]) => ({
        name: CAT[cat]?.label || cat,
        value: val,
        color: CAT[cat]?.color || '#94a3b8',
    }));

    // Area chart: daily spending current month
    const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
    const dailyData = Array.from({ length: daysInMonth }, (_, i) => {
        const day = String(i + 1).padStart(2, '0');
        const dateStr = `${month}-${day}`;
        const amt = monthExps.filter(e => e.date === dateStr).reduce((s, e) => s + e.amount, 0);
        return { day: i + 1, amount: amt };
    });

    // Filtered expense list
    const filtered = expenses
        .filter(e => {
            if (filter !== 'all' && e.category !== filter) return false;
            if (search && !e.description.toLowerCase().includes(search.toLowerCase())) return false;
            return true;
        })
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 50);

    const deleteExp = async (id) => {
        try {
            await api.deleteExpense(id);
            setExpenses(prev => prev.filter(e => e.id !== id));
            toast('Expense deleted', 'success');
        } catch (e) {
            toast(e.message, 'error');
        }
    };

    const categories = [...new Set(expenses.map(e => e.category))];

    if (loading) {
        return (
            <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ textAlign: 'center' }}>
                    <div className="spinner" style={{ width: 32, height: 32, margin: '0 auto 1rem' }} />
                    <p className="text-muted mono" style={{ fontSize: '.7rem', letterSpacing: '.1em' }}>LOADING VAULT…</p>
                </div>
            </div>
        );
    }

    return (
        <div className="page">
            {/* Header */}
            <div style={{ marginBottom: '1.75rem', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <p className="mono" style={{ fontSize: '.62rem', letterSpacing: '.12em', color: 'var(--text-2)', textTransform: 'uppercase', marginBottom: '.3rem' }}>
                        {MONTHS[new Date().getMonth()]} {new Date().getFullYear()}
                    </p>
                    <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.9rem', fontWeight: 800 }}>
                        Hey, {user?.name?.split(' ')[0]} 👋
                    </h1>
                </div>
                <Link to="/add" className="btn btn-primary">+ Add Expense</Link>
            </div>

            {/* Stat cards */}
            <div className="stat-grid">
                <div className="stat-card cyan">
                    <div className="stat-label">⬡ This month</div>
                    <div className="stat-value text-cyan">{fmt(totalMonth)}</div>
                    <div className="stat-sub">
                        {momDiff > 0 ? `▲ ${momDiff.toFixed(0)}% vs last month` :
                            momDiff < 0 ? `▼ ${Math.abs(momDiff).toFixed(0)}% vs last month` : 'Same as last month'}
                    </div>
                </div>
                <div className="stat-card gold">
                    <div className="stat-label">⬡ All time</div>
                    <div className="stat-value text-gold">{fmt(totalAll)}</div>
                    <div className="stat-sub">{expenses.length} transactions</div>
                </div>
                <div className="stat-card green">
                    <div className="stat-label">⬡ Transactions</div>
                    <div className="stat-value text-green">{monthExps.length}</div>
                    <div className="stat-sub">this month</div>
                </div>
                <div className="stat-card purple">
                    <div className="stat-label">⬡ Avg / day</div>
                    <div className="stat-value text-purple">
                        {fmt(totalMonth / new Date().getDate())}
                    </div>
                    <div className="stat-sub">daily burn rate</div>
                </div>
            </div>

            {/* Charts row */}
            <div className="grid-2" style={{ marginBottom: '1.5rem' }}>
                {/* Area chart */}
                <div className="card">
                    <div className="card-inner">
                        <div className="section-header">
                            <div className="section-title"><span className="dot" /> Daily Spending</div>
                            <span className="mono text-muted" style={{ fontSize: '.6rem' }}>{month}</span>
                        </div>
                        <ResponsiveContainer width="100%" height={180}>
                            <AreaChart data={dailyData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.25} />
                                        <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.04)" />
                                <XAxis dataKey="day" tick={{ fill: '#3d5068', fontSize: 9, fontFamily: 'JetBrains Mono' }} tickLine={false} axisLine={false} interval={6} />
                                <YAxis tick={{ fill: '#3d5068', fontSize: 9, fontFamily: 'JetBrains Mono' }} tickLine={false} axisLine={false} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                                <Tooltip
                                    contentStyle={{ background: '#0d1420', border: '1px solid rgba(56,189,248,.2)', borderRadius: 8, fontFamily: 'JetBrains Mono', fontSize: 11 }}
                                    labelStyle={{ color: '#94a3b8' }}
                                    formatter={v => [fmt(v), 'Spent']}
                                />
                                <Area type="monotone" dataKey="amount" stroke="#38bdf8" strokeWidth={1.8} fill="url(#spendGrad)" dot={false} activeDot={{ r: 4, fill: '#38bdf8', strokeWidth: 0 }} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Donut chart */}
                <div className="card">
                    <div className="card-inner">
                        <div className="section-header">
                            <div className="section-title"><span className="dot" style={{ background: 'var(--gold)' }} /> By Category</div>
                        </div>
                        {donutData.length > 0 ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <div style={{ position: 'relative', width: 160, height: 160, flexShrink: 0 }}>
                                    <ResponsiveContainer width={160} height={160}>
                                        <PieChart>
                                            <Pie
                                                data={donutData}
                                                cx="50%" cy="50%"
                                                innerRadius={48} outerRadius={72}
                                                paddingAngle={2}
                                                dataKey="value"
                                                strokeWidth={0}
                                                onMouseLeave={() => setHoveredSlice(null)}
                                            >
                                                {donutData.map((d, i) => (
                                                    <Cell
                                                        key={i}
                                                        fill="#ffffff" // ✅ Changed pie slice color to White
                                                        opacity={hoveredSlice && hoveredSlice.name !== d.name ? 0.35 : 1}
                                                        onMouseEnter={() => setHoveredSlice(d)}
                                                        style={{ cursor: 'pointer' }}
                                                    />
                                                ))}
                                            </Pie>
                                        </PieChart>
                                    </ResponsiveContainer>
                                    {/* Center label */}
                                    <div style={{
                                        position: 'absolute', top: '50%', left: '50%',
                                        transform: 'translate(-50%, -50%)',
                                        textAlign: 'center', pointerEvents: 'none',
                                        zIndex: 10
                                    }}>
                                        {hoveredSlice ? (
                                            <>
                                                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '.68rem', color: '#ffffff', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 2 }}>
                                                    {hoveredSlice.name}
                                                </div>
                                                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '.95rem', color: '#e2e8f0', fontWeight: 700 }}>
                                                    {fmt(hoveredSlice.value)}
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '.52rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 2 }}>
                                                    Total
                                                </div>
                                                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '.78rem', color: '#e2e8f0', fontWeight: 700 }}>
                                                    {fmt(totalMonth)}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '.5rem', minWidth: 0 }}>
                                    {donutData.slice(0, 5).map((d, i) => (
                                        <div
                                            key={i}
                                            style={{ display: 'flex', alignItems: 'center', gap: '.5rem', cursor: 'pointer', opacity: hoveredSlice && hoveredSlice.name !== d.name ? 0.35 : 1, transition: 'opacity .15s' }}
                                            onMouseEnter={() => setHoveredSlice(d)}
                                            onMouseLeave={() => setHoveredSlice(null)}
                                        >
                                            <div style={{ width: 8, height: 8, borderRadius: 2, background: d.color, flexShrink: 0 }} />
                                            <span style={{ fontSize: '.78rem', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</span>
                                            <span className="mono" style={{ fontSize: '.7rem', color: d.color, fontWeight: 600, flexShrink: 0 }}>{((d.value / totalMonth) * 100).toFixed(0)}%</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="empty"><div className="empty-icon">📊</div><p>No data yet</p></div>
                        )}
                    </div>
                </div>
            </div>

            {/* Budget status */}
            {budgets.length > 0 && (
                <div className="card" style={{ marginBottom: '1.5rem' }}>
                    <div className="card-inner">
                        <div className="section-header">
                            <div className="section-title"><span className="dot" style={{ background: 'var(--purple)' }} /> Budget Status</div>
                            <Link to="/budget" className="btn btn-ghost" style={{ padding: '5px 12px', fontSize: '.6rem' }}>Manage →</Link>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '.85rem' }}>
                            {budgets.map(b => {
                                const c = CAT[b.category] || CAT.other;
                                const spent = monthExps.filter(e => e.category === b.category).reduce((s, e) => s + e.amount, 0);
                                const limit = b.allocated ?? b.monthly_limit;
                                const pct = Math.min((spent / limit) * 100, 100);
                                const over = spent > limit;
                                return (
                                    <div key={b.id} style={{ background: 'var(--s3)', borderRadius: 'var(--r-sm)', padding: '10px 12px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '.5rem', alignItems: 'center' }}>
                                            <span style={{ fontSize: '.8rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                                                {c.icon} {c.label}
                                            </span>
                                            <span className="mono" style={{ fontSize: '.65rem', color: over ? 'var(--red)' : c.color, fontWeight: 600 }}>
                                                {pct.toFixed(0)}%
                                            </span>
                                        </div>
                                        <div className="budget-bar-wrap">
                                            <div className="budget-bar-fill" style={{ width: `${pct}%`, background: over ? 'var(--red)' : c.color }} />
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '.4rem' }}>
                                            <span className="mono text-muted" style={{ fontSize: '.58rem' }}>{fmt(spent)}</span>
                                            <span className="mono text-muted" style={{ fontSize: '.58rem' }}>/ {fmt(limit)}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* Streaks & Achievements */}
            {(streaks.length > 0 || achievements.length > 0) && (
                <div className="grid-2" style={{ marginBottom: '1.5rem' }}>
                    {streaks.length > 0 && (
                        <div className="card">
                            <div className="card-inner">
                                <div className="section-title" style={{ marginBottom: '1rem' }}><span className="dot" style={{ background: 'var(--gold)' }} /> 🔥 Streaks</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '.6rem' }}>
                                    {streaks.filter(s => s.current_streak > 0).slice(0, 5).map(s => {
                                        const c = CAT[s.category] || CAT.other;
                                        return (
                                            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: 'var(--s3)', borderRadius: 'var(--r-sm)' }}>
                                                <span>{c.icon}</span>
                                                <span style={{ fontSize: '.85rem', flex: 1 }}>{c.label}</span>
                                                <span className="mono" style={{ fontSize: '.7rem', color: 'var(--gold)', fontWeight: 700 }}>🔥 {s.current_streak}d</span>
                                                <span className="mono text-muted" style={{ fontSize: '.6rem' }}>best {s.best_streak}</span>
                                            </div>
                                        );
                                    })}
                                    {streaks.filter(s => s.current_streak > 0).length === 0 && (
                                        <p className="text-muted" style={{ fontSize: '.85rem' }}>Stay under budget to build streaks!</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                    {achievements.length > 0 && (
                        <div className="card">
                            <div className="card-inner">
                                <div className="section-title" style={{ marginBottom: '1rem' }}><span className="dot" style={{ background: 'var(--green)' }} /> 🏆 Achievements</div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.5rem' }}>
                                    {achievements.map(a => (
                                        <div key={a.id} title={`${a.badge_name} — ${a.earned_at}`}
                                            style={{ padding: '5px 10px', background: 'var(--gold-glow)', border: '1px solid rgba(251,191,36,.2)', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 5 }}>
                                            <span>{a.badge_icon}</span>
                                            <span className="mono" style={{ fontSize: '.58rem', color: 'var(--gold)' }}>{a.badge_name}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Expense list */}
            <div className="card">
                <div className="card-inner">
                    <div className="section-header">
                        <div className="section-title"><span className="dot" style={{ background: 'var(--teal)' }} /> Transactions</div>
                        <span className="mono text-muted" style={{ fontSize: '.62rem' }}>{filtered.length} shown</span>
                    </div>

                    {/* Search */}
                    <input
                        className="field"
                        style={{ background: 'var(--s3)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', color: 'var(--text)', fontFamily: 'var(--font-body)', fontSize: '.88rem', padding: '9px 13px', outline: 'none', width: '100%', marginBottom: '1rem', boxSizing: 'border-box' }}
                        placeholder="🔍  Search expenses…"
                        value={search} onChange={e => setSearch(e.target.value)}
                    />

                    {/* Filters */}
                    <div className="filter-row">
                        <button className={`filter-chip ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>All</button>
                        {categories.map(cat => {
                            const c = CAT[cat] || CAT.other;
                            return (
                                <button key={cat} className={`filter-chip ${filter === cat ? 'active' : ''}`} onClick={() => setFilter(cat)}>
                                    {c.icon} {c.label}
                                </button>
                            );
                        })}
                    </div>

                    {/* List */}
                    {filtered.length === 0 ? (
                        <div className="empty">
                            <div className="empty-icon">📭</div>
                            <p>{expenses.length === 0 ? 'No expenses yet — add your first one!' : 'No matching expenses found'}</p>
                            {expenses.length === 0 && <Link to="/add" className="btn btn-primary">+ Add Expense</Link>}
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '.25rem' }}>
                            {filtered.map((e, i) => {
                                const c = CAT[e.category] || CAT.other;
                                return (
                                    <div key={e.id} className="exp-item" style={{ animationDelay: `${i * 0.025}s` }}>
                                        <div className="exp-icon" style={{ background: c.color + '22' }}>{c.icon}</div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div className="exp-desc" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.description}</div>
                                            <div className="exp-meta">
                                                <span className="cat-badge" style={{ background: c.color + '18', color: c.color }}>{c.label}</span>
                                                <span className="exp-date">{e.date}</span>
                                            </div>
                                        </div>
                                        <div className="exp-amount" style={{ color: c.color }}>{fmt(e.amount)}</div>
                                        <button className="exp-del" onClick={() => deleteExp(e.id)}>✕</button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}