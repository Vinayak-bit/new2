import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { ToastProvider } from './hooks/useToast';
import Topbar from './components/Topbar';
import Auth from './components/Auth';
import Dashboard from './pages/Dashboard';
import AddExpense from './pages/AddExpense';
import Budget from './pages/Budget';
import Aria from './pages/Aria';

function AppShell() {
    const { user } = useAuth();

    if (!user) return <Auth />;

    return (
        <div style={{ position: 'relative', zIndex: 2 }}>
            <Topbar />
            <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/add" element={<AddExpense />} />
                <Route path="/budget" element={<Budget />} />
                <Route path="/aria" element={<Aria />} />
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </div>
    );
}

export default function App() {
    return (
        <BrowserRouter>
            <AuthProvider>
                <ToastProvider>
                    {/* Animated background */}
                    <div className="aurora">
                        <div className="orb orb-1" />
                        <div className="orb orb-2" />
                        <div className="orb orb-3" />
                    </div>
                    <AppShell />
                </ToastProvider>
            </AuthProvider>
        </BrowserRouter>
    );
}

