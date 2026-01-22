import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { Check, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { CustomerService } from '../../services/customerService';
import { CollectionService } from '../../services/collectionService';
import { PaymentService } from '../../services/paymentService';
import { LoanService } from '../../services/loanService';
import type { Customer } from '../../types';

interface CollectionRow extends Customer {
    loanId: string; // Explicit Link
    outstanding: number;
    paidAmount: number; // New: For progress bar
    installment: number; // Suggested installment
    currentCollectionInput: number;
    currentDateInput: string; // New: Per-row date
    loanPrincipal: number; // For display
    repaymentType: 'WEEKLY'; // Only weekly supported
}

export const Collections = () => {
    const { user } = useAuth();
    const [collectionData, setCollectionData] = useState<CollectionRow[]>([]);
    const [filteredData, setFilteredData] = useState<CollectionRow[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filter, setFilter] = useState<'ALL' | 'OVERDUE' | 'COMPLETED'>('ALL');

    // New controls

    // Derived Stats
    const totalOutstanding = collectionData.reduce((acc, curr) => acc + curr.outstanding, 0);
    const overdueCount = collectionData.filter(c => c.outstanding > 0).length;

    useEffect(() => {
        const fetchData = async () => {
            if (!user?.uid) return;
            setIsLoading(true);
            try {
                // 1. Fetch Loans for this Agent
                const loans = await LoanService.getByAgentId(user.uid);

                // 2. Fetch Customers involved
                const allCustomers = await CustomerService.getAll(); // Optimizable

                // 3. Merge Data -> Primary Item is LOAN
                const mergedData: CollectionRow[] = loans.map(loan => {
                    const cust = allCustomers.find(c => c.id === loan.customerId);
                    if (!cust) return null; // Should not happen

                    // Installment Logic: 10% of Principal (Loan Amount)
                    const installment = loan.amount * 0.10;

                    return {
                        ...cust,
                        id: cust.id, // Customer ID
                        loanId: loan.id, // Loan ID
                        loanPrincipal: loan.amount,
                        outstanding: loan.outstandingAmount,
                        paidAmount: loan.paidAmount || 0,
                        repaymentType: loan.repaymentType || 'WEEKLY',
                        installment: Math.ceil(installment),
                        currentCollectionInput: 0,
                        currentDateInput: new Date().toISOString().split('T')[0],
                    };
                }).filter(Boolean) as CollectionRow[];

                setCollectionData(mergedData);
            } catch (error) {
                console.error("Error fetching collection data", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [user?.uid]);

    useEffect(() => {
        let result = collectionData;

        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            result = result.filter(c =>
                c.name.toLowerCase().includes(lower) ||
                c.phone.includes(lower) ||
                c.address?.toLowerCase().includes(lower)
            );
        }

        if (filter === 'OVERDUE') {
            result = result.filter(c => c.outstanding > 0);
        } else if (filter === 'COMPLETED') {
            result = result.filter(c => c.outstanding === 0);
        }

        setFilteredData(result);
    }, [collectionData, searchTerm, filter]);


    const handleAmountChange = (loanId: string, amount: string) => {
        setCollectionData(prev => prev.map(item => {
            if (item.loanId === loanId) {
                return { ...item, currentCollectionInput: parseFloat(amount) || 0 };
            }
            return item;
        }));
    };

    const handleDateChange = (loanId: string, date: string) => {
        setCollectionData(prev => prev.map(item => {
            if (item.loanId === loanId) {
                return { ...item, currentDateInput: date };
            }
            return item;
        }));
    };

    const handleSave = async (loanId: string) => {
        const item = collectionData.find(i => i.loanId === loanId);
        if (!item || !item.currentCollectionInput) return;

        try {
            const amountPaid = item.currentCollectionInput;
            const newOutstanding = item.outstanding - amountPaid;
            const dateObj = new Date(item.currentDateInput);

            // 1. Record Payment (Linked to Loan)
            await PaymentService.create({
                customerId: item.id,
                loanId: loanId, // CRITICAL: Link to Loan
                amount: amountPaid,
                date: dateObj.getTime(),
                type: 'CREDIT',
                collectedBy: user?.uid || 'unknown',
                description: `Collection - Loan ${loanId.slice(0, 6)}`
            });

            // 2. Persist New Outstanding Balance (Session Tracking)
            const rec = await CollectionService.ensureCollectionRecord(user!.uid, item.id, loanId, item.loanPrincipal);
            await CollectionService.updateOutstanding(rec.id, newOutstanding);

            // 3. Update LOAN Status (Permanent Record)
            const newPaidTotal = (item.paidAmount || 0) + amountPaid;
            await LoanService.update(loanId, {
                outstandingAmount: newOutstanding,
                paidAmount: newPaidTotal,
                status: newOutstanding <= 0 ? 'CLOSED' : 'ACTIVE',
            });

            // Also update Customer lastPaidDate for reference
            await CustomerService.update(item.id, { lastPaidDate: dateObj.getTime() });

            // 3. Update Local State
            setCollectionData(prev => prev.map(row => {
                if (row.loanId === loanId) {
                    return {
                        ...row,
                        outstanding: newOutstanding,
                        paidAmount: newPaidTotal,
                        currentCollectionInput: 0,
                        currentDateInput: new Date().toISOString().split('T')[0],
                    };
                }
                return row;
            }));

            toast.success(`Payment of ₹${amountPaid} recorded`, {
                description: `New outstanding balance for ${item.name} is ₹${newOutstanding.toLocaleString()}`
            });

        } catch (error) {
            console.error("Failed to save collection", error);
            toast.error("Failed to record payment", {
                description: "Please check your internet connection and try again."
            });
        }
    };

    if (isLoading) {
        return <div className="p-12 flex justify-center text-slate-500 dark:text-slate-400 gap-2"><Loader2 className="animate-spin" /> Loading Customers...</div>;
    }

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Daily Collections</h1>
                    <p className="text-slate-600 dark:text-slate-400 mt-1">Track and record payments</p>
                </div>

                {/* Date & Frequency Selection */}
                <div className="flex flex-col sm:flex-row gap-4 bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Daily collections active</p>
                    </div>
                </div>

                {/* Quick Stats Row */}
                <div className="flex gap-4 overflow-x-auto pb-2 md:pb-0 snap-x snap-mandatory md:snap-none">
                    <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm min-w-[150px] snap-center">
                        <p className="text-xs text-slate-500 uppercase font-bold">Total Outstanding</p>
                        <p className="text-xl font-bold text-amber-500 mt-1">₹ {totalOutstanding.toLocaleString()}</p>
                    </div>
                    <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm min-w-[150px] snap-center">
                        <p className="text-xs text-slate-500 uppercase font-bold">Pending Accounts</p>
                        <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">{overdueCount}</p>
                    </div>
                </div>
            </div>

            {/* Controls */}
            <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <input
                        type="text"
                        placeholder="Search by name, phone, or address..."
                        className="w-full pl-10 pr-4 py-3 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    </div>
                </div>
                <div className="flex gap-2">
                    {(['ALL', 'OVERDUE', 'COMPLETED'] as const).map((f) => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === f
                                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                                }`}
                        >
                            {f.charAt(0) + f.slice(1).toLowerCase()}
                        </button>
                    ))}
                </div>
            </div>

            {/* Enhanced Card Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredData.length === 0 ? (
                    <div className="col-span-full py-12">
                        <EmptyState
                            title="No Results Found"
                            description="Try adjusting your search or filters."
                            actionLabel="Clear Filters"
                            onAction={() => { setSearchTerm(''); setFilter('ALL'); }}
                        />
                    </div>
                ) : (
                    filteredData.map((row) => (
                        <Card key={row.loanId} className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 overflow-hidden hover:border-indigo-500/50 transition-all group">
                            <div className="p-5">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h3 className="font-bold text-lg text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                            {row.name}
                                        </h3>
                                        <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-1">
                                            <span className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600"></span>
                                            {row.phone}
                                        </p>
                                    </div>
                                    <div className={`px-2 py-1 rounded text-xs font-bold border ${row.outstanding > 0 ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' : 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'}`}>
                                        {row.outstanding > 0 ? 'PENDING' : 'PAID'}
                                    </div>
                                </div>

                                <div className="space-y-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg p-3 border border-slate-100 dark:border-slate-700/50">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500">Principal</span>
                                        <span className="font-medium text-slate-700 dark:text-slate-300">₹ {row.loanPrincipal?.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500">Suggested Installment</span>
                                        <span className="font-medium text-slate-700 dark:text-slate-300">₹ {row.installment.toLocaleString()}</span>
                                    </div>
                                    <div className="h-px bg-slate-200 dark:bg-slate-700 my-2"></div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">Total Outstanding</span>
                                        <span className="text-lg font-bold text-red-500 dark:text-red-400">₹ {row.outstanding.toLocaleString()}</span>
                                    </div>

                                    {/* Repayment Progress Bar */}
                                    <div className="pt-1">
                                        <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-tighter mb-1">
                                            <span>Progress</span>
                                            <span>{Math.round(((row.paidAmount || 0) / row.loanPrincipal) * 100)}%</span>
                                        </div>
                                        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
                                            <div
                                                className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                                                style={{ width: `${Math.min(100, ((row.paidAmount || 0) / row.loanPrincipal) * 100)}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-5 space-y-4">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-slate-50 relative top-3 left-3 z-10 bg-slate-950 px-1 rounded uppercase tracking-wider">Date</label>
                                            <input
                                                type="date"
                                                className="block w-full px-3 py-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                                                value={row.currentDateInput}
                                                onChange={(e) => handleDateChange(row.loanId, e.target.value)}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-slate-50 relative top-3 left-3 z-10 bg-emerald-600 px-1 rounded uppercase tracking-wider">Amount</label>
                                            <div className="relative">
                                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                    <span className="text-slate-400 font-bold text-xs">₹</span>
                                                </div>
                                                <input
                                                    type="number"
                                                    className="block w-full pl-7 pr-3 py-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 outline-none font-mono font-medium"
                                                    placeholder="0.00"
                                                    value={row.currentCollectionInput || ''}
                                                    onChange={(e) => handleAmountChange(row.loanId, e.target.value)}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <Button
                                        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 py-6 font-bold"
                                        onClick={() => handleSave(row.loanId)}
                                        disabled={!row.currentCollectionInput || row.currentCollectionInput <= 0}
                                    >
                                        <Check className="w-5 h-5 mr-2" />
                                        Confirm & Save Payment
                                    </Button>
                                </div>
                            </div>
                        </Card>
                    ))
                )}
            </div>
        </div>
    );
};
