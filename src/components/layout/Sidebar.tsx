
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, UserCheck, Wallet, FileText, Settings, UserCog, TrendingUp } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { clsx } from 'clsx';

export const Sidebar = ({ onClose }: { onClose?: () => void }) => {
    const { role } = useAuth();

    const adminLinks = [
        { icon: LayoutDashboard, label: 'Dashboard', to: '/admin' },
        { icon: Users, label: 'Customers', to: '/admin/customers' },
        { icon: UserCheck, label: 'Agents', to: '/admin/agents' },
        { icon: UserCog, label: 'User Roles', to: '/admin/users' },
        { icon: FileText, label: 'Reports', to: '/admin/reports' },
        { icon: TrendingUp, label: 'Investors', to: '/admin/investors' },
        { icon: Settings, label: 'Settings', to: '/admin/settings' },
    ];

    const agentLinks = [
        { icon: LayoutDashboard, label: 'Dashboard', to: '/agent' },
        { icon: Wallet, label: 'Collections', to: '/agent/collections' },
        { icon: Users, label: 'My Customers', to: '/agent/customers' },
    ];

    const links = role === 'ADMIN' ? adminLinks : agentLinks;

    return (
        <div className="h-screen w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col transition-colors duration-300">
            <div className="p-6 border-b border-slate-200 dark:border-slate-800">
                <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-cyan-600 dark:from-indigo-400 dark:to-cyan-400 text-transparent bg-clip-text">
                    ChitFund Pro
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-500 mt-1 uppercase tracking-wider">{role} Portal</p>
            </div>

            <nav className="flex-1 p-4 space-y-1">
                {links.map((link) => (
                    <NavLink
                        key={link.to}
                        to={link.to}
                        onClick={onClose}
                        end={link.to.endsWith('/admin') || link.to.endsWith('/agent')}
                        className={({ isActive }) => clsx(
                            'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200',
                            isActive
                                ? 'bg-indigo-50 dark:bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-600/20'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-white/5'
                        )}
                    >
                        <link.icon className="w-5 h-5" />
                        {link.label}
                    </NavLink>
                ))}
            </nav>

            <div className="p-4 border-t border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-slate-100 dark:bg-slate-800/50">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs">
                        {role?.[0]}
                    </div>
                    <div className="flex-1 overflow-hidden">
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">Logged In</p>
                        <p className="text-xs text-slate-500 truncate">{role}</p>
                    </div>
                </div>
            </div>
        </div>
    );
};
