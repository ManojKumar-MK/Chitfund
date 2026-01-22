import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Plus, Search, UserPlus, Phone, MapPin, Edit2, Wallet, FileText, Clock, Loader2, UploadCloud, ZoomIn, Camera, Trash2, LayoutGrid, List, History, Banknote } from 'lucide-react';
import { useSettings } from '../../context/SettingsContext';
import { CustomerService } from '../../services/customerService';
import { PaymentService } from '../../services/paymentService';
import { LoanService } from '../../services/loanService';
import { CollectionService } from '../../services/collectionService';
import { ActivityService } from '../../services/activityService';
import { compressAndConvertToBase64, encryptData, decryptData } from '../../lib/encryption';
import type { Customer, Transaction, Loan, Collection } from '../../types';
import { EmptyState } from '../../components/ui/EmptyState';
import { ImageViewerModal } from '../../components/ui/ImageViewerModal';
import { DeleteConfirmationModal } from '../../components/ui/DeleteConfirmationModal';

export const Customers = () => {
    const { settings } = useSettings();
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [collections, setCollections] = useState<Collection[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [showInactive, setShowInactive] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);
    const [viewMode, setViewMode] = useState<'GRID' | 'LIST'>('GRID');
    const [selectedCustomerForReport, setSelectedCustomerForReport] = useState<Customer | null>(null);
    const [customerTransactions, setCustomerTransactions] = useState<Transaction[]>([]);
    const [customerActivities, setCustomerActivities] = useState<any[]>([]);
    const [customerLoans, setCustomerLoans] = useState<Loan[]>([]); // New State for Loans
    const [reportRefreshKey, setReportRefreshKey] = useState(0); // Trigger for report refresh
    const [agents, setAgents] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Delete Modal State
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
    const [loadingReport, setLoadingReport] = useState(false);

    // Loan Modal State
    const [showLoanModal, setShowLoanModal] = useState(false);
    const [activeCustomerId, setActiveCustomerId] = useState<string | null>(null);

    // Form State
    const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [address, setAddress] = useState('');
    const [loanAmount, setLoanAmount] = useState('');
    const [disbursedAmount, setDisbursedAmount] = useState('');
    const [repaymentType, setRepaymentType] = useState<'WEEKLY'>('WEEKLY');
    // Secure Upload State
    const [aadhaarFile, setAadhaarFile] = useState<File | null>(null);
    const [panFile, setPanFile] = useState<File | null>(null);
    const [photoFile, setPhotoFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);

    // Viewer State
    const [viewingImage, setViewingImage] = useState<{ url: string; title: string } | null>(null);

    const calculateInstallment = (principal: number) => {
        return principal * 0.10; // 10% of principal every week
    };

    useEffect(() => {
        fetchCustomers();
    }, []);

    useEffect(() => {
        const fetchReportData = async () => {
            if (selectedCustomerForReport) {
                setLoadingReport(true);
                try {
                    // Fetch data with individual error handling to prevent one failure (e.g. missing index) from breaking everything
                    const [txs, loans, activities] = await Promise.all([
                        PaymentService.getByCustomerId(selectedCustomerForReport.id).catch(e => { console.error("Txs fetch error", e); return []; }),
                        LoanService.getByCustomerId(selectedCustomerForReport.id).catch(e => { console.error("Loans fetch error", e); return []; }),
                        ActivityService.getCustomerActivities(selectedCustomerForReport.id).catch(e => { console.error("Activities fetch error", e); return []; })
                    ]);

                    setCustomerTransactions(txs);
                    setCustomerLoans(loans);
                    setCustomerActivities(activities.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)));
                } catch (e) {
                    console.error("Critical error in report data fetch", e);
                } finally {
                    setLoadingReport(false);
                }
            } else {
                setCustomerTransactions([]);
                setCustomerLoans([]);
                setCustomerActivities([]);
            }
        };
        fetchReportData();
    }, [selectedCustomerForReport, reportRefreshKey]);

    const fetchCustomers = async () => {
        setIsLoading(true);
        try {
            const [data, colls, fetchedAgents] = await Promise.all([
                CustomerService.getAll(),
                CollectionService.getAll(),
                import('../../services/userService').then(m => m.UserService.getAgents())
            ]);
            setCustomers(data);
            setCollections(colls);
            setAgents(fetchedAgents);
        } catch (error) {
            console.error("Error fetching customers:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const openAddModal = () => {
        setEditingCustomer(null);
        resetForm();
        setShowAddModal(true);
    };

    const openEditModal = (customer: Customer, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingCustomer(customer);
        setName(customer.name);
        setPhone(customer.phone);
        setEmail(customer.email || '');
        setAddress(customer.address || '');
        if (customer.totalLoanAmount) {
            setLoanAmount(customer.totalLoanAmount.toString()); // Just for display/logic, won't save
        } else {
            setLoanAmount(customer.loanAmount?.toString() || '');
        }
        setDisbursedAmount(customer.disbursedAmount?.toString() || (customer.totalDisbursedAmount?.toString() || ''));
        setRepaymentType(customer.repaymentType || 'WEEKLY');
        setAadhaarFile(null);
        setPanFile(null);
        setShowAddModal(true);
    };

    const resetForm = () => {
        setName('');
        setPhone('');
        setEmail('');
        setAddress('');
        setLoanAmount('');
        setDisbursedAmount('');
        setRepaymentType('WEEKLY');
        setAadhaarFile(null);
        setPanFile(null);
    };

    // New Loan Handler
    const handleSaveLoan = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!activeCustomerId) return;

        try {
            await LoanService.create({
                customerId: activeCustomerId,
                agentId: 'unassigned', // Or select agent
                amount: parseFloat(loanAmount),
                disbursedAmount: parseFloat(disbursedAmount),
                repaymentType: repaymentType,
                tenure: 20, // Default for now
                paidAmount: 0,
                outstandingAmount: parseFloat(loanAmount),
                status: 'ACTIVE',
                startDate: Date.now()
            } as any);

            toast.success("New loan added successfully");
            setShowLoanModal(false);
            resetForm();

            // Refresh report if open
            if (selectedCustomerForReport?.id === activeCustomerId) {
                setReportRefreshKey(prev => prev + 1);
            }
            fetchCustomers();

        } catch (e: any) {
            toast.error("Failed to add loan: " + e.message);
        }
    };

    const handleFileChange = (setter: (f: File | null) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            if (file.size > 5 * 1024 * 1024) {
                toast.error("File too large. Please select an image under 5MB.");
                return;
            }
            setter(file);
        }
    };
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isUploading) return;
        setIsUploading(true);

        try {
            console.log("Processing secure document uploads...");

            // IF ADDING NEW CUSTOMER -> Create Customer Profile AND First Loan
            // IF EDITING -> Just update Profile (Loan updates should be separate, possibly restricted)

            let aadhaarEncrypted = '';
            let panEncrypted = '';
            let photoEncrypted = '';

            try {
                if (aadhaarFile) {
                    const base64 = await compressAndConvertToBase64(aadhaarFile);
                    aadhaarEncrypted = encryptData(base64);
                }
                if (panFile) {
                    const base64 = await compressAndConvertToBase64(panFile);
                    panEncrypted = encryptData(base64);
                }
                if (photoFile) {
                    const base64 = await compressAndConvertToBase64(photoFile);
                    photoEncrypted = encryptData(base64);
                }
            } catch (imgError: any) {
                console.error("Image processing failed:", imgError);
                throw new Error("Failed to process images: " + imgError.message);
            }

            const customerData = {
                name,
                phone,
                email,
                address,
                loanAmount: parseFloat(loanAmount) || 0,
                disbursedAmount: parseFloat(disbursedAmount) || 0,
                repaymentType,
                // Unified Schema: Secure Encrypted Fields
                photo: photoEncrypted,
                kycStatus: ((aadhaarEncrypted || panEncrypted) ? 'VERIFIED' : 'PENDING') as 'VERIFIED' | 'PENDING'
            };

            let actionPromise;

            if (editingCustomer) {
                actionPromise = CustomerService.update(editingCustomer.id, customerData);

                const agentName = agents.find(a => a.uid === editingCustomer.agentId)?.displayName || 'Unassigned';
                await ActivityService.log({
                    type: 'STATUS_CHANGE',
                    customerId: editingCustomer.id,
                    customerName: name,
                    agentId: editingCustomer.agentId,
                    agentName,
                    description: `Customer ${name} profile updated`,
                    timestamp: Date.now()
                });
            } else {
                actionPromise = CustomerService.create({
                    ...customerData,
                    agentId: 'unassigned',
                    status: 'ACTIVE',
                    createdAt: Date.now()
                } as any).then(async (newId) => {
                    if (newId) {
                        // Create First Loan
                        await LoanService.create({
                            customerId: newId,
                            agentId: 'unassigned',
                            amount: customerData.loanAmount,
                            disbursedAmount: customerData.disbursedAmount,
                            repaymentType: 'WEEKLY',
                            tenure: 20, // Default tenure
                            paidAmount: 0,
                            outstandingAmount: customerData.loanAmount, // Initially full amount
                            status: 'ACTIVE',
                            startDate: Date.now()
                        });

                        await ActivityService.log({
                            type: 'LOAN_CREATED',
                            customerId: newId,
                            customerName: name,
                            description: `New Customer ${name} registered with loan of ₹${customerData.loanAmount}`,
                            timestamp: Date.now()
                        });
                    }
                    return newId;
                });
            }

            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error("Network timeout. Please check your connection.")), 15000)
            );

            await Promise.race([actionPromise, timeoutPromise]);

            await fetchCustomers();
            setShowAddModal(false);
            resetForm();
            toast.success("Customer saved successfully!");
        } catch (error: any) {
            console.error("Error saving customer:", error);
            if (error.code === 'resource-exhausted') {
                toast.error("The documents are too large for the database. Please use smaller images.");
            } else {
                toast.error("Failed to save customer: " + (error.message || "Unknown error"));
            }
        } finally {
            setIsUploading(false);
        }
    };

    const handleOpenDeleteModal = (customer: Customer, e: React.MouseEvent) => {
        e.stopPropagation();
        setCustomerToDelete(customer);
        setShowDeleteModal(true);
    };

    const confirmDelete = async () => {
        if (!customerToDelete) return;
        try {
            await CustomerService.delete(customerToDelete.id);
            toast.success("Customer deleted permanently");
            await fetchCustomers();
            setShowDeleteModal(false);
            setCustomerToDelete(null);
        } catch (error) {
            toast.error("Failed to delete customer");
        }
    };

    const confirmDeactivate = async () => {
        if (!customerToDelete) return;
        try {
            await CustomerService.update(customerToDelete.id, { status: 'INACTIVE' });
            toast.success("Customer deactivated");
            await fetchCustomers();
            setShowDeleteModal(false);
            setCustomerToDelete(null);
        } catch (error) {
            toast.error("Failed to deactivate customer");
        }
    };

    const getDueTillNow = (customer: Customer) => {
        // If we have an aggregate, use it (This is updated by LoanService)
        if (customer.currentDueAmount !== undefined) return customer.currentDueAmount;

        // Fallback for legacy data/un-aggregated data
        const loanAmt = customer.loanAmount || 0;
        const installment = calculateInstallment(loanAmt);

        // This is a rough estimation for legacy
        const elapsedMs = Date.now() - (customer.createdAt || Date.now());
        const weeksElapsed = Math.max(1, Math.floor(elapsedMs / (7 * 24 * 60 * 60 * 1000)));
        const expectedTotal = weeksElapsed * installment;

        // Use single collection record as fallback
        const collection = collections.find(c => c.customerId === customer.id);
        const outstanding = collection ? collection.outstanding : loanAmt;
        const paid = loanAmt - outstanding;

        return Math.max(0, Math.min(loanAmt, expectedTotal - paid));
    };

    const filteredCustomers = customers.filter(cust => {
        const matchesSearch = cust.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            cust.phone.includes(searchTerm);

        if (showInactive) return matchesSearch;
        return matchesSearch && cust.status !== 'INACTIVE';
    });

    if (isLoading) {
        return <div className="p-8 flex justify-center text-slate-400"><Loader2 className="animate-spin" /> Loading Customers...</div>;
    }

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-pink-400 to-amber-400 text-transparent bg-clip-text">
                        Customer Management
                    </h1>
                    <p className="text-slate-600 dark:text-slate-400 mt-1">Manage borrower profiles and KYC</p>
                </div>
                <Button onClick={openAddModal} className="gap-2 bg-pink-600 hover:bg-pink-500 text-white border-none shadow-lg shadow-pink-900/20">
                    <UserPlus className="w-5 h-5" /> Add Customer
                </Button>
            </div>

            {/* Search and Filters */}
            <div className="mb-8 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="relative w-full max-w-md flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <Input
                        placeholder="Search customers..."
                        className="pl-10 text-slate-900 dark:text-white focus:border-pink-500 w-full"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 cursor-pointer select-none text-slate-600 dark:text-slate-400 text-sm font-medium">
                        <input
                            type="checkbox"
                            checked={showInactive}
                            onChange={(e) => setShowInactive(e.target.checked)}
                            className="rounded border-slate-300 text-pink-600 focus:ring-pink-500"
                        />
                        Show Inactive
                    </label>

                    <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1 border border-slate-200 dark:border-slate-700">
                        <button
                            onClick={() => setViewMode('GRID')}
                            className={`p-2 rounded-md transition-all ${viewMode === 'GRID' ? 'bg-white dark:bg-slate-700 shadow text-pink-600 dark:text-pink-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                            title="Grid View"
                        >
                            <LayoutGrid className="w-5 h-5" />
                        </button>
                        <button
                            onClick={() => setViewMode('LIST')}
                            className={`p-2 rounded-md transition-all ${viewMode === 'LIST' ? 'bg-white dark:bg-slate-700 shadow text-pink-600 dark:text-pink-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                            title="List View"
                        >
                            <List className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>

            {filteredCustomers.length > 0 ? (
                <>
                    {viewMode === 'GRID' ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredCustomers.map((cust) => (
                                <Card
                                    key={cust.id}
                                    className="relative hover:border-pink-500/50 transition-colors group cursor-pointer"
                                    onClick={() => setSelectedCustomerForReport(cust)}
                                >
                                    <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                                        <button
                                            onClick={(e) => openEditModal(cust, e)}
                                            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-slate-400 hover:text-slate-900 dark:hover:text-white"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={(e) => handleOpenDeleteModal(cust, e)}
                                            className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-full text-slate-400 hover:text-red-500"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>

                                    <div className="flex items-start gap-4 mb-4">
                                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-pink-500 to-amber-500 flex items-center justify-center text-xl font-bold text-white shadow-lg overflow-hidden">
                                            {cust.photo ? (
                                                <img src={decryptData(cust.photo)} alt={cust.name} className="w-full h-full object-cover" />
                                            ) : (
                                                cust.name.charAt(0)
                                            )}
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-lg text-slate-900 dark:text-slate-100">{cust.name}</h3>
                                            <p className="text-sm text-slate-500 dark:text-slate-400">ID: {cust.id.slice(0, 8)}</p>
                                        </div>
                                    </div>

                                    <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
                                        <div className="flex items-center gap-3">
                                            <Phone className="w-4 h-4 text-pink-500 dark:text-pink-400" />
                                            {cust.phone}
                                        </div>
                                        <div className="flex items-start gap-3">
                                            <MapPin className="w-4 h-4 text-pink-500 dark:text-pink-400 shrink-0 mt-0.5" />
                                            {cust.address || 'No address provided'}
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <Wallet className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                                            <span className="text-amber-600 dark:text-amber-400 font-semibold">₹{(cust.loanAmount || 0).toLocaleString()}</span>
                                            <span className="text-xs px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 ml-auto">
                                                Weekly
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-200 dark:border-slate-700/50">
                                            <span>Weekly Due (10%):</span>
                                            <span className="text-emerald-500 dark:text-emerald-400 font-medium">
                                                ₹{calculateInstallment(cust.loanAmount || 0).toLocaleString()}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                                            <span>Disbursed:</span>
                                            <span className="text-indigo-500 dark:text-indigo-400 font-medium">
                                                ₹{(cust.totalDisbursedAmount || cust.disbursedAmount || 0).toLocaleString()}
                                            </span>
                                        </div>
                                        {cust.documents && cust.documents.length > 0 && (
                                            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 text-xs text-emerald-500 dark:text-emerald-400 flex items-center gap-1">
                                                <FileText className="w-3 h-3" /> KYC Verified
                                            </div>
                                        )}
                                    </div>
                                </Card>
                            ))}
                        </div>
                    ) : (
                        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 text-xs text-slate-500 uppercase font-semibold">
                                        <tr>
                                            <th className="px-6 py-4">Customer</th>
                                            <th className="px-6 py-4">Contact</th>
                                            <th className="px-6 py-4 text-right">Loan / Disbursed</th>
                                            <th className="px-6 py-4 text-right">Due Till Now</th>
                                            <th className="px-6 py-4 text-right">Pending Actions</th>
                                            <th className="px-6 py-4 text-center">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                        {filteredCustomers.map((cust) => {
                                            const dueTillNow = getDueTillNow(cust);
                                            return (
                                                <tr key={cust.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer" onClick={() => setSelectedCustomerForReport(cust)}>
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold overflow-hidden ${cust.status === 'INACTIVE' ? 'bg-slate-200 text-slate-500' : 'bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400'}`}>
                                                                {cust.photo ? (
                                                                    <img src={decryptData(cust.photo)} alt={cust.name} className="w-full h-full object-cover grayscale-[var(--grayscale)]" style={{ '--grayscale': cust.status === 'INACTIVE' ? '100%' : '0%' } as any} />
                                                                ) : (
                                                                    cust.name.charAt(0)
                                                                )}
                                                            </div>
                                                            <div>
                                                                <div className={`font-medium ${cust.status === 'INACTIVE' ? 'text-slate-500' : 'text-slate-900 dark:text-white'}`}>
                                                                    {cust.name} {cust.status === 'INACTIVE' && <span className="text-[10px] bg-slate-200 px-1 rounded ml-1">INACTIVE</span>}
                                                                </div>
                                                                <div className="text-xs text-slate-500">ID: {cust.id.slice(0, 6)}</div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-slate-500">
                                                        <div>{cust.phone}</div>
                                                        <div className="text-xs truncate max-w-[120px]">{cust.address || ''}</div>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <div className="font-bold text-amber-600 dark:text-amber-400">Total: ₹{(cust.totalLoanAmount || cust.loanAmount || 0).toLocaleString()}</div>
                                                        <div className="text-xs text-indigo-500">Disb: ₹{(cust.totalDisbursedAmount || cust.disbursedAmount || 0).toLocaleString()}</div>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <div className="font-bold text-slate-700 dark:text-slate-300">₹{dueTillNow.toLocaleString()}</div>
                                                        <div className="text-xs text-slate-400">Arrears</div>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                                                            ₹{calculateInstallment(cust.totalLoanAmount || cust.loanAmount || 0).toLocaleString()}
                                                        </span>
                                                        <div className="text-xs text-slate-400">Weekly Due</div>
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        <div className="flex items-center justify-center gap-2">
                                                            <button
                                                                onClick={(e) => openEditModal(cust, e)}
                                                                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-slate-400 hover:text-pink-500"
                                                                title="Edit"
                                                            >
                                                                <Edit2 className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={(e) => handleOpenDeleteModal(cust, e)}
                                                                className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-full text-slate-400 hover:text-red-500"
                                                                title="Delete"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </>
            ) : (
                <EmptyState
                    title="No Customers Found"
                    description={searchTerm ? "Try adjusting your search terms" : "Get started by adding your first customer."}
                    actionLabel={searchTerm ? undefined : "Add Customer"}
                    onAction={searchTerm ? undefined : openAddModal}
                    icon={UserPlus}
                />
            )
            }

            {/* Modal */}
            {
                showAddModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 dark:bg-black/80 backdrop-blur-sm">
                        <Card className="w-full max-w-2xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 max-h-[90vh] overflow-y-auto shadow-xl">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                                    {editingCustomer ? 'Edit Customer' : 'Add New Customer'}
                                </h2>
                                <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"><Plus className="w-6 h-6 rotate-45 text-slate-500 dark:text-slate-400" /></button>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-6">
                                {/* Photo Upload - Centered */}
                                <div className="flex justify-center mb-2">
                                    <div className="relative group cursor-pointer w-24 h-24 rounded-full bg-slate-100 dark:bg-slate-800 border-2 border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center overflow-hidden">
                                        <input
                                            type="file"
                                            className="absolute inset-0 opacity-0 cursor-pointer z-20"
                                            onChange={(e) => e.target.files && setPhotoFile(e.target.files[0])}
                                            accept="image/*"
                                        />
                                        {photoFile ? (
                                            <img src={URL.createObjectURL(photoFile)} alt="Preview" className="w-full h-full object-cover" />
                                        ) : editingCustomer?.photo ? (
                                            <img src={decryptData(editingCustomer.photo)} alt="Current" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="text-center p-2">
                                                <Camera className="w-6 h-6 mx-auto text-slate-400 mb-1" />
                                                <span className="text-[10px] text-slate-500">Photo</span>
                                            </div>
                                        )}
                                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                            <UploadCloud className="w-6 h-6 text-white" />
                                        </div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <Input label="Full Name" value={name} onChange={(e) => setName(e.target.value)} required />
                                    <Input label="Phone Number" value={phone} onChange={(e) => setPhone(e.target.value)} required />
                                </div>

                                <Input label="Email (Optional)" value={email} onChange={(e) => setEmail(e.target.value)} type="email" />

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Address</label>
                                    <textarea
                                        className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white h-24 outline-none focus:ring-2 focus:ring-pink-500"
                                        value={address} onChange={(e) => setAddress(e.target.value)} required
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-4">
                                        <Input
                                            label="Principal Loan Amount (₹)"
                                            type="number"
                                            value={loanAmount}
                                            onChange={(e) => setLoanAmount(e.target.value)}
                                            required
                                        />
                                        {/* Auto-calc Insight */}
                                        {loanAmount && !isNaN(parseFloat(loanAmount)) && (
                                            <div className="p-3 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 rounded-lg flex items-center justify-between">
                                                <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide">Expected Weekly Due</span>
                                                <span className="text-lg font-bold text-emerald-700 dark:text-emerald-400">
                                                    ₹{(parseFloat(loanAmount) * 0.10).toLocaleString()}
                                                </span>
                                            </div>
                                        )}
                                        <Input label="Actual Disbursed Amount (₹)" type="number" value={disbursedAmount} onChange={(e) => setDisbursedAmount(e.target.value)} required />
                                        <p className="text-xs text-slate-500 -mt-3">Amount actually given to customer</p>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Repayment Type</label>
                                        <select
                                            className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-pink-500"
                                            value={repaymentType}
                                            onChange={(e) => setRepaymentType(e.target.value as 'WEEKLY')}
                                            disabled
                                        >
                                            <option value="WEEKLY">Weekly</option>
                                        </select>
                                        <p className="text-xs text-slate-500 mt-2">
                                            Fixed to Weekly repayment schedule (10% of principal / week).
                                        </p>
                                    </div>
                                </div>

                                {/* Secure Document Uploads */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">KYC Documents (Secure Storage)</label>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        {/* Aadhaar Upload */}
                                        <div className={`border-2 border-dashed ${aadhaarFile ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10' : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50'} rounded-lg p-4 text-center relative hover:border-pink-500 transition-colors`}>
                                            <input
                                                type="file"
                                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                                onChange={handleFileChange(setAadhaarFile)}
                                                accept="image/*"
                                            />
                                            <div className="flex flex-col items-center justify-center h-full min-h-[100px]">
                                                {aadhaarFile ? (
                                                    <>
                                                        <FileText className="w-6 h-6 text-emerald-600 mb-1" />
                                                        <p className="text-xs font-semibold text-emerald-700 truncate max-w-full px-2">{aadhaarFile.name}</p>
                                                    </>
                                                ) : (
                                                    <>
                                                        <UploadCloud className="w-6 h-6 text-slate-400 mb-1" />
                                                        <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Upload Aadhaar</p>
                                                        <p className="text-xs text-slate-400">Max 5MB</p>
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        {/* PAN Upload */}
                                        <div className={`border-2 border-dashed ${panFile ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10' : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50'} rounded-lg p-4 text-center relative hover:border-pink-500 transition-colors`}>
                                            <input
                                                type="file"
                                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                                onChange={handleFileChange(setPanFile)}
                                                accept="image/*"
                                            />
                                            <div className="flex flex-col items-center justify-center h-full min-h-[100px]">
                                                {panFile ? (
                                                    <>
                                                        <FileText className="w-6 h-6 text-emerald-600 mb-1" />
                                                        <p className="text-xs font-semibold text-emerald-700 truncate max-w-full px-2">{panFile.name}</p>
                                                    </>
                                                ) : (
                                                    <>
                                                        <UploadCloud className="w-6 h-6 text-slate-400 mb-1" />
                                                        <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Upload PAN</p>
                                                        <p className="text-xs text-slate-400">Max 5MB</p>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Dynamic Custom Fields */}
                                {settings.customFields.customer.length > 0 && (
                                    <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                                        <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-3">Additional Information</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {settings.customFields.customer.map(field => (
                                                <Input key={field.id} label={field.label} type={field.type} placeholder={`Enter ${field.label}`} />
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                                    <Button type="button" variant="ghost" onClick={() => setShowAddModal(false)}>Cancel</Button>
                                    <Button type="submit" className="bg-pink-600 hover:bg-pink-500 text-white" disabled={isUploading}>
                                        {isUploading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</> : (editingCustomer ? 'Update' : 'Create')}
                                    </Button>
                                </div>
                            </form>
                        </Card>
                    </div>
                )
            }

            {/* Customer Report Modal */}
            {
                selectedCustomerForReport && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 dark:bg-black/80 backdrop-blur-sm">
                        <Card className="w-full max-w-4xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
                            <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800">
                                <div className="flex items-center gap-4">
                                    <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden flex items-center justify-center border border-slate-200 dark:border-slate-700">
                                        {selectedCustomerForReport.photo ? (
                                            <img src={decryptData(selectedCustomerForReport.photo)} alt={selectedCustomerForReport.name} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="text-3xl font-bold text-slate-400">{selectedCustomerForReport.name.charAt(0)}</div>
                                        )}
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{selectedCustomerForReport.name}</h2>
                                        <div className="flex items-center gap-2 mt-1">
                                            <p className="text-slate-500 dark:text-slate-400 text-sm">Payment Ledger & History</p>
                                            <span className="text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                                                {selectedCustomerForReport.repaymentType || 'WEEKLY'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <button onClick={() => setSelectedCustomerForReport(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full">
                                    <Plus className="w-6 h-6 rotate-45 text-slate-500 dark:text-slate-400" />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6">
                                {loadingReport ? (
                                    <div className="p-4 text-center text-slate-400">Loading Transactions...</div>
                                ) : (
                                    <>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                                            <Card className="bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 p-4">
                                                <p className="text-xs text-slate-500 uppercase tracking-wider font-bold">Total Loan</p>
                                                <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                                                    ₹{((customerLoans.length > 0)
                                                        ? customerLoans.reduce((sum, l) => sum + (l.amount || 0), 0)
                                                        : (selectedCustomerForReport.totalLoanAmount || selectedCustomerForReport.loanAmount || 0)).toLocaleString()}
                                                </p>
                                            </Card>
                                            <Card className="bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 p-4">
                                                <p className="text-xs text-slate-500 uppercase tracking-wider font-bold">Paid to Date</p>
                                                <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                                                    ₹{((customerLoans.length > 0)
                                                        ? customerLoans.reduce((sum, l) => sum + (l.paidAmount || 0), 0)
                                                        : (selectedCustomerForReport.totalPaidAmount || 0)).toLocaleString()}
                                                </p>
                                            </Card>
                                            <Card className="bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 p-4">
                                                <p className="text-xs text-slate-500 uppercase tracking-wider font-bold">Outstanding</p>
                                                <p className="text-xl font-bold text-amber-600 dark:text-amber-400 mt-1">
                                                    ₹{((customerLoans.length > 0)
                                                        ? customerLoans.reduce((sum, l) => sum + (l.outstandingAmount || 0), 0)
                                                        : (selectedCustomerForReport.currentDueAmount || selectedCustomerForReport.loanAmount || 0)).toLocaleString()}
                                                </p>
                                            </Card>
                                        </div>

                                        {/* Active Loans Section */}
                                        <div className="mb-8 p-4 bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm relative z-0">
                                            <div className="flex justify-between items-center mb-4">
                                                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                                    <Wallet className="w-4 h-4" /> All Loans
                                                </h3>
                                                <Button size="sm" variant="ghost" onClick={() => {
                                                    setActiveCustomerId(selectedCustomerForReport.id);
                                                    // Reset form for new loan
                                                    setLoanAmount('');
                                                    setDisbursedAmount('');
                                                    setShowLoanModal(true);
                                                }} className="gap-2 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/20">
                                                    <Plus className="w-4 h-4" /> Add New Loan
                                                </Button>
                                            </div>
                                            {customerLoans.length === 0 ? (
                                                <div className="text-center py-6 text-slate-500 bg-slate-50 dark:bg-slate-800 rounded-lg">No active loans found.</div>
                                            ) : (
                                                <div className="space-y-3">
                                                    {customerLoans.map(loan => (
                                                        <div key={loan.id} className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800/50 flex justify-between items-center group hover:border-indigo-500/30 transition-all">
                                                            <div className="flex-1">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-600 dark:text-indigo-400">
                                                                        <Banknote className="w-4 h-4" />
                                                                    </div>
                                                                    <div>
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="font-bold text-slate-900 dark:text-white">₹{loan.amount.toLocaleString()}</span>
                                                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${loan.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>{loan.status}</span>
                                                                        </div>
                                                                        <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2">
                                                                            <span className="text-indigo-500 font-medium">Disbursed: ₹{(loan.disbursedAmount || 0).toLocaleString()}</span>
                                                                            <span>•</span>
                                                                            <span className="text-amber-600 font-medium">Bal: ₹{loan.outstandingAmount.toLocaleString()}</span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="text-right flex flex-col items-end gap-1">
                                                                <div className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-tight">
                                                                    {new Date(loan.startDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                                                                </div>
                                                                <div className="text-[10px] text-slate-400">
                                                                    {new Date(loan.startDate).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                                                                </div>
                                                                <div className="text-[10px] bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-slate-500 mt-1">
                                                                    {loan.repaymentType}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {/* KYC Documents Section */}
                                        <div className="mb-8 p-4 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-slate-200 dark:border-slate-700">
                                            <div className="flex justify-between items-center mb-4">
                                                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                                    <FileText className="w-4 h-4" /> KYC Documents
                                                </h3>
                                                <Button
                                                    size="sm"
                                                    variant="secondary"
                                                    onClick={(e) => {
                                                        // Close report modal first, then open edit
                                                        setSelectedCustomerForReport(null);
                                                        openEditModal(selectedCustomerForReport, e);
                                                    }}
                                                >
                                                    Edit / Upload
                                                </Button>
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                {/* Aadhaar Viewer */}
                                                <div className="space-y-2">
                                                    <p className="text-xs font-medium text-slate-500">Aadhaar Card</p>
                                                    {selectedCustomerForReport.aadhaarImage ? (
                                                        <div
                                                            className="relative aspect-video bg-slate-200 dark:bg-slate-700 rounded-lg overflow-hidden border border-slate-300 dark:border-slate-600 group cursor-pointer hover:ring-2 hover:ring-pink-500 transition-all"
                                                            onClick={() => setViewingImage({
                                                                url: decryptData(selectedCustomerForReport.aadhaarImage!),
                                                                title: `${selectedCustomerForReport.name} - Aadhaar`
                                                            })}
                                                        >
                                                            <img
                                                                src={decryptData(selectedCustomerForReport.aadhaarImage)}
                                                                alt="Aadhaar"
                                                                className="w-full h-full object-cover transition-transform group-hover:scale-105"
                                                            />
                                                            <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <span className="text-white text-xs font-bold bg-black/50 px-3 py-1.5 rounded-full backdrop-blur-sm border border-white/20 flex items-center gap-2">
                                                                    <ZoomIn className="w-3 h-3" /> View Full
                                                                </span>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="flex flex-col items-center justify-center aspect-video bg-slate-100 dark:bg-slate-800 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 text-slate-400">
                                                            <FileText className="w-8 h-8 mb-2 opacity-50" />
                                                            <span className="text-xs">No Aadhaar Uploaded</span>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* PAN Viewer */}
                                                <div className="space-y-2">
                                                    <p className="text-xs font-medium text-slate-500">PAN Card</p>
                                                    {selectedCustomerForReport.panImage ? (
                                                        <div
                                                            className="relative aspect-video bg-slate-200 dark:bg-slate-700 rounded-lg overflow-hidden border border-slate-300 dark:border-slate-600 group cursor-pointer hover:ring-2 hover:ring-pink-500 transition-all"
                                                            onClick={() => setViewingImage({
                                                                url: decryptData(selectedCustomerForReport.panImage!),
                                                                title: `${selectedCustomerForReport.name} - PAN`
                                                            })}
                                                        >
                                                            <img
                                                                src={decryptData(selectedCustomerForReport.panImage)}
                                                                alt="PAN"
                                                                className="w-full h-full object-cover transition-transform group-hover:scale-105"
                                                            />
                                                            <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <span className="text-white text-xs font-bold bg-black/50 px-3 py-1.5 rounded-full backdrop-blur-sm border border-white/20 flex items-center gap-2">
                                                                    <ZoomIn className="w-3 h-3" /> View Full
                                                                </span>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="flex flex-col items-center justify-center aspect-video bg-slate-100 dark:bg-slate-800 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 text-slate-400">
                                                            <FileText className="w-8 h-8 mb-2 opacity-50" />
                                                            <span className="text-xs">No PAN Uploaded</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Activity Timeline Section */}
                                        <div className="mb-8 p-4 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-slate-200 dark:border-slate-700">
                                            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-widest flex items-center gap-2 mb-6">
                                                <History className="w-4 h-4" /> Activity Timeline
                                            </h3>

                                            {customerActivities.length === 0 ? (
                                                <div className="text-center py-6 text-slate-500 italic text-sm">No activity records yet.</div>
                                            ) : (
                                                <div className="relative space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-700">
                                                    {customerActivities.map((activity, idx) => (
                                                        <div key={activity.id || idx} className="relative pl-8">
                                                            <div className={`absolute left-0 top-1.5 w-5 h-5 rounded-full border-4 border-white dark:border-slate-900 z-10 
                                                                ${activity.type === 'ASSIGNMENT' ? 'bg-blue-500' :
                                                                    activity.type === 'LOAN_CREATED' ? 'bg-emerald-500' :
                                                                        activity.type === 'PAYMENT' ? 'bg-indigo-500' : 'bg-slate-400'}`}>
                                                            </div>
                                                            <div>
                                                                <p className="text-sm font-bold text-slate-900 dark:text-white leading-none">{activity.type.replace(/_/g, ' ')}</p>
                                                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{activity.description}</p>
                                                                <p className="text-[10px] text-slate-400 mt-1 uppercase font-semibold">
                                                                    {new Date(activity.timestamp).toLocaleString()}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        <div className="space-y-4">
                                            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-widest">Transaction History</h3>
                                            {customerTransactions.length === 0 ? (
                                                <div className="text-center py-12 bg-slate-100 dark:bg-slate-800/30 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
                                                    <Clock className="w-8 h-8 text-slate-400 dark:text-slate-600 mx-auto mb-2" />
                                                    <p className="text-slate-500">No payment history found for this customer.</p>
                                                </div>
                                            ) : (
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-left">
                                                        <thead>
                                                            <tr className="text-xs text-slate-500 uppercase border-b border-slate-200 dark:border-slate-800">
                                                                <th className="pb-3 font-semibold">Date & Time</th>
                                                                <th className="pb-3 font-semibold">Description</th>
                                                                <th className="pb-3 font-semibold text-right">Amount</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                                                            {customerTransactions.map(tx => (
                                                                <tr key={tx.id} className="text-sm group hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                                                    <td className="py-4 whitespace-nowrap">
                                                                        <div className="flex flex-col">
                                                                            <span className="text-slate-900 dark:text-slate-200 font-medium">
                                                                                {new Date(tx.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                                                                            </span>
                                                                            <span className="text-xs text-slate-500">
                                                                                {new Date(tx.date).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                                                                            </span>
                                                                        </div>
                                                                    </td>
                                                                    <td className="py-4">
                                                                        <span className="text-slate-600 dark:text-slate-400">{tx.description}</span>
                                                                    </td>
                                                                    <td className="py-4 text-right">
                                                                        <div className="flex items-center justify-end gap-3">
                                                                            <span className="font-bold text-emerald-600 dark:text-emerald-400">₹{tx.amount.toLocaleString()}</span>
                                                                            <button
                                                                                onClick={async () => {
                                                                                    if (window.confirm('Are you sure you want to delete this transaction record?')) {
                                                                                        try {
                                                                                            await PaymentService.delete(tx.id);
                                                                                            // Optimistic update
                                                                                            setCustomerTransactions(prev => prev.filter(t => t.id !== tx.id));
                                                                                        } catch (error) {
                                                                                            console.error(error);
                                                                                            alert('Failed to delete transaction.');
                                                                                        }
                                                                                    }
                                                                                }}
                                                                                className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-slate-400 hover:text-red-500 transition-colors"
                                                                                title="Delete Transaction"
                                                                            >
                                                                                <Trash2 className="w-3 h-3" />
                                                                            </button>
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                        </Card>
                    </div>
                )
            }
            {/* Image Viewer */}
            <ImageViewerModal
                isOpen={!!viewingImage}
                onClose={() => setViewingImage(null)}
                imageUrl={viewingImage?.url || ''}
                title={viewingImage?.title || ''}
            />

            {/* Delete Modal */}
            <DeleteConfirmationModal
                isOpen={showDeleteModal}
                onClose={() => setShowDeleteModal(false)}
                onDelete={confirmDelete}
                onDeactivate={confirmDeactivate}
                title="Manage Customer"
                message={`What would you like to do with ${customerToDelete?.name}?`}
                entityName="customer"
            />

            {/* Add Loan Modal */}
            {
                showLoanModal && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 dark:bg-black/80 backdrop-blur-sm">
                        <Card className="w-full max-w-md bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 shadow-xl">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Add Subsequent Loan</h2>
                                <button onClick={() => setShowLoanModal(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"><Plus className="w-6 h-6 rotate-45 text-slate-500 dark:text-slate-400" /></button>
                            </div>
                            <form onSubmit={handleSaveLoan} className="space-y-6">
                                <div className="space-y-4">
                                    <Input
                                        label="Principal Loan Amount (₹)"
                                        type="number"
                                        value={loanAmount}
                                        onChange={(e) => setLoanAmount(e.target.value)}
                                        required
                                    />
                                    <Input
                                        label="Disbursed Amount (₹)"
                                        type="number"
                                        value={disbursedAmount}
                                        onChange={(e) => setDisbursedAmount(e.target.value)}
                                        required
                                    />

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Repayment Type</label>
                                        <select
                                            className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-pink-500"
                                            value={repaymentType}
                                            onChange={(e) => setRepaymentType(e.target.value as 'WEEKLY')}
                                            disabled
                                        >
                                            <option value="WEEKLY">Weekly</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                                    <Button type="button" variant="ghost" onClick={() => setShowLoanModal(false)}>Cancel</Button>
                                    <Button type="submit" className="bg-indigo-600 hover:bg-indigo-500 text-white">
                                        Create Loan
                                    </Button>
                                </div>
                            </form>
                        </Card>
                    </div>
                )
            }
        </div >
    );
};
