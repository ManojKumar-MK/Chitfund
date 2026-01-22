import { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import {
    FileText, TrendingUp, Users, DollarSign, Calendar, Download,
    ArrowUpRight, ArrowDownRight, Activity, PieChart as PieChartIcon, Loader2
} from 'lucide-react';
import type { Customer, Collection, User, Transaction } from '../../types';
import { CustomerService } from '../../services/customerService';
import { CollectionService } from '../../services/collectionService';
import { UserService } from '../../services/userService';
import { PaymentService } from '../../services/paymentService';

import { useTheme } from '../../context/ThemeContext';

export const AdminReports = () => {
    const { theme } = useTheme();
    const isDark = theme === 'dark';
    const [activeTab, setActiveTab] = useState<'overview' | 'pending' | 'day_book' | 'performance'>('overview');

    const [customers, setCustomers] = useState<Customer[]>([]);
    const [collections, setCollections] = useState<Collection[]>([]);
    const [agents, setAgents] = useState<User[]>([]);
    const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchAll = async () => {
            setIsLoading(true);
            try {
                const [custs, colls, agts, txs] = await Promise.all([
                    CustomerService.getAll(),
                    CollectionService.getAll(),
                    UserService.getAgents(),
                    PaymentService.getRecent(50)
                ]);
                setCustomers(custs);
                setCollections(colls);
                setAgents(agts);
                setRecentTransactions(txs);
            } catch (error) {
                console.error("Failed to load report data", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchAll();
    }, []);

    // --- Data Calculation ---
    const totalLoan = customers.reduce((acc, c) => acc + (c.loanAmount || 0), 0);

    const totalOutstanding = customers.reduce((acc, c) => {
        const coll = collections.find(cl => cl.customerId === c.id);
        return acc + (coll ? coll.outstanding : (c.loanAmount || 0));
    }, 0);

    const totalCollected = totalLoan - totalOutstanding;

    // Agent Performance Data
    const agentPerformance = agents.map(agent => {
        const agentCusts = customers.filter(c => c.agentId === agent.uid);
        const totalTarget = agentCusts.reduce((acc, c) => acc + (c.loanAmount || 0), 0);

        const agentOutstanding = agentCusts.reduce((acc, c) => {
            const coll = collections.find(cl => cl.customerId === c.id);
            return acc + (coll ? coll.outstanding : (c.loanAmount || 0));
        }, 0);

        const collected = totalTarget - agentOutstanding;
        const efficiency = totalTarget > 0 ? (collected / totalTarget) * 100 : 0;

        return {
            name: agent.displayName?.split(' ')[0] || 'Agent',
            collected: Math.round(collected),
            target: totalTarget,
            efficiency: Math.round(efficiency)
        };
    });

    // Mock Weekly Trend (Placeholder for now)
    const trendData = [
        { name: 'Week 1', collected: totalCollected * 0.2, target: totalLoan * 0.25 },
        { name: 'Week 2', collected: totalCollected * 0.25, target: totalLoan * 0.25 },
        { name: 'Week 3', collected: totalCollected * 0.22, target: totalLoan * 0.25 },
        { name: 'Week 4', collected: totalCollected * 0.33, target: totalLoan * 0.25 },
    ];

    const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#3b82f6'];

    const fmt = (n: number) => {
        if (n >= 10000000) return '₹' + (n / 10000000).toFixed(2) + 'Cr';
        if (n >= 100000) return '₹' + (n / 100000).toFixed(2) + 'L';
        if (n >= 1000) return '₹' + (n / 1000).toFixed(1) + 'k';
        return '₹' + n.toLocaleString();
    };

    if (isLoading) {
        return <div className="p-12 flex justify-center text-slate-500 dark:text-slate-400 gap-2"><Loader2 className="animate-spin" /> Loading Reports...</div>;
    }

    return (
        <div className="p-8 max-w-[1600px] mx-auto text-slate-900 dark:text-white space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-emerald-600 to-cyan-600 dark:from-emerald-400 dark:to-cyan-400 text-transparent bg-clip-text">
                        Financial Insights
                    </h1>
                    <p className="text-slate-600 dark:text-slate-400 mt-2 text-lg">Comprehensive view of organization performance</p>
                </div>
                <div className="flex flex-wrap gap-2 bg-slate-100 dark:bg-slate-800/50 p-1 rounded-xl border border-slate-200 dark:border-slate-700/50 backdrop-blur-sm">
                    {[
                        { id: 'overview', label: 'Overview', icon: Activity },
                        { id: 'pending', label: 'Pending List', icon: FileText },
                        { id: 'day_book', label: 'Day Book', icon: Calendar },
                        { id: 'performance', label: 'Agent Metrics', icon: TrendingUp },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${activeTab === tab.id
                                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30'
                                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700/50'
                                }`}
                        >
                            <tab.icon className="w-4 h-4" />
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                {activeTab === 'overview' && (
                    <div className="space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            <KPI_Card
                                title="Total Disbursed"
                                value={fmt(totalLoan)}
                                trend="--%"
                                trendUp={true}
                                icon={DollarSign}
                                color="emerald"
                            />
                            <KPI_Card
                                title="Total Collected"
                                value={fmt(totalCollected)}
                                trend={`${((totalCollected / totalLoan) * 100 || 0).toFixed(1)}%`}
                                trendUp={true}
                                icon={TrendingUp}
                                color="blue"
                            />
                            <KPI_Card
                                title="Outstanding"
                                value={fmt(totalOutstanding)}
                                trend={`${((totalOutstanding / totalLoan) * 100 || 0).toFixed(1)}%`}
                                trendUp={false}
                                icon={Activity}
                                color="amber"
                            />
                            <KPI_Card
                                title="Active Customers"
                                value={customers.length.toString()}
                                trend="Active"
                                trendUp={true}
                                icon={Users}
                                color="purple"
                            />
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            <Card className="lg:col-span-2 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 p-6 shadow-xl">
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                                        <TrendingUp className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
                                        Collection Trends (Projected)
                                    </h3>
                                </div>
                                <div className="h-[350px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={trendData}>
                                            <defs>
                                                <linearGradient id="colorCollected" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                                </linearGradient>
                                                <linearGradient id="colorTarget" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#1e293b" : "#e2e8f0"} vertical={false} />
                                            <XAxis dataKey="name" stroke={isDark ? "#64748b" : "#94a3b8"} axisLine={false} tickLine={false} dy={10} />
                                            <YAxis stroke={isDark ? "#64748b" : "#94a3b8"} axisLine={false} tickLine={false} tickFormatter={(val) => val >= 100000 ? `₹${(val / 100000).toFixed(1)}L` : `₹${(val / 1000).toFixed(0)}k`} />
                                            <RechartsTooltip
                                                contentStyle={{ backgroundColor: isDark ? '#0f172a' : '#ffffff', border: isDark ? '1px solid #1e293b' : '1px solid #e2e8f0', borderRadius: '8px' }}
                                                itemStyle={{ color: isDark ? '#e2e8f0' : '#1e293b' }}
                                                formatter={(value, name) => [fmt(Number(value || 0)), name]}
                                            />
                                            <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                            <Area type="monotone" dataKey="target" name="Projected Target" stroke="#3b82f6" fillOpacity={1} fill="url(#colorTarget)" strokeWidth={2} />
                                            <Area type="monotone" dataKey="collected" name="Actual Collection" stroke="#10b981" fillOpacity={1} fill="url(#colorCollected)" strokeWidth={2} />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </Card>

                            <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 p-6 shadow-xl">
                                <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-6 flex items-center gap-2">
                                    <PieChartIcon className="w-5 h-5 text-purple-500 dark:text-purple-400" />
                                    Portfolio Health
                                </h3>
                                <div className="h-[300px] flex items-center justify-center relative">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={[
                                                    { name: 'Collected', value: totalCollected },
                                                    { name: 'Outstanding', value: totalOutstanding },
                                                    { name: 'Overdue Estimate', value: totalOutstanding * 0.1 },
                                                ]}
                                                innerRadius={80}
                                                outerRadius={100}
                                                paddingAngle={5}
                                                dataKey="value"
                                                stroke="none"
                                            >
                                                {COLORS.map((color, index) => (
                                                    <Cell key={`cell-${index}`} fill={color} />
                                                ))}
                                            </Pie>
                                            <RechartsTooltip contentStyle={{ backgroundColor: isDark ? '#0f172a' : '#ffffff', border: 'none', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} formatter={(value: any) => fmt(Number(value || 0))} />
                                            <Legend verticalAlign="bottom" height={36} iconType="circle" />
                                        </PieChart>
                                    </ResponsiveContainer>
                                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                        <span className="text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">Total Value</span>
                                        <span className="text-2xl font-bold text-slate-900 dark:text-white">{fmt(totalLoan)}</span>
                                    </div>
                                </div>
                            </Card>
                        </div>
                    </div>
                )}

                {activeTab === 'pending' && (
                    <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden">
                        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4">
                            <div>
                                <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                    <FileText className="w-5 h-5 text-amber-500 dark:text-amber-400" />
                                    Pending Collections Report
                                </h3>
                                <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">Detailed list of outstanding dues</p>
                            </div>
                            <div className="flex gap-3">
                                <Button className="bg-indigo-600 hover:bg-indigo-500 gap-2">
                                    <Download className="w-4 h-4" /> Export PDF
                                </Button>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
                                <thead className="bg-slate-50 dark:bg-slate-950/50 text-slate-700 dark:text-slate-400 uppercase font-semibold text-xs py-4">
                                    <tr>
                                        <th className="px-6 py-4">Customer</th>
                                        <th className="px-6 py-4">Agent</th>
                                        <th className="px-6 py-4 text-right">Loan Amount</th>
                                        <th className="px-6 py-4 text-right">Outstanding</th>
                                        <th className="px-6 py-4 text-center">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 dark:divide-slate-800/50">
                                    {customers.map((cust) => {
                                        const coll = collections.find(c => c.customerId === cust.id);
                                        const pending = coll?.outstanding || (cust.loanAmount || 0);
                                        const agentName = agents.find(u => u.uid === cust.agentId)?.displayName || 'Unassigned';

                                        const loan = cust.loanAmount || 1;
                                        const progress = ((loan - pending) / loan) * 100;

                                        return (
                                            <tr key={cust.id} className="hover:bg-slate-800/30 transition-colors group">
                                                <td className="px-6 py-4">
                                                    <div>
                                                        <p className="font-medium text-slate-200 group-hover:text-indigo-400 transition-colors">{cust.name}</p>
                                                        <p className="text-xs text-slate-500">{cust.phone}</p>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="inline-flex items-center px-2 py-1 rounded bg-slate-800 text-xs text-slate-400">
                                                        {agentName}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-right font-mono">
                                                    {fmt(cust.loanAmount || 0)}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <span className="font-bold text-amber-500">{fmt(pending)}</span>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <div className="w-full bg-slate-800 rounded-full h-1.5 mt-1 overflow-hidden">
                                                        <div
                                                            className="bg-emerald-500 h-full rounded-full"
                                                            style={{ width: `${progress}%` }}
                                                        ></div>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </Card>
                )}

                {activeTab === 'day_book' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <Card className="lg:col-span-1 bg-gradient-to-br from-slate-900 to-slate-950 border-slate-800 p-0 overflow-hidden shadow-xl sticky top-8 h-fit">
                            <div className="p-6 bg-indigo-900/20 border-b border-indigo-900/30 pb-8">
                                <p className="text-center text-indigo-400 font-semibold uppercase tracking-widest text-xs mb-2">Recent Collections</p>
                                <h2 className="text-center text-5xl font-bold text-white mb-2">
                                    ₹{recentTransactions.reduce((sum, tx) => sum + tx.amount, 0).toLocaleString()}
                                </h2>
                                <p className="text-center text-slate-400 text-sm">Last {recentTransactions.length} Transactions</p>
                            </div>
                            <div className="p-6 space-y-6">
                                <div className="flex justify-between items-center border-b border-slate-800 pb-4">
                                    <span className="text-slate-400">Transactions Logged</span>
                                    <span className="text-slate-200 font-medium">{recentTransactions.length}</span>
                                </div>
                                <div className="flex justify-between items-center border-b border-slate-800 pb-4">
                                    <span className="text-slate-400">Active Agents</span>
                                    <span className="text-slate-200 font-medium">
                                        {agents.filter(u => u.status !== 'INACTIVE').length}
                                    </span>
                                </div>
                            </div>
                        </Card>

                        <Card className="lg:col-span-2 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xl">
                            <div className="p-6 border-b border-slate-200 dark:border-slate-800">
                                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-1">Live Feed</h3>
                                <p className="text-slate-600 dark:text-slate-400 text-sm">Real-time incoming payments</p>
                            </div>
                            <div className="divide-y divide-slate-200 dark:divide-slate-800">
                                {recentTransactions.length === 0 ? (
                                    <div className="p-8 text-center text-slate-500">No recent transactions found.</div>
                                ) : (
                                    recentTransactions.map((tx) => (
                                        <div key={tx.id} className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400 font-bold border border-slate-200 dark:border-slate-700">
                                                    ₹
                                                </div>
                                                <div>
                                                    <p className="text-slate-700 dark:text-slate-200 font-medium">{tx.description || 'Payment'}</p>
                                                    <p className="text-xs text-slate-500">
                                                        Collected by {agents.find(a => a.uid === tx.collectedBy)?.displayName || 'Unknown Agent'} • {new Date(tx.date).toLocaleTimeString()}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-emerald-500 dark:text-emerald-400 font-bold">+ ₹{(tx.amount).toLocaleString()}</p>
                                                <p className="text-xs text-slate-500 dark:text-slate-600">{new Date(tx.date).toLocaleDateString()}</p>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </Card>
                    </div>
                )}

                {activeTab === 'performance' && (
                    <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xl p-6">
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-6">Agent Performance Metrics</h3>
                        <div className="h-[400px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={agentPerformance} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#334155" : "#e2e8f0"} vertical={false} />
                                    <XAxis dataKey="name" stroke={isDark ? "#94a3b8" : "#64748b"} />
                                    <YAxis stroke={isDark ? "#94a3b8" : "#64748b"} />
                                    <RechartsTooltip
                                        cursor={{ fill: isDark ? '#1e293b' : '#f1f5f9' }}
                                        contentStyle={{ backgroundColor: isDark ? '#0f172a' : '#ffffff', border: isDark ? 'none' : '1px solid #e2e8f0', borderRadius: '8px' }}
                                        itemStyle={{ color: isDark ? '#fff' : '#000' }}
                                    />
                                    <Legend />
                                    <Bar dataKey="target" name="Assigned Target" fill="#1e293b" radius={[4, 4, 0, 0]} stroke="#475569" strokeDasharray="5 5" />
                                    <Bar dataKey="collected" name="Actual Collected" fill="#6366f1" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>
                )}
            </div>
        </div>
    );
};

interface KPICardProps {
    title: string;
    value: string;
    trend: string;
    trendUp: boolean;
    icon: React.ElementType;
    color: 'emerald' | 'blue' | 'amber' | 'purple';
}

const KPI_Card = ({ title, value, trend, trendUp, icon: Icon, color }: KPICardProps) => {
    const colorStyles: Record<string, string> = {
        emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
        blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
        amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
        purple: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
    };

    return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-xl shadow-lg hover:shadow-xl hover:border-slate-300 dark:hover:border-slate-700 transition-all group">
            <div className="flex justify-between items-start mb-4">
                <div className={`p-3 rounded-lg ${colorStyles[color]}`}>
                    <Icon className="w-6 h-6" />
                </div>
                <div className={`flex items-center gap-1 text-sm font-medium ${trendUp ? 'text-emerald-500 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'} bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-full`}>
                    {trendUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    {trend}
                </div>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium uppercase tracking-wider">{title}</p>
            <h3 className="text-3xl font-bold text-slate-900 dark:text-white mt-1 group-hover:scale-105 transition-transform origin-left">{value}</h3>
        </div>
    );
};
