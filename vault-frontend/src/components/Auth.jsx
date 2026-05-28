import { useState } from 'react';
import { api } from '../api';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';

export default function Auth() {
  const [tab, setTab] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const toast = useToast();

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = async () => {
    setError('');
    if (!form.email || !form.password) return setError('Please fill in all fields');
    if (tab === 'register' && !form.name) return setError('Name is required');
    setLoading(true);
    try {
      const data = tab === 'login'
        ? await api.login({ email: form.email, password: form.password })
        : await api.register(form);
      login(data);
      toast('Welcome back, ' + data.name + '!', 'success');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-overlay">
      <div className="auth-card">
        <div className="auth-top">
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
            <div className="brand-icon" style={{ width: 52, height: 52, fontSize: '1.4rem', borderRadius: 14 }}>💰</div>
          </div>
          <div className="auth-brand" style={{ fontFamily: 'var(--font-display)' }}>VAULT</div>
          <div className="auth-sub">your intelligent finance companion</div>
        </div>

        <div className="auth-tabs">
          <button className={`auth-tab ${tab === 'login' ? 'active' : ''}`} onClick={() => { setTab('login'); setError(''); }}>
            Sign In
          </button>
          <button className={`auth-tab ${tab === 'register' ? 'active' : ''}`} onClick={() => { setTab('register'); setError(''); }}>
            Register
          </button>
        </div>

        <div className="auth-form">
          {tab === 'register' && (
            <div className="field">
              <label>Full Name</label>
              <input
                type="text" placeholder="Your name"
                value={form.name} onChange={e => set('name', e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submit()}
              />
            </div>
          )}
          <div className="field">
            <label>Email</label>
            <input
              type="email" placeholder="you@example.com"
              value={form.email} onChange={e => set('email', e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submit()}
            />
          </div>
          <div className="field">
            <label>Password</label>
            <input
              type="password" placeholder="••••••••"
              value={form.password} onChange={e => set('password', e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submit()}
            />
          </div>
          {error && <div className="auth-error">{error}</div>}
          <button
            className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '12px', fontSize: '.75rem', marginTop: '.25rem' }}
            onClick={submit} disabled={loading}
          >
            {loading ? <span className="spinner" style={{ width: 16, height: 16 }} /> : tab === 'login' ? 'Sign In →' : 'Create Account →'}
          </button>
        </div>
      </div>
    </div>
  );
}