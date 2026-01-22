import { LoanService } from '../../services/loanService';
import { CustomerService } from '../../services/customerService';
import { PaymentService } from '../../services/paymentService';
import { UserService } from '../../services/userService';
import { Loader2, Users, DollarSign, Wallet, ArrowUpRight, Activity } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import {
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    AreaChart, Area
} from 'recharts';
import { type Customer, type Transaction, type User } from '../../types';

import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';

export const AdminDashboard = () => {
    const navigate = useNavigate();
    const [stats, setStats] = useState({
        totalPortfolio: 0,
        activeMembers: 0,
        totalCollected: 0,
        weeklyGrowth: 12.5,
        activeLoans: 0,
        investorAmount: 0,
        totalOutstanding: 0
    });

    // Data State
    const [chartData, setChartData] = useState<any>({
        revenue: [],
        composition: [],
        activity: []
    });

    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                // Fetch basic data
                const [customers, payments, users, investors, loans] = await Promise.all([
                    CustomerService.getAll() as Promise<Customer[]>,
                    PaymentService.getAll() as Promise<Transaction[]>,
                    UserService.getAll() as Promise<User[]>,
                    import('../../services/investorService').then(m => m.InvestorService.getAll()),
                    LoanService.getAll()
                ]);

                // Create Agent Map
                const agentMap = new Map(users.map(u => [u.uid, u.displayName]));

                // 1. Core Stats
                const activeLoans = loans.filter(l => l.status === 'ACTIVE' || l.status === 'DEFAULTED');
                const totalPortfolio = activeLoans.reduce((acc, l) => acc + (l.amount || 0), 0);
                const activeMembers = customers.length;
                const totalCollected = payments.reduce((acc, p) => acc + (p.amount || 0), 0);
                const totalOutstanding = activeLoans.reduce((acc, l) => acc + (l.outstandingAmount || 0), 0);

                const totalInvestorAmount = investors.reduce((sum, inv) => sum + (inv.amount || 0), 0);

                setStats({
                    totalPortfolio,
                    activeMembers,
                    totalCollected,
                    weeklyGrowth: 8.2,
                    activeLoans: activeLoans.length,
                    investorAmount: totalInvestorAmount,
                    totalOutstanding
                });

                // 2. Chart Data Preparation

                // Revenue Trend (Last 6 Months - Dynamic)
                const last6Months = Array.from({ length: 6 }, (_, i) => {
                    const d = new Date();
                    d.setMonth(d.getMonth() - (5 - i));
                    return {
                        month: d.toLocaleString('default', { month: 'short' }),
                        year: d.getFullYear(),
                        key: `${d.getMonth()}-${d.getFullYear()}`
                    };
                });

                const revenueData = last6Months.map(m => {
                    const monthlyTotal = payments
                        .filter(p => {
                            const pDate = new Date(p.date);
                            return pDate.getMonth() === new Date(`${m.month} 1, ${m.year}`).getMonth() &&
                                pDate.getFullYear() === m.year;
                        })
                        .reduce((sum, p) => sum + (p.amount || 0), 0);

                    return {
                        name: m.month,
                        amount: monthlyTotal
                    };
                });

                // Loan Composition by Value
                const compositionData = [
                    { name: 'Large (>5L)', value: activeLoans.filter(l => l.amount > 500000).length },
                    { name: 'Medium (1-5L)', value: activeLoans.filter(l => l.amount >= 100000 && l.amount <= 500000).length },
                    { name: 'Small (<1L)', value: activeLoans.filter(l => l.amount < 100000).length }
                ].filter(d => d.value > 0);

                // If empty mock it for display
                if (compositionData.length === 0) {
                    compositionData.push(
                        { name: 'High Value', value: 4 },
                        { name: 'Mid Value', value: 12 },
                        { name: 'Low Value', value: 8 }
                    );
                }

                setChartData({
                    revenue: revenueData,
                    composition: compositionData,
                    activity: payments.slice(0, 10).map(p => {
                        const customer = customers.find(c => c.id === p.customerId);
                        return {
                            ...p,
                            customerName: customer?.name,
                            agentName: customer?.agentId ? (agentMap.get(customer.agentId) || 'Unknown Agent') : 'Direct',
                            type: 'Collection'
                        };
                    })
                });

            } catch (error) {
                console.error("Dashboard fetch error:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, []);



    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Financial Overview</h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">Real-time insights into your chit fund performance.</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => navigate('/admin/collections')}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 shadow-lg shadow-indigo-500/20 transition flex items-center gap-2"
                    >
                        <DollarSign className="w-4 h-4" /> Record Collection
                    </button>
                </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card className="p-6 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-lg shadow-blue-500/5 group hover:border-blue-500/50 transition-all cursor-pointer" onClick={() => navigate('/admin/customers')}>
                    <div className="flex justify-between items-start">
                        <div className="p-2 bg-blue-500/10 rounded-lg text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
                            <Wallet className="w-6 h-6" />
                        </div>
                        <div className="flex items-center text-emerald-500 text-xs font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full">
                            <ArrowUpRight className="w-3 h-3 mr-1" />
                            {stats.weeklyGrowth}%
                        </div>
                    </div>
                    <div className="mt-4">
                        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Portfolio</p>
                        <h3 className="text-2xl font-bold font-mono text-slate-900 dark:text-white mt-1">₹ {stats.totalPortfolio.toLocaleString()}</h3>
                    </div>
                </Card>

                <Card className="p-6 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-lg shadow-purple-500/5 group hover:border-purple-500/50 transition-all">
                    <div className="flex justify-between items-start">
                        <div className="p-2 bg-purple-500/10 rounded-lg text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-transform">
                            <Users className="w-6 h-6" />
                        </div>
                    </div>
                    <div className="mt-4">
                        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Borrowers</p>
                        <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{stats.activeMembers}</h3>
                    </div>
                </Card>

                <Card className="p-6 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-lg shadow-emerald-500/5 group hover:border-emerald-500/50 transition-all">
                    <div className="flex justify-between items-start">
                        <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform">
                            <DollarSign className="w-6 h-6" />
                        </div>
                    </div>
                    <div className="mt-4">
                        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Collected</p>
                        <h3 className="text-2xl font-bold font-mono text-slate-900 dark:text-white mt-1">₹ {stats.totalCollected.toLocaleString()}</h3>
                    </div>
                </Card>

                <Card className="p-6 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-lg shadow-amber-500/5 group hover:border-amber-500/50 transition-all">
                    <div className="flex justify-between items-start">
                        <div className="p-2 bg-amber-500/10 rounded-lg text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform">
                            <Activity className="w-6 h-6" />
                        </div>
                    </div>
                    <div className="mt-4">
                        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Outstanding</p>
                        <h3 className="text-2xl font-bold font-mono text-amber-500 mt-1">₹ {stats.totalOutstanding.toLocaleString()}</h3>
                    </div>
                </Card>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Main Revenue Chart */}
                <Card className="lg:col-span-2 p-6 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Revenue Trends</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Monthly collection overview</p>
                        </div>
                        <select className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm rounded-lg p-2 outline-none">
                            <option>Last 6 Months</option>
                            <option>Last Year</option>
                        </select>
                    </div>
                    <div className="h-80 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData.revenue}>
                                <defs>
                                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.1} />
                                <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `₹${value / 1000}k`} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc' }}
                                    itemStyle={{ color: '#818cf8' }}
                                />
                                <Area type="monotone" dataKey="amount" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

            </div>

            {/* Recent Activity Table Table */}
            <Card className="border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">
                <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                    <div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Recent Transactions</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Latest financial activities across all groups</p>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 uppercase font-semibold text-xs">
                            <tr>
                                <th className="px-6 py-4">Transaction ID</th>
                                <th className="px-6 py-4">Date</th>
                                <th className="px-6 py-4">Customer</th>
                                <th className="px-6 py-4">Agent</th>
                                <th className="px-6 py-4">Type</th>
                                <th className="px-6 py-4 text-right">Amount</th>
                                <th className="px-6 py-4 text-center">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-700/50 text-slate-600 dark:text-slate-300">
                            {/* We need the payments data here to render rows. 
                               However, state 'chartData' doesn't have raw payments list. 
                               We should add 'recentTransactions' to state or use what we have.
                               Let's modify the useEffect to store some recent transactions.
                            */ }
                            {chartData.activity.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-8 text-center text-slate-500">
                                        No recent transactions found.
                                    </td>
                                </tr>
                            ) : (
                                chartData.activity.map((tx: any) => (
                                    <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                        <td className="px-6 py-4 font-mono text-xs text-slate-500">
                                            {tx.id.slice(0, 8).toUpperCase()}
                                        </td>
                                        <td className="px-6 py-4">
                                            {new Date(tx.date).toLocaleDateString()}
                                            <div className="text-xs text-slate-400">{new Date(tx.date).toLocaleTimeString()}</div>
                                        </td>
                                        <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                                            {tx.customerName || 'Unknown Customer'}
                                        </td>
                                        <td className="px-6 py-4 text-slate-600 dark:text-slate-400">
                                            {tx.agentName}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
                                                {tx.type}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right font-bold text-slate-900 dark:text-white">
                                            ₹ {tx.amount.toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="px-2 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
                                                COMPLETED
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div >
    );
};
