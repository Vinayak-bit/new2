const BASE = '';

async function req(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(BASE + path, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Request failed');
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  // Auth
  register: (data) => req('POST', '/auth/register', data),
  login: (data) => req('POST', '/auth/login', data),

  // Expenses
  getExpenses: (userId) => req('GET', `/expenses?user_id=${userId}`),
  getSummary: (userId) => req('GET', `/expenses/summary?user_id=${userId}`),
  addExpense: (data) => req('POST', '/expenses', data),
  deleteExpense: (id) => req('DELETE', `/expenses/${id}`),

  // Budgets
  getBudgets: (userId) => req('GET', `/budgets?user_id=${userId}`),
  upsertBudget: (data) => req('POST', '/budgets', data),
  deleteBudget: (id) => req('DELETE', `/budgets/${id}`),

  // ZBB
  getZBBOverview: (userId, month) => req('GET', `/zbb/overview?user_id=${userId}&month=${month}`),
  setIncome: (data) => req('POST', '/income', data),
  getIncome: (userId, month) => req('GET', `/income?user_id=${userId}&month=${month}`),
  transferEnvelope: (data) => req('POST', '/zbb/transfer', data),

  // Classify
  classify: (description) => req('POST', '/classify', { description }),

  // Chat
  chat: (data) => req('POST', '/chat', data),

  // Gamification
  checkGamification: (userId) => req('POST', `/gamification/check?user_id=${userId}`),
  getStreaks: (userId) => req('GET', `/gamification/streaks?user_id=${userId}`),
  getAchievements: (userId) => req('GET', `/gamification/achievements?user_id=${userId}`),
};

export const CAT = {
  food:          { label: 'Food',          icon: '🍜', color: '#fb923c' },
  transport:     { label: 'Transport',     icon: '🚗', color: '#38bdf8' },
  entertainment: { label: 'Entertainment', icon: '🎬', color: '#a78bfa' },
  health:        { label: 'Health',        icon: '💊', color: '#34d399' },
  shopping:      { label: 'Shopping',      icon: '🛍️', color: '#f472b6' },
  utilities:     { label: 'Utilities',     icon: '⚡',  color: '#fbbf24' },
  education:     { label: 'Education',     icon: '📚', color: '#2dd4bf' },
  other:         { label: 'Other',         icon: '📦', color: '#94a3b8' },
};

export const fmt = (n) =>
  '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 });

export const currentMonth = () => new Date().toISOString().slice(0, 7);