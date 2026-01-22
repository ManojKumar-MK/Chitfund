import { useState } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { useAuth } from '../../context/AuthContext';
import { LogOut, Menu, X } from 'lucide-react';
import { auth } from '../../lib/firebase';
import { Button } from '../ui/Button';
import { ThemeToggle } from '../ThemeToggle';

export const Layout = () => {
    const { user, loading } = useAuth();
    const [sidebarOpen, setSidebarOpen] = useState(false);

    // Close sidebar on route change (mobile)
    if (loading) return <div className="h-screen w-full flex items-center justify-center bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400">Loading...</div>;
    if (!user) return <Navigate to="/login" />;

    const handleLogout = () => auth.signOut();

    return (
        <div className="flex h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white overflow-hidden transition-colors duration-300">
            {/* Mobile Sidebar Overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 z-20 bg-black/50 md:hidden backdrop-blur-sm transition-opacity"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar Container */}
            <div className={`
                fixed inset-y-0 left-0 z-30 w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-transform duration-300 ease-in-out md:relative md:translate-x-0
                ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
            `}>
                <div className="absolute right-2 top-2 md:hidden">
                    <Button variant="ghost" size="sm" onClick={() => setSidebarOpen(false)}>
                        <X className="w-5 h-5 text-slate-500" />
                    </Button>
                </div>
                <Sidebar onClose={() => setSidebarOpen(false)} />
            </div>

            <div className="flex-1 flex flex-col min-w-0">
                <header className="h-16 border-b border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm flex items-center justify-between px-4 md:px-8 transition-colors duration-300 sticky top-0 z-10 w-full">
                    <div className="flex items-center gap-3">
                        <Button variant="ghost" size="sm" className="md:hidden -ml-2" onClick={() => setSidebarOpen(true)}>
                            <Menu className="w-6 h-6 text-slate-700 dark:text-slate-200" />
                        </Button>
                        <h2 className="text-lg font-medium text-slate-700 dark:text-slate-200">
                            Overview
                        </h2>
                    </div>
                    <div className="flex items-center gap-2 md:gap-4">
                        <ThemeToggle />
                        <Button variant="ghost" size="sm" onClick={handleLogout} className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white">
                            <LogOut className="w-4 h-4 md:mr-2" />
                            <span className="hidden md:inline">Sign Out</span>
                        </Button>
                    </div>
                </header>
                <main className="flex-1 overflow-auto bg-slate-50/50 dark:bg-slate-900/50 p-4 md:p-6 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700 scrollbar-track-transparent">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};
