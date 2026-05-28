import { NavLink } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';

const links = [
  { to: '/',       label: 'Dashboard', icon: '◈' },
  { to: '/add',    label: 'Add',       icon: '+' },
  { to: '/budget', label: 'Budget',    icon: '⊡' },
  { to: '/aria',   label: 'Aria AI',   icon: '✦' },
];

export default function Topbar() {
  const { user, logout } = useAuth();
  const toast = useToast();

  const handleLogout = () => {
    logout();
    toast('Signed out', 'info');
  };

  return (
    <nav className="topbar">
      <NavLink to="/" className="topbar-brand">
        <div className="brand-icon">💰</div>
        <span className="brand-name">VAULT</span>
      </NavLink>

      <div className="topbar-nav">
        {links.map(l => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.to === '/'}
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
          >
            <span>{l.icon}</span> {l.label}
          </NavLink>
        ))}
      </div>

      {user && (
        <div className="topbar-user" onClick={handleLogout} title="Click to sign out">
          <div className="user-avatar">{user.name[0].toUpperCase()}</div>
          <span className="user-name">{user.name}</span>
        </div>
      )}
    </nav>
  );
}