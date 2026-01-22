import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { auth } from '../../lib/firebase';
import { updatePassword } from 'firebase/auth';
import { toast } from 'sonner';
import { CustomerService } from '../../services/customerService';
import { CollectionService } from '../../services/collectionService';
import { PaymentService } from '../../services/paymentService';
import { LoanService } from '../../services/loanService';
import { type Customer, type Collection, type Transaction, type Loan } from '../../types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import {
    Search, Users, Banknote, AlertCircle, Calendar,
    FileText, ChevronRight, Phone, MapPin, IndianRupee, Loader2, ZoomIn
} from 'lucide-react';
import { isOverdue, getDaysOverdue } from '../../lib/utils';
import { compressAndConvertToBase64, encryptData, decryptData } from '../../lib/encryption';
import { EmptyState } from '../../components/ui/EmptyState';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, LineChart, Line, Legend
} from 'recharts';

interface StatCardProps {
    title: string;
    value: string | number;
    subValue?: string;
    icon: any;
    color: 'blue' | 'emerald' | 'amber' | 'purple';
}

const StatCard = ({ title, value, subValue, icon: Icon, color }: StatCardProps) => {
    const colorStyles: Record<string, string> = {
        blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
        emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
        amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
        purple: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
    };

    return (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6 rounded-xl hover:border-indigo-500/30 transition-colors shadow-sm">
            <div className="flex items-start justify-between mb-4">
                <div className={`p-3 rounded-lg ${colorStyles[color]}`}>
                    <Icon className="w-6 h-6" />
                </div>
            </div>
            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium uppercase tracking-wider">{title}</p>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{value}</h3>
            {subValue && <p className="text-slate-400 dark:text-slate-500 text-xs mt-1">{subValue}</p>}
        </div>
    );
};

import { ImageViewerModal } from '../../components/ui/ImageViewerModal';

export const AgentDashboard = () => {
    const navigate = useNavigate();
    const { user } = useAuth();

    // UI State
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState<'overview' | 'customers' | 'reports'>('overview');
    const [sortBy, setSortBy] = useState<'name' | 'outstanding' | 'status'>('name');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
    const [isLoading, setIsLoading] = useState(true);

    // Data State
    const [myCustomers, setMyCustomers] = useState<Customer[]>([]);
    const [myLoans, setMyLoans] = useState<Loan[]>([]); // Added Loans State
    const [myCollections, setMyCollections] = useState<Collection[]>([]);
    const [myPayments, setMyPayments] = useState<Transaction[]>([]);

    // Modal States
    const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [selectedCustomerForHistory, setSelectedCustomerForHistory] = useState<Customer | null>(null);
    const [historyTransactions, setHistoryTransactions] = useState<any[]>([]);
    const [historyLoans, setHistoryLoans] = useState<any[]>([]); // New State
    const [loadingHistory, setLoadingHistory] = useState(false);

    // Password Update State
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [passwordForm, setPasswordForm] = useState({ newPassword: '', confirmPassword: '' });

    // Add Customer Form
    const [newCustomer, setNewCustomer] = useState({
        name: '',
        phone: '',
        address: '',
        loanAmount: 0,
        repaymentType: 'WEEKLY' as 'WEEKLY',
        tenure: 20
    });
    const [showEditCustomerModal, setShowEditCustomerModal] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [aadhaarFile, setAadhaarFile] = useState<File | null>(null);
    const [panFile, setPanFile] = useState<File | null>(null);
    const [customerToEdit, setCustomerToEdit] = useState<Customer | null>(null);
    const [viewingImage, setViewingImage] = useState<{ url: string; title: string } | null>(null);

    // --- Data Fetching ---
    const currentAgentId = user?.uid;

    useEffect(() => {
        const fetchData = async () => {
            if (!currentAgentId) return;
            setIsLoading(true);
            try {
                const loans = await LoanService.getByAgentId(currentAgentId);
                setMyLoans(loans);

                const uniqueCustomerIds = [...new Set(loans.map(l => l.customerId))];
                const allCustomers = await CustomerService.getAll();
                const relevantCustomers = allCustomers.filter(c => uniqueCustomerIds.includes(c.id));
                setMyCustomers(relevantCustomers);

                const collections = await CollectionService.getByAgentId(currentAgentId);
                setMyCollections(collections);

                const payments = await PaymentService.getByAgentId(currentAgentId);
                setMyPayments(payments);
            } catch (error) {
                console.error("Failed to fetch dashboard data:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [currentAgentId]);

    // --- Memoized Computations ---

    // 1. Filtered and Sorted Portfolio Items (Loans + Customer Info)
    const portfolioItems = useMemo(() => {
        // Merge Loan with Customer
        const combined = myLoans.map(loan => {
            const customer = myCustomers.find(c => c.id === loan.customerId);
            return {
                ...customer, // Base profile
                ...loan,     // Loan overrides (amount, status, etc)
                loanId: loan.id, // Explicit ID
                name: customer?.name || 'Unknown',
                phone: customer?.phone || '',
                address: customer?.address || '',
                // Ensure loan details take precedence for display
                loanAmount: loan.amount, // Principal
                outstanding: loan.outstandingAmount
            };
        });

        let result = combined;

        // Search
        if (searchTerm) {
            const lowerTerm = searchTerm.toLowerCase();
            result = result.filter(item =>
                (item.name || '').toLowerCase().includes(lowerTerm) ||
                (item.phone || '').includes(lowerTerm) ||
                (item.address || '').toLowerCase().includes(lowerTerm)
            );
        }

        // Sort
        return result.sort((a, b) => {
            let valA: any = '', valB: any = '';

            if (sortBy === 'name') {
                valA = a.name.toLowerCase();
                valB = b.name.toLowerCase();
            } else if (sortBy === 'status') {
                valA = a.status || 'ACTIVE';
                valB = b.status || 'ACTIVE';
            } else if (sortBy === 'outstanding') {
                valA = a.outstandingAmount || 0;
                valB = b.outstandingAmount || 0;
            }

            if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
            if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
            return 0;
        });
    }, [myLoans, myCustomers, searchTerm, sortBy, sortOrder, myCollections]);

    // 2. Report Computations using Real Data
    const chartData = useMemo(() => {
        // Weekly Collections (Last 7 Days)
        const last7Days = Array.from({ length: 7 }, (_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - (6 - i));
            return d.toISOString().split('T')[0];
        });

        const weekly = last7Days.map(dateStr => {
            const dayName = new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short' });
            // Filter payments for this day
            const dailyTotal = myPayments
                .filter(p => {
                    const pDate = new Date(p.date || Date.now()); // Fallback if date missing
                    return pDate.toISOString().split('T')[0] === dateStr;
                })
                .reduce((sum, p) => sum + (p.amount || 0), 0);

            return { day: dayName, amount: dailyTotal };
        });

        // Customer Status Distribution
        const status = [
            { name: 'Active', value: myCustomers.filter(c => (c.status || 'ACTIVE') === 'ACTIVE').length },
            { name: 'Closed', value: myCustomers.filter(c => c.status === 'CLOSED').length },
            { name: 'Inactive', value: myCustomers.filter(c => c.status === 'INACTIVE').length },
            { name: 'KYC Pending', value: myCustomers.filter(c => c.kycStatus === 'PENDING').length }
        ].filter(d => d.value > 0);

        // Monthly Trend (Last 4 weeks)
        // Groups payments into 4 buckets
        const now = new Date();
        const trend = Array.from({ length: 4 }, (_, i) => {
            const weekStart = new Date(now);
            weekStart.setDate(now.getDate() - ((3 - i) * 7));
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 7);

            const total = myPayments
                .filter(p => {
                    const d = new Date(p.date);
                    return d >= weekStart && d < weekEnd;
                })
                .reduce((sum, p) => sum + p.amount, 0);

            return { day: `W${i + 1}`, amount: total };
        });

        return { weekly, status, trend };
    }, [myPayments, myCustomers]);

    // Financial Stats
    const totalAssignedLoan = myLoans.reduce((acc, l) => acc + (l.amount || 0), 0);
    const totalOutstanding = myLoans.reduce((acc, l) => acc + (l.outstandingAmount || 0), 0);
    const collectedAmount = totalAssignedLoan - totalOutstanding;

    // Commission Stats
    const commissionRate = user?.commissionPercentage || 0;
    // Calculation: Total Portfolio (Loan Amount) * Commission Rate / 100
    // "Expected Amount Weekly" as requested -> Assuming this is the agent's expected earnings based on the portfolio they manage.
    const expectedWeeklyEarnings = (totalAssignedLoan * commissionRate) / 100;

    // Weekly Stats (Mocked mostly, but derived from collections where possible)
    const weeklyTarget = 50000; // Still static for now
    const weeklyAchieved = myCollections.reduce((acc, c) => acc + (c.amount || 0), 0); // Sum of *all* collections? Need more logic for "Weekly". Using total for now.
    const pendingCollectionsCount = myLoans.filter(l => l.outstandingAmount > 0).length;

    // Accurate Overdue Logic
    // Accessing customer details for loan
    const overdueCustomers = myLoans.filter(l => {
        const c = myCustomers.find(cust => cust.id === l.customerId);
        return c && isOverdue(c.lastPaidDate);
    });

    const fmt = (n: number) => {
        if (n >= 100000) return '₹' + (n / 100000).toFixed(2) + 'L';
        if (n >= 1000) return '₹' + (n / 1000).toFixed(1) + 'k';
        return '₹' + n.toLocaleString();
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin mr-2" /> Loading Dashboard...
            </div>
        );
    }


    const handleViewHistory = async (customer: Customer) => {
        setSelectedCustomerForHistory(customer);
        setShowHistoryModal(true);
        setLoadingHistory(true);
        try {
            const [txs, loans] = await Promise.all([
                PaymentService.getByCustomerId(customer.id).catch(() => []),
                LoanService.getByCustomerId(customer.id).catch(() => [])
            ]);
            setHistoryTransactions(txs);
            setHistoryLoans(loans);
        } catch (error) {
            console.error("Failed to fetch history:", error);
        } finally {
            setLoadingHistory(false);
        }
    };

    const handleAddCustomer = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentAgentId) return;

        console.log("Starting customer creation flow...");
        setIsUploading(true);

        try {
            let aadhaarEncrypted = '';
            let panEncrypted = '';

            // Step 1: Process Images
            if (aadhaarFile) {
                console.log("Processing Aadhaar image...", aadhaarFile.size);
                if (aadhaarFile.size > 10 * 1024 * 1024) throw new Error("Aadhaar image is too large (>10MB). Please pick a smaller file.");
                const base64 = await compressAndConvertToBase64(aadhaarFile);
                aadhaarEncrypted = encryptData(base64);
            }

            if (panFile) {
                console.log("Processing PAN image...", panFile.size);
                if (panFile.size > 10 * 1024 * 1024) throw new Error("PAN image is too large (>10MB). Please pick a smaller file.");
                const base64 = await compressAndConvertToBase64(panFile);
                panEncrypted = encryptData(base64);
            }

            // Step 2: Create Customer with Documents
            console.log("Uploading customer data to Firebase...");

            // Network Timeout Wrapper
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error("Network timeout: Server took too long to respond.")), 15000)
            );

            const createPromise = CustomerService.create({
                ...newCustomer,
                aadhaarImage: aadhaarEncrypted,
                panImage: panEncrypted,
                agentId: 'unassigned', // Customers are unassigned now, Loans have agents
                status: 'ACTIVE',
                kycStatus: 'PENDING',
                createdAt: Date.now()
            });

            const customerId = await Promise.race([createPromise, timeoutPromise]) as string;

            // Step 2.5: Create First Loan for this customer
            if (customerId) {
                await LoanService.create({
                    customerId: customerId,
                    agentId: currentAgentId!,
                    amount: newCustomer.loanAmount,
                    disbursedAmount: newCustomer.loanAmount, // Assuming fully disbursed for now
                    repaymentType: 'WEEKLY',
                    tenure: newCustomer.tenure,
                    paidAmount: 0,
                    outstandingAmount: newCustomer.loanAmount,
                    status: 'ACTIVE',
                    startDate: Date.now()
                });

                // Also update customer with agentId for list views
                await CustomerService.update(customerId, { agentId: currentAgentId! });
            }

            // Step 3: Success Handler
            console.log("Customer created successfully.");
            toast.success('Customer added successfully!');
            await refreshData(); // Helper to clean up
            resetForm();

        } catch (error: any) {
            console.error("Error in add customer flow:", error);

            // Step 4: Fallback for Firestore Size Limits
            if (error.code === 'resource-exhausted') {
                console.warn("Document too large, attempting fallback (no docs)...");
                try {
                    await CustomerService.create({
                        ...newCustomer,
                        agentId: 'unassigned',
                        status: 'ACTIVE',
                        kycStatus: 'PENDING',
                        createdAt: Date.now()
                    });

                    toast.success('Customer created, BUT documents were too large to upload. Please upload smaller documents later.');
                    await refreshData();
                    resetForm();

                } catch (retryError: any) {
                    console.error("Fallback failed:", retryError);
                    toast.error('Failed to add customer: ' + (retryError.message || 'Unknown error'));
                }
            } else {
                // Standard Error
                toast.error('Failed to add customer: ' + (error.message || 'Unknown error'));
            }
        } finally {
            console.log("Flow complete, stopping loader.");
            setIsUploading(false);
        }
    };

    const refreshData = async () => {
        if (currentAgentId) {
            const customers = await CustomerService.getByAgentId(currentAgentId);
            setMyCustomers(customers);
        }
    };

    const resetForm = () => {
        setShowAddCustomerModal(false);
        setNewCustomer({
            name: '',
            phone: '',
            address: '',
            loanAmount: 0,
            repaymentType: 'WEEKLY',
            tenure: 20
        });
        setAadhaarFile(null);
        setPanFile(null);
    };

    const handleUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault();

        if (passwordForm.newPassword !== passwordForm.confirmPassword) {
            toast.error("Passwords do not match");
            return;
        }

        if (passwordForm.newPassword.length < 6) {
            toast.error("Password must be at least 6 characters");
            return;
        }

        try {
            if (auth.currentUser) {
                await updatePassword(auth.currentUser, passwordForm.newPassword);
                toast.success("Password updated successfully!");
                setShowPasswordModal(false);
                setPasswordForm({ newPassword: '', confirmPassword: '' });
            } else {
                toast.error("User session not found. Please login again.");
            }
        } catch (error: any) {
            console.error("Password update error:", error);
            if (error.code === 'auth/requires-recent-login') {
                toast.error("For security, please logout and login again to change your password.");
            } else {
                toast.error("Failed to update password: " + error.message);
            }
        }
    };

    // ... Inside AgentDashboard component

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
            {/* Header & Search */}
            <div className="flex flex-col md:flex-row gap-6 justify-between items-start md:items-center">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Agent Dashboard</h1>
                    <p className="text-slate-600 dark:text-slate-400">Manage your portfolio and collections</p>
                </div>
                <div className="flex gap-4 w-full md:w-auto">
                    <div className="relative flex-1 md:w-80">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                        <input
                            type="text"
                            placeholder="Search customer..."
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg pl-10 pr-4 py-3 text-slate-900 dark:text-slate-200 focus:border-indigo-500 outline-none transition-all focus:ring-1 focus:ring-indigo-500"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    {/* Add Customer Button */}
                    <div className="flex-shrink-0 flex gap-2">
                        <Button onClick={() => setShowPasswordModal(true)} variant="secondary" className="h-full border border-slate-300 dark:border-slate-600">
                            Change Password
                        </Button>
                        <Button onClick={() => setShowAddCustomerModal(true)} className="h-full bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20">
                            <Users className="w-5 h-5 mr-2" /> Add Customer
                        </Button>
                    </div>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-slate-200 dark:border-slate-800">
                {[
                    { id: 'overview', label: 'Overview', icon: Users },
                    { id: 'customers', label: 'My Customers', icon: Phone },
                    { id: 'reports', label: 'Reports', icon: FileText },
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as 'overview' | 'customers' | 'reports')}
                        className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.id
                            ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                            : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                            }`}
                    >
                        <tab.icon className="w-4 h-4" />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* --- OVERVIEW TAB --- */}
            {activeTab === 'overview' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 overflow-x-auto pb-4 md:pb-0 snap-x snap-mandatory md:snap-none disabled:snap-none">
                        <StatCard
                            title="Active Loans"
                            value={myLoans.length}
                            icon={Users}
                            color="blue"
                        />
                        <StatCard
                            title="Total Collected"
                            value={fmt(collectedAmount)}
                            icon={Banknote}
                            color="emerald"
                        />
                        <StatCard
                            title="Pending Dues"
                            value={pendingCollectionsCount}
                            subValue="Customers"
                            icon={AlertCircle}
                            color="amber"
                        />
                        <StatCard
                            title="Commission (Est.)"
                            value={fmt(expectedWeeklyEarnings)}
                            icon={IndianRupee}
                            color="purple"
                        />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Today's Schedule / Pending List Preview */}
                        <div className="lg:col-span-2 space-y-6">
                            <div className="flex justify-between items-center">
                                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Pending Collections</h3>
                                <Button variant="ghost" className="text-indigo-500 dark:text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300" onClick={() => setActiveTab('customers')}>
                                    View All <ChevronRight className="w-4 h-4 ml-1" />
                                </Button>
                            </div>

                            <div className="space-y-4">
                                {portfolioItems.slice(0, 5).map(item => {
                                    // Loan specific info is in 'item'
                                    return (
                                        <Card key={item.loanId} className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors p-4 flex items-center justify-between group">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-lg font-bold text-slate-600 dark:text-slate-300">
                                                    {item.name.charAt(0)}
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-slate-800 dark:text-slate-200 group-hover:text-indigo-500 dark:group-hover:text-indigo-400 transition-colors">{item.name}</h4>
                                                    <div className="flex items-center gap-3 text-sm text-slate-500 mt-1">
                                                        <a href={`tel:${item.phone}`} className="flex items-center gap-1 hover:text-indigo-500"><Phone className="w-3 h-3" /> {item.phone}</a>
                                                        <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {item.address}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs text-slate-500 uppercase tracking-wider">Outstanding</p>
                                                <p className="text-lg font-bold text-amber-500">{fmt(item.outstandingAmount || 0)}</p>
                                            </div>
                                        </Card>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Quick Actions / Mini Reports */}
                        <div className="space-y-6">
                            <Card className="bg-gradient-to-br from-indigo-900 to-slate-900 border-indigo-500/30 p-6 text-white">
                                <h3 className="text-lg font-bold mb-4">Weekly Target</h3>
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm text-indigo-200">
                                        <span>Achieved</span>
                                        <span className="font-bold text-white">{fmt(weeklyAchieved)} / {fmt(weeklyTarget)}</span>
                                    </div>
                                    <div className="w-full bg-indigo-950 rounded-full h-2 overflow-hidden">
                                        <div
                                            className="bg-indigo-400 h-full rounded-full transition-all duration-1000"
                                            style={{ width: `${(weeklyAchieved / weeklyTarget) * 100}%` }}
                                        ></div>
                                    </div>
                                    <p className="text-xs text-indigo-300 mt-2 text-right">65% Completed</p>
                                </div>
                            </Card>

                            <Card className="bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 p-6">
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Quick Actions</h3>
                                <div className="space-y-3">
                                    <Button className="w-full justify-start bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200">
                                        <Calendar className="w-4 h-4 mr-3 text-indigo-500" /> View Schedule
                                    </Button>
                                    <Button onClick={() => navigate('/agent/collections')} className="w-full justify-start bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200">
                                        <FileText className="w-4 h-4 mr-3 text-emerald-500" /> Generate Receipt
                                    </Button>
                                </div>
                            </Card>
                        </div>
                    </div>
                </div>
            )}

            {/* --- MY CUSTOMERS TAB --- */}
            {activeTab === 'customers' && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white">All Customers</h2>
                        <div className="flex gap-2">
                            <select
                                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-sm rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-indigo-500"
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value as any)}
                            >
                                <option value="name">Sort by Name</option>
                                <option value="outstanding">Sort by Outstanding</option>
                                <option value="status">Sort by Status</option>
                            </select>
                            <button
                                className="p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
                                onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                            >
                                {sortOrder === 'asc' ? '↑' : '↓'}
                            </button>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {portfolioItems.map(item => {
                            return (
                                <Card key={item.loanId} className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-indigo-500/50 transition-all p-0 overflow-hidden group">
                                    <div className="p-6">
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-xl font-bold text-white shadow-lg">
                                                {item.name.charAt(0)}
                                            </div>
                                            <div className={`px-2 py-1 rounded text-xs font-bold border ${item.status === 'ACTIVE'
                                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                                                : 'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400'
                                                }`}>
                                                {item.status || 'ACTIVE'}
                                            </div>
                                        </div>
                                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1 group-hover:text-indigo-500 dark:group-hover:text-indigo-400 transition-colors">{item.name}</h3>
                                        <div className="space-y-1 mb-4">
                                            <a href={`tel:${item.phone}`} className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-2 hover:text-indigo-500 transition-colors">
                                                <Phone className="w-3 h-3" /> {item.phone}
                                            </a>
                                            <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-2">
                                                <MapPin className="w-3 h-3" /> {item.address}
                                            </p>
                                        </div>

                                        <div className="px-3 py-2 bg-slate-50 dark:bg-slate-900/50 rounded-lg mb-4 text-xs text-slate-500">
                                            Loan ID: <span className="font-mono text-slate-700 dark:text-slate-300">{item.loanId.slice(0, 8)}</span>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4 py-4 border-t border-slate-200 dark:border-slate-700/50">
                                            <div>
                                                <p className="text-xs text-slate-500 uppercase">Principal</p>
                                                <p className="font-medium text-slate-700 dark:text-slate-200">{fmt(item.amount || 0)}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs text-slate-500 uppercase">Outstanding</p>
                                                <p className="font-bold text-amber-500">{fmt(item.outstandingAmount || 0)}</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="bg-slate-50 dark:bg-slate-900/50 p-3 flex gap-2">
                                        <Button
                                            size="sm"
                                            variant="secondary"
                                            className="w-full text-xs"
                                            onClick={() => handleViewHistory(item as any)}
                                        >
                                            History
                                        </Button>
                                        <Button
                                            size="sm"
                                            className="w-full text-xs bg-indigo-600 hover:bg-indigo-500 text-white"
                                            onClick={() => navigate('/agent/collections')}
                                        >
                                            Collect Payment
                                        </Button>
                                    </div>
                                </Card>
                            );
                        })}
                    </div>
                    {portfolioItems.length === 0 && (
                        <EmptyState
                            title="No loans assigned yet"
                            description="Ask an admin to assign customers to your account."
                            icon={Users}
                            actionLabel="Refresh Data"
                            onAction={() => window.location.reload()}
                        />
                    )}
                </div>
            )}

            {/* --- REPORTS TAB --- */}
            {activeTab === 'reports' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 overflow-hidden">
                        <div className="p-6 border-b border-slate-200 dark:border-slate-700">
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <AlertCircle className="w-5 h-5 text-red-500" />
                                Overdue Payments (8+ Days / 30+ Days)
                            </h3>
                            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Customers exceeding grace period</p>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
                                <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 uppercase font-semibold text-xs">
                                    <tr>
                                        <th className="px-6 py-4">Customer</th>
                                        <th className="px-6 py-4 text-center">Type</th>
                                        <th className="px-6 py-4 text-right">Last Paid</th>
                                        <th className="px-6 py-4 text-right">Days Overdue</th>
                                        <th className="px-6 py-4 text-right">Outstanding</th>
                                        <th className="px-6 py-4 text-center">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 dark:divide-slate-700/50">
                                    {overdueCustomers.map(loan => {
                                        const cust = myCustomers.find(c => c.id === loan.customerId);
                                        if (!cust) return null;

                                        const daysLate = getDaysOverdue(cust.lastPaidDate);
                                        const collectionAmt = loan.outstandingAmount || 0;

                                        return (
                                            <tr key={cust.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                                                <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                                                    {cust.name}
                                                    <div className="text-xs text-slate-500">{cust.phone}</div>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className="px-2 py-1 rounded-full text-xs bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                                                        Weekly
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-right text-slate-500 dark:text-slate-400">
                                                    {cust.lastPaidDate ? new Date(cust.lastPaidDate).toLocaleDateString() : 'Never'}
                                                </td>
                                                <td className="px-6 py-4 text-right text-red-500 font-bold">
                                                    {daysLate} Days
                                                </td>
                                                <td className="px-6 py-4 text-right text-slate-900 dark:text-slate-200 font-mono">
                                                    {fmt(collectionAmt)}
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className="px-2 py-0.5 rounded text-xs font-bold bg-red-500/10 text-red-500 dark:bg-red-500/20 dark:text-red-400">
                                                        OVERDUE
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {overdueCustomers.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                                                No overdue payments found.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </Card>

                    {/* Collection History Report */}
                    <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 overflow-hidden">
                        <div className="p-6 border-b border-slate-200 dark:border-slate-700">
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <Banknote className="w-5 h-5 text-emerald-500" />
                                Recent Collections
                            </h3>
                            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">History of payments collected by you</p>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
                                <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 uppercase font-semibold text-xs">
                                    <tr>
                                        <th className="px-6 py-4">Date</th>
                                        <th className="px-6 py-4">Customer ID</th>
                                        <th className="px-6 py-4 text-right">Amount</th>
                                        <th className="px-6 py-4">Description</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 dark:divide-slate-700/50">
                                    {myPayments.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                                                No collections found.
                                            </td>
                                        </tr>
                                    ) : (
                                        myPayments.slice(0, 50).map(pay => (
                                            <tr key={pay.id || Math.random()} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                                                <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                                                    {new Date(pay.date).toLocaleDateString()} <span className="text-xs text-slate-400">{new Date(pay.date).toLocaleTimeString()}</span>
                                                </td>
                                                <td className="px-6 py-4 font-mono text-xs">
                                                    {myCustomers.find(c => c.id === pay.customerId)?.name || pay.customerId}
                                                </td>
                                                <td className="px-6 py-4 text-right font-bold text-emerald-600">
                                                    {fmt(pay.amount)}
                                                </td>
                                                <td className="px-6 py-4 text-slate-500">
                                                    {pay.description || '-'}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </Card>

                    {/* Analytics Charts */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-6">
                        {/* Weekly Collections Bar Chart */}
                        <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 p-6">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Collection Performance (Last 7 Days)</h3>
                            <div className="h-64">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={chartData.weekly}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                                        <XAxis dataKey="day" stroke="#94a3b8" />
                                        <YAxis stroke="#94a3b8" />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc' }}
                                            itemStyle={{ color: '#f8fafc' }}
                                        />
                                        <Bar dataKey="amount" fill="#6366f1" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </Card>

                        {/* Customer Status Pie Chart */}
                        <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 p-6">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Customer Status Distribution</h3>
                            <div className="h-64 flex items-center justify-center">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={chartData.status}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={80}
                                            paddingAngle={5}
                                            dataKey="value"
                                        >
                                            {chartData.status.map((_, index) => (
                                                <Cell key={`cell-${index}`} fill={['#10b981', '#ef4444', '#64748b', '#f59e0b'][index % 4]} />
                                            ))}
                                        </Pie>
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc' }}
                                        />
                                        <Legend />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        </Card>

                        {/* Collection Trend Line Chart */}
                        <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 p-6 lg:col-span-2">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Monthly Collection Trend</h3>
                            <div className="h-64">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={chartData.trend}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
                                        <XAxis dataKey="day" stroke="#94a3b8" />
                                        <YAxis stroke="#94a3b8" />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc' }}
                                        />
                                        <Line type="monotone" dataKey="amount" stroke="#8b5cf6" strokeWidth={3} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </Card>
                    </div>
                </div>
            )}

            {/* --- ADD CUSTOMER MODAL --- */}
            {showAddCustomerModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 dark:bg-black/80 backdrop-blur-sm">
                    <Card className="w-full max-w-lg bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 shadow-xl max-h-[90vh] overflow-y-auto">
                        <div className="p-6">
                            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">Add New Customer</h2>
                            <form onSubmit={handleAddCustomer} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-400 mb-1">Full Name</label>
                                    <input
                                        type="text"
                                        className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                        value={newCustomer.name}
                                        onChange={e => setNewCustomer({ ...newCustomer, name: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-400 mb-1">Phone Number</label>
                                        <input
                                            type="tel"
                                            className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                            value={newCustomer.phone}
                                            onChange={e => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-400 mb-1">Loan Amount</label>
                                        <input
                                            type="number"
                                            className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                            value={newCustomer.loanAmount}
                                            onChange={e => setNewCustomer({ ...newCustomer, loanAmount: Number(e.target.value) })}
                                            required
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-400 mb-1">Address</label>
                                    <textarea
                                        className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none h-20"
                                        value={newCustomer.address}
                                        onChange={e => setNewCustomer({ ...newCustomer, address: e.target.value })}
                                        required
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-400 mb-1">Aadhaar Card (Image)</label>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 dark:file:bg-indigo-900/30 dark:file:text-indigo-300"
                                            onChange={e => setAadhaarFile(e.target.files?.[0] || null)}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-400 mb-1">PAN Card (Image)</label>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 dark:file:bg-indigo-900/30 dark:file:text-indigo-300"
                                            onChange={e => setPanFile(e.target.files?.[0] || null)}
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-400 mb-1">Repayment Type</label>
                                        <select
                                            className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                            value={newCustomer.repaymentType}
                                            onChange={e => setNewCustomer({ ...newCustomer, repaymentType: e.target.value as any })}
                                        >
                                            <option value="WEEKLY">Weekly</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-400 mb-1">Tenure ({newCustomer.repaymentType === 'WEEKLY' ? 'Weeks' : 'Months'})</label>
                                        <input
                                            type="number"
                                            className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                            value={newCustomer.tenure}
                                            onChange={e => setNewCustomer({ ...newCustomer, tenure: Number(e.target.value) })}
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="flex gap-4 pt-4">
                                    <Button type="button" variant="ghost" className="flex-1" onClick={() => setShowAddCustomerModal(false)}>Cancel</Button>
                                    <Button type="submit" className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white" disabled={isUploading}>
                                        {isUploading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Saving...</> : 'Create Customer'}
                                    </Button>
                                </div>
                            </form>
                        </div>
                    </Card>
                </div>
            )}

            {/* --- HISTORY MODAL --- */}
            {showHistoryModal && selectedCustomerForHistory && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 dark:bg-black/80 backdrop-blur-sm">
                    <Card className="w-full max-w-4xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 shadow-xl max-h-[90vh] flex flex-col">
                        <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                            <div>
                                <h2 className="text-xl font-bold text-slate-900 dark:text-white">{selectedCustomerForHistory?.name}</h2>
                                <p className="text-sm text-slate-500 dark:text-slate-400">Transaction History</p>
                            </div>
                            <Button size="sm" variant="ghost" onClick={() => setShowHistoryModal(false)}>Close</Button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 space-y-8">

                            {/* --- LOAN SUMMARY SECTION --- */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <Card className="bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 p-4">
                                    <p className="text-xs text-slate-500 uppercase tracking-wider font-bold">Total Principal</p>
                                    <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                                        ₹{((historyLoans.length > 0)
                                            ? historyLoans.reduce((sum, l) => sum + (l.amount || 0), 0)
                                            : (selectedCustomerForHistory.totalLoanAmount || selectedCustomerForHistory.loanAmount || 0)).toLocaleString()}
                                    </p>
                                </Card>
                                <Card className="bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 p-4">
                                    <p className="text-xs text-slate-500 uppercase tracking-wider font-bold">Total Paid</p>
                                    <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                                        ₹{((historyLoans.length > 0)
                                            ? historyLoans.reduce((sum, l) => sum + (l.paidAmount || 0), 0)
                                            : (selectedCustomerForHistory.totalPaidAmount || 0)).toLocaleString()}
                                    </p>
                                </Card>
                                <Card className="bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 p-4">
                                    <p className="text-xs text-slate-500 uppercase tracking-wider font-bold">Total Outstanding</p>
                                    <p className="text-xl font-bold text-amber-600 dark:text-amber-400 mt-1">
                                        ₹{((historyLoans.length > 0)
                                            ? historyLoans.reduce((sum, l) => sum + (l.outstandingAmount || 0), 0)
                                            : (selectedCustomerForHistory.currentDueAmount || selectedCustomerForHistory.loanAmount || 0)).toLocaleString()}
                                    </p>
                                </Card>
                            </div>

                            {/* --- ACTIVE LOANS DETAILED --- */}
                            <div className="space-y-4">
                                <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                    <Banknote className="w-5 h-5 text-indigo-500" /> Active Loans
                                </h3>
                                <div className="space-y-3">
                                    {historyLoans.length === 0 ? (
                                        <div className="text-center py-6 text-slate-500 bg-slate-50 dark:bg-slate-800 rounded-lg border border-dashed border-slate-300">No active loans found.</div>
                                    ) : (
                                        historyLoans.map(loan => (
                                            <div key={loan.id} className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800/40 flex justify-between items-center group hover:border-indigo-500/30 transition-all">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-slate-900 dark:text-white">₹{loan.amount.toLocaleString()}</span>
                                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${loan.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{loan.status}</span>
                                                    </div>
                                                    <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-2">
                                                        <span className="text-indigo-600 font-medium">Disbursed: ₹{(loan.disbursedAmount || 0).toLocaleString()}</span>
                                                        <span>•</span>
                                                        <span className="text-amber-600 font-medium">Bal: ₹{loan.outstandingAmount.toLocaleString()}</span>
                                                    </div>
                                                </div>
                                                <div className="text-right flex flex-col items-end gap-1">
                                                    <div className="text-[10px] font-bold text-slate-600 dark:text-slate-400">
                                                        {new Date(loan.startDate).toLocaleDateString()}
                                                    </div>
                                                    <div className="text-[10px] text-slate-400">
                                                        {new Date(loan.startDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </div>
                                                    <div className="text-[10px] bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-slate-500 mt-1">
                                                        Term: {loan.tenure}W
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            {/* --- DOCUMENTS SECTION --- */}
                            {(selectedCustomerForHistory?.aadhaarImage || selectedCustomerForHistory?.panImage) && (
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center">
                                        <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                            <FileText className="w-5 h-5 text-indigo-500" /> KYC Documents
                                        </h3>
                                        <Button size="sm" variant="secondary" onClick={() => {
                                            setCustomerToEdit(selectedCustomerForHistory);
                                            setShowEditCustomerModal(true);
                                        }}>
                                            Edit / Upload
                                        </Button>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {selectedCustomerForHistory.aadhaarImage && (
                                            <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 bg-slate-50 dark:bg-slate-800">
                                                <p className="text-sm font-bold text-slate-500 mb-2 uppercase flex items-center gap-2">Aadhaar Card <span className="text-xs font-normal lowercase bg-emerald-100 text-emerald-700 px-1 rounded">Encrypted</span></p>
                                                <div
                                                    className="relative aspect-video bg-slate-200 dark:bg-slate-700 rounded-lg overflow-hidden group cursor-pointer hover:ring-2 hover:ring-indigo-500 transition-all"
                                                    onClick={() => setViewingImage({
                                                        url: decryptData(selectedCustomerForHistory.aadhaarImage!),
                                                        title: `${selectedCustomerForHistory.name} - Aadhaar`
                                                    })}
                                                >
                                                    <img
                                                        src={decryptData(selectedCustomerForHistory.aadhaarImage)}
                                                        alt="Aadhaar"
                                                        className="w-full h-full object-cover transition-transform group-hover:scale-105"
                                                    />
                                                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <span className="text-white text-xs font-bold bg-black/50 px-3 py-1.5 rounded-full backdrop-blur-sm border border-white/20 flex items-center gap-2">
                                                            <ZoomIn className="w-3 h-3" /> View Full
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                        {selectedCustomerForHistory.panImage && (
                                            <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 bg-slate-50 dark:bg-slate-800">
                                                <p className="text-sm font-bold text-slate-500 mb-2 uppercase flex items-center gap-2">PAN Card <span className="text-xs font-normal lowercase bg-emerald-100 text-emerald-700 px-1 rounded">Encrypted</span></p>
                                                <div
                                                    className="relative aspect-video bg-slate-200 dark:bg-slate-700 rounded-lg overflow-hidden group cursor-pointer hover:ring-2 hover:ring-indigo-500 transition-all"
                                                    onClick={() => setViewingImage({
                                                        url: decryptData(selectedCustomerForHistory.panImage!),
                                                        title: `${selectedCustomerForHistory.name} - PAN`
                                                    })}
                                                >
                                                    <img
                                                        src={decryptData(selectedCustomerForHistory.panImage)}
                                                        alt="PAN"
                                                        className="w-full h-full object-cover transition-transform group-hover:scale-105"
                                                    />
                                                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <span className="text-white text-xs font-bold bg-black/50 px-3 py-1.5 rounded-full backdrop-blur-sm border border-white/20 flex items-center gap-2">
                                                            <ZoomIn className="w-3 h-3" /> View Full
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            <div>
                                <h3 className="font-bold text-slate-800 dark:text-white mb-4">Transaction History</h3>
                                {loadingHistory ? (
                                    <div className="text-center py-10"><Loader2 className="animate-spin text-indigo-500 w-8 h-8 mx-auto" /></div>
                                ) : historyTransactions.length === 0 ? (
                                    <div className="text-center py-10 text-slate-500">No transactions found.</div>
                                ) : (
                                    <table className="w-full text-left">
                                        <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-800">
                                            <tr>
                                                <th className="px-4 py-3">Date</th>
                                                <th className="px-4 py-3">Amount</th>
                                                <th className="px-4 py-3">Type</th>
                                                <th className="px-4 py-3">Description</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                            {historyTransactions.map((tx: any) => (
                                                <tr key={tx.id}>
                                                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{new Date(tx.date).toLocaleDateString()}</td>
                                                    <td className="px-4 py-3 font-bold text-emerald-600">+{fmt(tx.amount)}</td>
                                                    <td className="px-4 py-3 text-xs">{tx.type}</td>
                                                    <td className="px-4 py-3 text-sm text-slate-500">{tx.description}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        </div>
                    </Card>
                </div>
            )}

            {/* --- EDIT DOCUMENTS MODAL --- */}
            {showEditCustomerModal && customerToEdit && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 dark:bg-black/80 backdrop-blur-sm">
                    <Card className="w-full max-w-md bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 shadow-xl">
                        <div className="p-6">
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6">Update Documents</h2>
                            <p className="text-sm text-slate-500 mb-4">Upload new documents for {customerToEdit.name}. Existing documents will be replaced.</p>

                            <form onSubmit={async (e) => {
                                e.preventDefault();
                                setIsUploading(true);
                                try {
                                    const updates: any = {};
                                    if (aadhaarFile) {
                                        if (aadhaarFile.size > 10 * 1024 * 1024) throw new Error("Aadhaar too large");
                                        const base64 = await compressAndConvertToBase64(aadhaarFile);
                                        updates.aadhaarImage = encryptData(base64);
                                    }
                                    if (panFile) {
                                        if (panFile.size > 10 * 1024 * 1024) throw new Error("PAN too large");
                                        const base64 = await compressAndConvertToBase64(panFile);
                                        updates.panImage = encryptData(base64);
                                    }

                                    if (Object.keys(updates).length > 0) {
                                        await CustomerService.update(customerToEdit.id, updates);
                                        // Update state locally to reflect changes
                                        const updatedCustomer = { ...customerToEdit, ...updates };
                                        setCustomerToEdit(updatedCustomer);
                                        setSelectedCustomerForHistory(updatedCustomer); // Update history modal too
                                        await refreshData();
                                        alert("Documents updated successfully!");
                                        setShowEditCustomerModal(false);
                                        setAadhaarFile(null);
                                        setPanFile(null);
                                    } else {
                                        alert("No files selected.");
                                    }
                                } catch (err: any) {
                                    console.error(err);
                                    alert("Update failed: " + err.message);
                                } finally {
                                    setIsUploading(false);
                                }
                            }}>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-400 mb-1">New Aadhaar Card</label>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 dark:file:bg-indigo-900/30 dark:file:text-indigo-300"
                                            onChange={e => setAadhaarFile(e.target.files?.[0] || null)}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-400 mb-1">New PAN Card</label>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 dark:file:bg-indigo-900/30 dark:file:text-indigo-300"
                                            onChange={e => setPanFile(e.target.files?.[0] || null)}
                                        />
                                    </div>
                                </div>
                                <div className="flex gap-4 pt-6">
                                    <Button type="button" variant="ghost" className="flex-1" onClick={() => setShowEditCustomerModal(false)}>Cancel</Button>
                                    <Button type="submit" className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white" disabled={isUploading}>
                                        {isUploading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Updating...</> : 'Update Documents'}
                                    </Button>
                                </div>
                            </form>
                        </div>
                    </Card>
                </div>
            )}

            {/* --- PASSWORD MODAL --- */}
            {showPasswordModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 dark:bg-black/80 backdrop-blur-sm">
                    <Card className="w-full max-w-md bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 shadow-xl">
                        <div className="p-6">
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6">Change Password</h2>
                            <form onSubmit={handleUpdatePassword} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-400 mb-1">New Password</label>
                                    <input
                                        type="password"
                                        className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                        value={passwordForm.newPassword}
                                        onChange={e => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                                        required
                                        minLength={6}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-400 mb-1">Confirm Password</label>
                                    <input
                                        type="password"
                                        className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                        value={passwordForm.confirmPassword}
                                        onChange={e => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                                        required
                                        minLength={6}
                                    />
                                </div>
                                <div className="flex gap-4 pt-4">
                                    <Button type="button" variant="ghost" className="flex-1" onClick={() => setShowPasswordModal(false)}>Cancel</Button>
                                    <Button type="submit" className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white">Update Password</Button>
                                </div>
                            </form>
                        </div>
                    </Card>
                </div>
            )}

            {/* --- END OF AGENT DASHBOARD --- */}
            <ImageViewerModal
                isOpen={!!viewingImage}
                onClose={() => setViewingImage(null)}
                imageUrl={viewingImage?.url || ''}
                title={viewingImage?.title || ''}
            />
        </div>
    );
};
