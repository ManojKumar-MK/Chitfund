import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Plus, Search, DollarSign, TrendingUp, Edit2, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { InvestorService } from '../../services/investorService';
import type { Investor } from '../../types';
import { EmptyState } from '../../components/ui/EmptyState';

export const Investors = () => {
    const [investors, setInvestors] = useState<Investor[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    // Form State
    const [editingInvestor, setEditingInvestor] = useState<Investor | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        amount: '',
        monthlyInterestPercent: '',
        expectedReturn: '',
        status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE'
    });

    useEffect(() => {
        fetchInvestors();
    }, []);

    const fetchInvestors = async () => {
        setIsLoading(true);
        try {
            const data = await InvestorService.getAll();
            setInvestors(data);
        } catch (error) {
            console.error("Error fetching investors:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleOpenModal = (investor?: Investor) => {
        if (investor) {
            setEditingInvestor(investor);
            setFormData({
                name: investor.name,
                amount: investor.amount.toString(),
                monthlyInterestPercent: investor.monthlyInterestPercent.toString(),
                expectedReturn: investor.expectedReturn.toString(),
                status: investor.status
            });
        } else {
            setEditingInvestor(null);
            setFormData({
                name: '',
                amount: '',
                monthlyInterestPercent: '',
                expectedReturn: '',
                status: 'ACTIVE'
            });
        }
        setShowAddModal(true);
    };

    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSubmitting) return;
        setIsSubmitting(true);
        try {
            const payload = {
                name: formData.name,
                amount: Number(formData.amount),
                monthlyInterestPercent: Number(formData.monthlyInterestPercent),
                expectedReturn: Number(formData.expectedReturn),
                status: formData.status,
                joinedAt: editingInvestor ? editingInvestor.joinedAt : Date.now()
            };

            if (editingInvestor) {
                await InvestorService.update(editingInvestor.id, payload);
            } else {
                await InvestorService.create(payload);
            }
            await fetchInvestors();
            setShowAddModal(false);
            toast.success("Investor saved successfully!");
        } catch (error: any) {
            console.error(error);
            toast.error("Failed to save investor: " + (error.message || "Unknown error"));
        } finally {
            setIsSubmitting(false);
        }
    };

    const filteredInvestors = investors.filter(inv =>
        inv.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const totalInvestment = investors.reduce((acc, curr) => acc + curr.amount, 0);

    return (
        <div className="p-8 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Investors</h1>
                    <p className="text-slate-600 dark:text-slate-400 mt-1">Manage external investments and returns</p>
                </div>
                <Button onClick={() => handleOpenModal()} className="gap-2 bg-indigo-600 hover:bg-indigo-500 text-white">
                    <Plus className="w-5 h-5" /> Add Investor
                </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <Card className="p-6 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl">
                            <DollarSign className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Investment</p>
                            <h3 className="text-2xl font-bold text-slate-900 dark:text-white">₹{totalInvestment.toLocaleString()}</h3>
                        </div>
                    </div>
                </Card>
                <Card className="p-6 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-xl">
                            <TrendingUp className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Total Investors</p>
                            <h3 className="text-2xl font-bold text-slate-900 dark:text-white">{investors.length}</h3>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Search */}
            <div className="mb-6 max-w-md">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <Input
                        placeholder="Search investors..."
                        className="pl-10"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* Table */}
            <Card className="overflow-hidden bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                {isLoading ? (
                    <div className="p-8 text-center text-slate-500"><Loader2 className="animate-spin inline mr-2" /> Loading...</div>
                ) : filteredInvestors.length > 0 ? (
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 text-xs uppercase border-b border-slate-200 dark:border-slate-700">
                                <th className="p-4 font-semibold">Name</th>
                                <th className="p-4 font-semibold">Investment Amount</th>
                                <th className="p-4 font-semibold">Monthly Return (%)</th>
                                <th className="p-4 font-semibold">Monthly Payout</th>
                                <th className="p-4 font-semibold">Status</th>
                                <th className="p-4 font-semibold text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                            {filteredInvestors.map(inv => (
                                <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                    <td className="p-4 font-medium text-slate-900 dark:text-white">{inv.name}</td>
                                    <td className="p-4 text-emerald-600 font-bold">₹{inv.amount.toLocaleString()}</td>
                                    <td className="p-4 text-slate-600 dark:text-slate-300">{inv.monthlyInterestPercent}%</td>
                                    <td className="p-4 text-indigo-600 dark:text-indigo-400 font-medium">₹{inv.expectedReturn.toLocaleString()}</td>
                                    <td className="p-4">
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${inv.status === 'ACTIVE'
                                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                            : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                                            }`}>
                                            {inv.status}
                                        </span>
                                    </td>
                                    <td className="p-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button
                                                onClick={() => handleOpenModal(inv)}
                                                className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full text-slate-500 hover:text-indigo-500 transition-colors"
                                                title="Edit"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={async () => {
                                                    if (window.confirm('Are you sure you want to delete this investor?')) {
                                                        try {
                                                            await InvestorService.delete(inv.id);
                                                            await fetchInvestors();
                                                        } catch (e) {
                                                            toast.error('Failed to delete investor');
                                                        }
                                                    }
                                                }}
                                                className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-full text-slate-500 hover:text-red-500 transition-colors"
                                                title="Delete"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <EmptyState
                        title="No Investors Found"
                        description="Add investors to start tracking portfolio."
                        icon={DollarSign}
                        actionLabel="Add Investor"
                        onAction={() => handleOpenModal()}
                    />
                )}
            </Card>

            {/* Modal */}
            {showAddModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 dark:bg-black/80 backdrop-blur-sm">
                    <Card className="w-full max-w-lg bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 shadow-xl">
                        <div className="p-6">
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6">
                                {editingInvestor ? 'Edit Investor' : 'Add New Investor'}
                            </h2>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <Input
                                    label="Investor Name"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    required
                                />
                                <Input
                                    label="Investment Amount (₹)"
                                    type="number"
                                    value={formData.amount}
                                    onChange={e => {
                                        const amt = e.target.value;
                                        const pct = formData.monthlyInterestPercent;
                                        const amtVal = parseFloat(amt) || 0;
                                        const pctVal = parseFloat(pct) || 0;
                                        const ret = (amtVal * pctVal) / 100;

                                        setFormData({
                                            ...formData,
                                            amount: amt,
                                            expectedReturn: (amt && pct) ? ret.toFixed(2) : ''
                                        });
                                    }}
                                    required
                                />
                                <div className="grid grid-cols-2 gap-4">
                                    <Input
                                        label="Monthly Return (%)"
                                        type="number"
                                        step="0.01"
                                        value={formData.monthlyInterestPercent}
                                        onChange={e => {
                                            const pct = e.target.value;
                                            const amt = formData.amount;
                                            const amtVal = parseFloat(amt) || 0;
                                            const pctVal = parseFloat(pct) || 0;
                                            const ret = (amtVal * pctVal) / 100;

                                            setFormData({
                                                ...formData,
                                                monthlyInterestPercent: pct,
                                                expectedReturn: (amt && pct) ? ret.toFixed(2) : ''
                                            });
                                        }}
                                        required
                                    />
                                    <Input
                                        label="Expected Monthly Payout (₹)"
                                        type="number"
                                        value={formData.expectedReturn}
                                        disabled
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Status</label>
                                    <select
                                        className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                                        value={formData.status}
                                        onChange={e => setFormData({ ...formData, status: e.target.value as any })}
                                    >
                                        <option value="ACTIVE">Active</option>
                                        <option value="INACTIVE">Inactive</option>
                                    </select>
                                </div>
                                <div className="flex gap-4 pt-4">
                                    <Button type="button" variant="ghost" className="flex-1" onClick={() => setShowAddModal(false)}>Cancel</Button>
                                    <Button type="submit" className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white" disabled={isSubmitting}>
                                        {isSubmitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</> : 'Save Investor'}
                                    </Button>
                                </div>
                            </form>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
};
