import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Plus, Search, UserPlus, Phone, MapPin, Edit2, ChevronRight, UserCheck, Users, Wallet, History, Clock, Trash2, LayoutGrid, List } from 'lucide-react';
import { toast } from 'sonner';
import { useSettings } from '../../context/SettingsContext';
import type { User, Customer, Collection, Transaction, Loan } from '../../types';
import { UserService } from '../../services/userService';
import { CustomerService } from '../../services/customerService';
import { CollectionService } from '../../services/collectionService';
import { PaymentService } from '../../services/paymentService';
import { isOverdue } from '../../lib/utils';
import { LoanService } from '../../services/loanService';
import { Loader2, UploadCloud, Camera, Landmark } from 'lucide-react';
import { compressAndConvertToBase64, encryptData, decryptData } from '../../lib/encryption';
import { DeleteConfirmationModal } from '../../components/ui/DeleteConfirmationModal';
import { ActivityService } from '../../services/activityService';

export const Agents = () => {
    const { settings } = useSettings();
    const [agents, setAgents] = useState<User[]>([]);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [loans, setLoans] = useState<Loan[]>([]);
    const [collections, setCollections] = useState<Collection[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [showInactive, setShowInactive] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [viewMode, setViewMode] = useState<'GRID' | 'LIST'>('GRID');

    // Delete Modal State
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [agentToDelete, setAgentToDelete] = useState<User | null>(null);

    // View/Manage Agent State
    const [selectedAgent, setSelectedAgent] = useState<User | null>(null);
    const [showAssignModal, setShowAssignModal] = useState(false);

    // Reporting
    const [selectedCustomerForReport, setSelectedCustomerForReport] = useState<Customer | null>(null);
    const [reportTransactions, setReportTransactions] = useState<Transaction[]>([]);
    const [reportLoans, setReportLoans] = useState<Loan[]>([]); // New State
    const [loadingReport, setLoadingReport] = useState(false);

    const [showReassignModal, setShowReassignModal] = useState(false);
    const [customerToReassign, setCustomerToReassign] = useState<Customer | null>(null);
    const [reassignTargetAgentId, setReassignTargetAgentId] = useState<string>('');
    const [showDeactivateModal, setShowDeactivateModal] = useState(false);
    const [deactivateReassignTargetId, setDeactivateReassignTargetId] = useState<string>('');

    // Form State
    const [editingAgent, setEditingAgent] = useState<User | null>(null);
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [address, setAddress] = useState('');
    const [commissionPercentage, setCommissionPercentage] = useState('');
    const [photoFile, setPhotoFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [fetchedAgents, fetchedCustomers, fetchedCollections, fetchedLoans] = await Promise.all([
                UserService.getAgents(),
                CustomerService.getAll(),
                CollectionService.getAll(),
                LoanService.getAll()
            ]);
            setAgents(fetchedAgents);
            setCustomers(fetchedCustomers);
            setCollections(fetchedCollections);
            setLoans(fetchedLoans);
        } catch (error) {
            console.error("Error fetching agent data:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    useEffect(() => {
        const fetchReportData = async () => {
            if (selectedCustomerForReport) {
                setLoadingReport(true);
                try {
                    const [txs, custLoans] = await Promise.all([
                        PaymentService.getByCustomerId(selectedCustomerForReport.id).catch(() => []),
                        LoanService.getByCustomerId(selectedCustomerForReport.id).catch(() => [])
                    ]);
                    setReportTransactions(txs);
                    setReportLoans(custLoans);
                } catch (e) {
                    console.error("Agent Report Fetch Error", e);
                } finally {
                    setLoadingReport(false);
                }
            } else {
                setReportTransactions([]);
                setReportLoans([]);
            }
        };
        fetchReportData();
    }, [selectedCustomerForReport]);

    const getAgentStats = (agentId: string) => {
        const agentCusts = customers.filter(c => c.agentId === agentId);
        let totalDue = 0;

        agentCusts.forEach(cust => {
            const coll = collections.find(cl => cl.customerId === cust.id);
            if (coll) {
                totalDue += coll.outstanding;
            } else {
                // If no collection record, assume full loan amount
                totalDue += (cust.loanAmount || 0);
            }
        });

        return {
            count: agentCusts.length,
            totalDue
        };
    };

    const handleAssignLoan = async (loanId: string) => {
        if (!selectedAgent) return;
        try {
            const loan = loans.find(l => l.id === loanId);
            const customer = customers.find(c => c.id === loan?.customerId);

            await LoanService.update(loanId, { agentId: selectedAgent.uid });

            // If customer has no agent yet, set this as default
            if (!customer?.agentId || customer.agentId === 'unassigned') {
                await CustomerService.update(customer!.id, { agentId: selectedAgent.uid });
            }

            await ActivityService.log({
                type: 'ASSIGNMENT',
                customerId: loan?.customerId || '',
                customerName: customer?.name || 'Unknown',
                agentId: selectedAgent.uid,
                agentName: selectedAgent.displayName || 'Unknown',
                description: `Loan ${loanId.slice(0, 8)} of ${customer?.name} assigned to Agent ${selectedAgent.displayName}`,
                timestamp: Date.now()
            });

            await fetchData(); // Refresh
            setShowAssignModal(false);
        } catch (error) {
            console.error("Assign failed", error);
        }
    };

    const handleReassignCustomer = async () => {
        if (!customerToReassign || !reassignTargetAgentId) return;
        try {
            const oldAgentName = agents.find(a => a.uid === customerToReassign.agentId)?.displayName || 'Previous Agent';
            const newAgent = agents.find(a => a.uid === reassignTargetAgentId);

            await CustomerService.update(customerToReassign.id, { agentId: reassignTargetAgentId });

            await ActivityService.log({
                type: 'ASSIGNMENT',
                customerId: customerToReassign.id,
                customerName: customerToReassign.name,
                agentId: reassignTargetAgentId,
                agentName: newAgent?.displayName || 'Unknown',
                description: `Customer reassigned from ${oldAgentName} to ${newAgent?.displayName || 'Unknown'}`,
                timestamp: Date.now()
            });

            await fetchData();
            setShowReassignModal(false);
            setCustomerToReassign(null);
            setReassignTargetAgentId('');
        } catch (e) {
            console.error("Reassign failed", e);
        }
    };

    const handleDeactivateAgent = async () => {
        if (!selectedAgent) return;

        try {
            if (deactivateReassignTargetId) {
                const agentCusts = customers.filter(c => c.agentId === selectedAgent.uid);
                await Promise.all(agentCusts.map(c =>
                    CustomerService.update(c.id, { agentId: deactivateReassignTargetId })
                ));
            }
            await UserService.updateStatus(selectedAgent.uid, 'INACTIVE');
            await fetchData();
            setSelectedAgent(null);
            setShowDeactivateModal(false);
            setDeactivateReassignTargetId('');
        } catch (e) {
            console.error("Deactivate failed", e);
        }
    };

    const getOtherActiveAgents = (excludeId: string) => {
        return agents.filter(a => a.uid !== excludeId && a.status !== 'INACTIVE');
    };

    const openAddModal = () => {
        setEditingAgent(null);
        setName(''); setEmail(''); setPhone(''); setAddress(''); setCommissionPercentage('');
        setPhotoFile(null);
        setShowAddModal(true);
    };

    const openEditModal = (agent: User, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingAgent(agent);
        setName(agent.displayName || '');
        setEmail(agent.email || '');
        setPhone(agent.phone || '');
        setAddress(agent.address || '');
        setCommissionPercentage(agent.commissionPercentage?.toString() || '');
        setPhotoFile(null); // Reset file input
        setShowAddModal(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isUploading) return;
        setIsUploading(true);
        try {
            let photoData = editingAgent?.photo;

            if (photoFile) {
                const base64 = await compressAndConvertToBase64(photoFile);
                photoData = encryptData(base64);
            }

            if (editingAgent) {
                await UserService.saveAgent({
                    ...editingAgent,
                    displayName: name,
                    email,
                    phone,
                    address,
                    commissionPercentage: parseFloat(commissionPercentage) || 0,
                    photo: photoData
                });
            } else {
                await UserService.saveAgent({
                    uid: 'agent-' + Date.now(), // In real auth, create auth user separately or here
                    email,
                    role: 'AGENT',
                    displayName: name,
                    phone,
                    address,
                    createdAt: Date.now(),
                    status: 'ACTIVE',
                    initialPassword: email,
                    commissionPercentage: parseFloat(commissionPercentage) || 0,
                    photo: photoData
                });
            }
            await fetchData();
            setShowAddModal(false);
            toast.success("Agent saved successfully!");
        } catch (e: any) {
            console.error("Save agent failed", e);
            toast.error("Failed to save agent: " + (e.message || "Unknown error"));
        } finally {
            setIsUploading(false);
        }
    };

    const filteredAgents = agents.filter(agent => {
        const matchesSearch = (agent.displayName?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
            agent.email.toLowerCase().includes(searchTerm.toLowerCase());

        if (showInactive) return matchesSearch;
        return matchesSearch && agent.status !== 'INACTIVE';
    });

    const handleOpenDeleteModal = (agent: User) => {
        setAgentToDelete(agent);
        setShowDeleteModal(true);
    };

    const confirmDelete = async () => {
        if (!agentToDelete) return;

        // Safety check for assigned customers
        const assignedCount = customers.filter(c => c.agentId === agentToDelete.uid).length;
        if (assignedCount > 0) {
            toast.error(`Cannot delete agent. ${assignedCount} customers still assigned.`);
            return;
        }

        try {
            await UserService.delete(agentToDelete.uid);
            toast.success("Agent deleted permanently");
            setSelectedAgent(null);
            await fetchData();
            setShowDeleteModal(false);
            setAgentToDelete(null);
        } catch (e: any) {
            toast.error("Failed to delete agent: " + (e.message || "Unknown error"));
        }
    };

    const confirmDeactivate = async () => {
        if (!agentToDelete) return;
        try {
            await UserService.updateStatus(agentToDelete.uid, 'INACTIVE');
            toast.success("Agent deactivated");
            await fetchData();
            // If we are in detail view and deactivated, maybe just refresh data but keep view or close?
            // If in detail view, we likely want to see the updated status.
            if (selectedAgent?.uid === agentToDelete.uid) {
                // Refresh selected agent from the new data
                const updated = agents.find(a => a.uid === agentToDelete.uid);
                if (updated) setSelectedAgent({ ...updated, status: 'INACTIVE' }); // Optimistic-ish / quick fix
            }
            setShowDeleteModal(false);
            setAgentToDelete(null);
        } catch (e: any) {
            toast.error("Failed to deactivate agent");
        }
    };

    const getWeeklyDefaulters = (agentId: string) => {
        return customers.filter(c => {
            if (c.agentId !== agentId) return false;
            // Repayment type is always weekly now
            if (!c.lastPaidDate) return true; // Never paid, treated as overdue if loan exists
            return isOverdue(c.lastPaidDate);
        });
    };

    const unassignedLoans = loans.filter(l => (!l.agentId || l.agentId === 'unassigned') && (l.status === 'ACTIVE' || l.status === 'DEFAULTED'));

    if (isLoading) {
        return <div className="p-8 flex justify-center text-slate-400"><Loader2 className="animate-spin" /> Loading Agents...</div>;
    }

    return (
        <div className="p-8 max-w-7xl mx-auto text-slate-900 dark:text-white">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 text-transparent bg-clip-text">
                        Agent Management
                    </h1>
                    <p className="text-slate-600 dark:text-slate-400 mt-1">Manage field agents and customer assignments</p>
                </div>
                {selectedAgent === null && (
                    <Button onClick={openAddModal} className="gap-2 bg-blue-600 hover:bg-blue-500 text-white border-none shadow-lg shadow-blue-900/20">
                        <UserPlus className="w-5 h-5" /> Add Agent
                    </Button>
                )}
            </div>

            {selectedAgent === null ? (
                <>
                    <div className="mb-8 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="relative w-full max-w-md flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                            <Input
                                placeholder="Search agents..."
                                className="pl-10 bg-white dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:border-blue-500 w-full"
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
                                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                />
                                Show Inactive
                            </label>

                            <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1 border border-slate-200 dark:border-slate-700">
                                <button
                                    onClick={() => setViewMode('GRID')}
                                    className={`p-2 rounded-md transition-all ${viewMode === 'GRID' ? 'bg-white dark:bg-slate-700 shadow text-blue-600 dark:text-blue-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                                    title="Grid View"
                                >
                                    <LayoutGrid className="w-5 h-5" />
                                </button>
                                <button
                                    onClick={() => setViewMode('LIST')}
                                    className={`p-2 rounded-md transition-all ${viewMode === 'LIST' ? 'bg-white dark:bg-slate-700 shadow text-blue-600 dark:text-blue-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                                    title="List View"
                                >
                                    <List className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    </div>

                    {viewMode === 'GRID' ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredAgents.map((agent) => {
                                const stats = getAgentStats(agent.uid);
                                return (
                                    <Card
                                        key={agent.uid}
                                        className="relative hover:border-blue-500/50 transition-colors group cursor-pointer"
                                        onClick={() => setSelectedAgent(agent)}
                                    >
                                        <div className="absolute top-4 right-4 z-10">
                                            <button
                                                onClick={(e) => openEditModal(agent, e)}
                                                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-slate-400 hover:text-slate-900 dark:hover:text-white"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                        </div>

                                        <div className="flex items-start gap-4 mb-6">
                                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-xl font-bold text-white shadow-lg overflow-hidden">
                                                {agent.photo ? (
                                                    <img src={decryptData(agent.photo)} alt={agent.displayName} className="w-full h-full object-cover" />
                                                ) : (
                                                    agent.displayName?.charAt(0) || 'A'
                                                )}
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-lg text-slate-900 dark:text-slate-100">{agent.displayName}</h3>
                                                <p className="text-sm text-slate-500 dark:text-slate-400">{agent.email}</p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4 mb-4 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                                            <div>
                                                <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Customers</p>
                                                <p className="font-bold text-lg text-slate-900 dark:text-white">{stats.count}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Total Due</p>
                                                <p className="font-bold text-lg text-amber-600 dark:text-amber-400">₹{stats.totalDue.toLocaleString()}</p>
                                            </div>
                                        </div>

                                        <div className="flex items-center text-blue-600 dark:text-blue-400 text-sm font-medium mt-2">
                                            View Dashboard <ChevronRight className="w-4 h-4 ml-1 transition-transform group-hover:translate-x-1" />
                                        </div>
                                    </Card>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {filteredAgents.map((agent) => {
                                const stats = getAgentStats(agent.uid);
                                return (
                                    <div
                                        key={agent.uid}
                                        className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl hover:border-blue-500/50 transition-all cursor-pointer group"
                                        onClick={() => setSelectedAgent(agent)}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-lg font-bold text-white shadow-md overflow-hidden">
                                                {agent.photo ? (
                                                    <img src={decryptData(agent.photo)} alt={agent.displayName} className="w-full h-full object-cover" />
                                                ) : (
                                                    agent.displayName?.charAt(0) || 'A'
                                                )}
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-slate-900 dark:text-white">{agent.displayName}</h3>
                                                <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
                                                    <span>{agent.phone}</span>
                                                    <span>•</span>
                                                    <span>{agent.email}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-8">
                                            <div className="text-right hidden sm:block">
                                                <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Customers</p>
                                                <p className="font-bold text-slate-900 dark:text-white">{stats.count}</p>
                                            </div>
                                            <div className="text-right hidden sm:block">
                                                <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Total Due</p>
                                                <p className="font-bold text-amber-600 dark:text-amber-400">₹{stats.totalDue.toLocaleString()}</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={(e) => openEditModal(agent, e)}
                                                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-slate-400 hover:text-slate-900 dark:hover:text-white"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-blue-500 transition-colors" />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </>
            ) : (
                <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                    <Button
                        variant="ghost"
                        className="mb-6 pl-0 gap-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                        onClick={() => setSelectedAgent(null)}
                    >
                        ← Back to all agents
                    </Button>

                    <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 mb-8 p-6 shadow-sm">
                        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                            <div className="flex items-center gap-6">
                                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-3xl font-bold text-white shadow-xl">
                                    {selectedAgent.displayName?.charAt(0) || 'A'}
                                </div>
                                <div>
                                    <h2 className="text-3xl font-bold text-slate-900 dark:text-white">{selectedAgent.displayName}</h2>
                                    <div className="flex flex-wrap gap-4 mt-2 text-slate-500 dark:text-slate-400">
                                        <div className="flex items-center gap-2"><Phone className="w-4 h-4" /> {selectedAgent.phone}</div>
                                        <div className="flex items-center gap-2"><MapPin className="w-4 h-4" /> {selectedAgent.address}</div>
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-4">
                                {selectedAgent.status !== 'INACTIVE' ? (
                                    <>
                                        <Button
                                            variant="ghost"
                                            className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                                            onClick={() => handleOpenDeleteModal(selectedAgent)}
                                        >
                                            <Trash2 className="w-4 h-4 mr-2" /> Delete
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            className="text-amber-400 hover:text-amber-300 hover:bg-amber-900/20"
                                            onClick={() => handleOpenDeleteModal(selectedAgent)}
                                        >
                                            Deactivate
                                        </Button>
                                        <Button className="gap-2 bg-indigo-600 hover:bg-indigo-500" onClick={() => setShowAssignModal(true)}>
                                            <UserCheck className="w-4 h-4" /> Assign Customer
                                        </Button>
                                    </>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <div className="px-4 py-2 bg-red-900/30 border border-red-800 rounded-lg text-red-400 font-semibold">
                                            INACTIVE
                                        </div>
                                        <Button
                                            variant="ghost"
                                            className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                                            onClick={() => handleOpenDeleteModal(selectedAgent)}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Breakdown Summary */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-8 pt-8 border-t border-slate-200 dark:border-slate-800">
                            <div>
                                <p className="text-xs text-slate-500 uppercase tracking-widest font-bold">Total Assigned</p>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{customers.filter(c => c.agentId === selectedAgent.uid).length}</p>
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 uppercase tracking-widest font-bold">Total Pending</p>
                                <p className="text-2xl font-bold text-amber-600 dark:text-amber-500 mt-1">₹{getAgentStats(selectedAgent.uid).totalDue.toLocaleString()}</p>
                            </div>
                            {/* Simplified logic for monthly/weekly due based on type */}
                            <div>
                                <p className="text-xs text-slate-500 uppercase tracking-widest font-bold">Total Arrears</p>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                                    ₹{customers.filter(c => c.agentId === selectedAgent.uid)
                                        .reduce((acc, c) => acc + (collections.find(cl => cl.customerId === c.id)?.outstanding || (c.loanAmount || 0)), 0).toLocaleString()}
                                </p>
                            </div>
                        </div>
                    </Card>

                    {/* Weekly Defaulters Analysis */}
                    {
                        getWeeklyDefaulters(selectedAgent.uid).length > 0 && (
                            <Card className="bg-red-900/10 border-red-900/30 mb-8 p-6">
                                <h3 className="text-xl font-bold text-red-400 mb-4 flex items-center gap-2">
                                    <Wallet className="w-5 h-5" />
                                    Weekly Pending List
                                    <span className="text-xs bg-red-900/50 text-red-200 px-2 py-1 rounded-full border border-red-800">
                                        {getWeeklyDefaulters(selectedAgent.uid).length} Needs Attention
                                    </span>
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {getWeeklyDefaulters(selectedAgent.uid).map(cust => (
                                        <div key={cust.id} className="bg-slate-900/80 p-4 rounded-lg border border-red-900/30 flex justify-between items-center">
                                            <div>
                                                <p className="font-bold text-slate-200">{cust.name}</p>
                                                <p className="text-xs text-red-400 mt-1">Due: ₹{(cust.loanAmount || 0) * (settings.interestRates.weekly / 100) + (cust.loanAmount || 0) / 20}</p>
                                            </div>
                                            <Button
                                                size="sm"
                                                className="bg-red-600 hover:bg-red-500 text-xs"
                                                onClick={() => setSelectedCustomerForReport(cust)}
                                            >
                                                View Report
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </Card>
                        )
                    }


                    <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-6 flex items-center gap-2">
                        <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        Assigned Customers
                    </h3>

                    <div className="grid gap-4">
                        {customers.filter(c => c.agentId === selectedAgent.uid).length === 0 ? (
                            <Card className="bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 p-12 text-center">
                                <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Users className="w-8 h-8 text-slate-400 dark:text-slate-600" />
                                </div>
                                <h4 className="text-lg font-medium text-slate-800 dark:text-slate-300">No customers assigned</h4>
                                <p className="text-slate-500 mt-1 max-w-xs mx-auto">Click "Assign Customer" to add borrowers to this agent's portfolio.</p>
                            </Card>
                        ) : (
                            customers.filter(c => c.agentId === selectedAgent.uid).map(cust => {
                                const coll = collections.find(cl => cl.customerId === cust.id);
                                const currentDue = coll ? coll.outstanding : (cust.loanAmount || 0);
                                return (
                                    <Card
                                        key={cust.id}
                                        className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-blue-500/50 transition-all cursor-pointer group relative"
                                        onClick={() => setSelectedCustomerForReport(cust)}
                                    >
                                        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                                            <div>
                                                <h4 className="font-bold text-lg text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{cust.name}</h4>
                                                <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                                    <MapPin className="w-3 h-3" /> {cust.address}
                                                </p>
                                            </div>
                                            <div className="flex flex-wrap gap-8 items-center">
                                                <div className="text-center md:text-left">
                                                    <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Frequency</p>
                                                    <p className="font-medium text-slate-700 dark:text-slate-200">Weekly</p>
                                                </div>
                                                <div className="text-center md:text-left">
                                                    <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Principal</p>
                                                    <p className="font-medium text-slate-700 dark:text-slate-200">₹{(cust.loanAmount || 0).toLocaleString()}</p>
                                                </div>
                                                <div className="text-center md:text-left">
                                                    <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Outstanding Due</p>
                                                    <p className="font-bold text-amber-600 dark:text-amber-400 text-lg">₹{currentDue.toLocaleString()}</p>
                                                    <p className="text-[10px] text-slate-500 mt-1">
                                                        Total Repayable: ₹{((cust.loanAmount || 0) * (1 + (cust.tenure || 20) * settings.interestRates.weekly / 100)).toLocaleString()}
                                                    </p>
                                                </div>
                                                {selectedAgent.status !== 'INACTIVE' && (
                                                    <div
                                                        className="md:border-l md:border-slate-200 dark:md:border-slate-700 md:pl-8 flex items-center"
                                                        onClick={(e) => e.stopPropagation()} // Prevent card click
                                                    >
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                                                            onClick={() => {
                                                                setCustomerToReassign(cust);
                                                                setShowReassignModal(true);
                                                            }}
                                                        >
                                                            Reassign
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </Card>
                                );
                            })
                        )}
                    </div>
                </div >
            )}

            {/* Modals remain same concept but updated UI */}
            {
                showAddModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 dark:bg-black/80 backdrop-blur-sm">
                        <Card className="w-full max-w-lg bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 shadow-xl">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                                    {editingAgent ? 'Edit Agent' : 'Add New Agent'}
                                </h2>
                                <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                                    <Plus className="w-6 h-6 rotate-45 text-slate-500 dark:text-slate-400" />
                                </button>
                            </div>
                            <form onSubmit={handleSubmit} className="space-y-6 max-h-[70vh] overflow-y-auto px-1">
                                <div className="flex justify-center mb-6">
                                    <div className="relative group cursor-pointer w-24 h-24 rounded-full bg-slate-100 dark:bg-slate-800 border-2 border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center overflow-hidden">
                                        <input
                                            type="file"
                                            className="absolute inset-0 opacity-0 cursor-pointer z-20"
                                            onChange={(e) => e.target.files && setPhotoFile(e.target.files[0])}
                                            accept="image/*"
                                        />
                                        {photoFile ? (
                                            <img src={URL.createObjectURL(photoFile)} alt="Preview" className="w-full h-full object-cover" />
                                        ) : editingAgent?.photo ? (
                                            <img src={decryptData(editingAgent.photo)} alt="Current" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="text-center p-2">
                                                <Camera className="w-6 h-6 mx-auto text-slate-400 mb-1" />
                                                <span className="text-[10px] text-slate-500">Add Photo</span>
                                            </div>
                                        )}
                                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                            <UploadCloud className="w-6 h-6 text-white" />
                                        </div>
                                    </div>
                                </div>
                                <Input label="Full Name" value={name} onChange={e => setName(e.target.value)} required />
                                <Input label="Email Address" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
                                <Input label="Phone Number" value={phone} onChange={e => setPhone(e.target.value)} required />
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Office/Home Address</label>
                                    <textarea
                                        className="w-full px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white h-24 outline-none focus:ring-2 focus:ring-blue-500"
                                        value={address} onChange={e => setAddress(e.target.value)} required
                                    />
                                </div>
                                <Input
                                    label="Commission Percentage (%)"
                                    type="number"
                                    step="0.01"
                                    value={commissionPercentage}
                                    onChange={e => setCommissionPercentage(e.target.value)}
                                    required
                                />
                                <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                                    <Button type="button" variant="ghost" onClick={() => setShowAddModal(false)}>Cancel</Button>
                                    <Button type="submit" className="bg-blue-600 hover:bg-blue-500" disabled={isUploading}>
                                        {isUploading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</> : (editingAgent ? 'Update Agent' : 'Create Agent')}
                                    </Button>
                                </div>
                            </form>
                        </Card >
                    </div >
                )
            }

            {
                showAssignModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 dark:bg-black/80 backdrop-blur-sm">
                        <Card className="w-full max-w-lg bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 max-h-[80vh] overflow-hidden flex flex-col shadow-xl">
                            <div className="flex items-center justify-between mb-6 p-1">
                                <div>
                                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Assign Loan</h2>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">Selecting an unassigned loan for {selectedAgent?.displayName}</p>
                                </div>
                                <button onClick={() => setShowAssignModal(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                                    <Plus className="w-6 h-6 rotate-45 text-slate-500 dark:text-slate-400" />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto pr-2 space-y-3">
                                {unassignedLoans.length === 0 ? (
                                    <div className="text-center py-12 flex flex-col items-center">
                                        <Landmark className="w-12 h-12 text-slate-700 mx-auto mb-4" />
                                        <p className="text-slate-500 mb-4">No unassigned active loans available</p>
                                        <Button
                                            className="bg-blue-600 hover:bg-blue-500"
                                            onClick={() => window.location.href = '/admin/customers'}
                                        >
                                            Go to Customers
                                        </Button>
                                    </div>
                                ) : (
                                    unassignedLoans.map(loan => {
                                        const cust = customers.find(c => c.id === loan.customerId);
                                        return (
                                            <div key={loan.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-blue-500/50 transition-all">
                                                <div>
                                                    <p className="font-bold text-slate-900 dark:text-white">{cust?.name || 'Unknown'}</p>
                                                    <div className="flex flex-col gap-0.5 mt-1">
                                                        <p className="text-[10px] text-slate-400 font-mono">Loan: {loan.id.slice(0, 8)}</p>
                                                        <p className="text-xs text-slate-500 flex items-center gap-1">
                                                            <Wallet className="w-3 h-3" /> Principal: ₹{(loan.amount || 0).toLocaleString()}
                                                        </p>
                                                    </div>
                                                </div>
                                                <Button size="sm" className="bg-indigo-600 hover:bg-indigo-500" onClick={() => handleAssignLoan(loan.id)}>
                                                    Assign
                                                </Button>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </Card>
                    </div>
                )
            }

            {/* Reassign Modal */}
            {
                showReassignModal && customerToReassign && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 dark:bg-black/80 backdrop-blur-sm">
                        <Card className="w-full max-w-md bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 shadow-xl">
                            <div className="p-6">
                                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Reassign Customer</h3>
                                <p className="text-slate-500 dark:text-slate-400 mb-6">
                                    Choose a new agent for <span className="text-slate-900 dark:text-white font-medium">{customerToReassign.name}</span>
                                </p>

                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-400 mb-2">Select New Agent</label>
                                        <select
                                            className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none"
                                            value={reassignTargetAgentId}
                                            onChange={(e) => setReassignTargetAgentId(e.target.value)}
                                        >
                                            <option value="">Select an agent...</option>
                                            {getOtherActiveAgents(selectedAgent?.uid || '').map(agent => (
                                                <option key={agent.uid} value={agent.uid}>{agent.displayName}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="flex justify-end gap-3 mt-6">
                                        <Button variant="ghost" onClick={() => {
                                            setShowReassignModal(false);
                                            setCustomerToReassign(null);
                                        }}>Cancel</Button>
                                        <Button
                                            className="bg-blue-600 hover:bg-blue-500"
                                            disabled={!reassignTargetAgentId}
                                            onClick={handleReassignCustomer}
                                        >
                                            Confirm Reassignment
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </Card>
                    </div>
                )
            }

            {/* Deactivate Agent Modal */}
            {
                showDeactivateModal && selectedAgent && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 dark:bg-black/80 backdrop-blur-sm">
                        <Card className="w-full max-w-md bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 shadow-xl">
                            <div className="p-6">
                                <h3 className="text-xl font-bold text-red-600 dark:text-red-400 mb-2">Deactivate Agent?</h3>
                                <p className="text-slate-500 dark:text-slate-400 mb-6">
                                    You are about to deactivate <span className="text-slate-900 dark:text-white font-medium">{selectedAgent.displayName}</span>.
                                    Since this agent has assigned customers, you must reassign them to another active agent.
                                </p>

                                <div className="space-y-4">
                                    <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                                        <p className="text-amber-400 text-sm font-medium mb-1">Action Required</p>
                                        <p className="text-amber-200/70 text-sm">
                                            Reassign {customers.filter(c => c.agentId === selectedAgent.uid).length} customers to:
                                        </p>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-400 mb-2">Select Target Agent</label>
                                        <select
                                            className="w-full bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none"
                                            value={deactivateReassignTargetId}
                                            onChange={(e) => setDeactivateReassignTargetId(e.target.value)}
                                        >
                                            <option value="">Select an agent...</option>
                                            {getOtherActiveAgents(selectedAgent.uid).map(agent => (
                                                <option key={agent.uid} value={agent.uid}>{agent.displayName}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="flex justify-end gap-3 mt-6">
                                        <Button variant="ghost" onClick={() => setShowDeactivateModal(false)}>Cancel</Button>
                                        <Button
                                            className="bg-red-600 hover:bg-red-500"
                                            disabled={!deactivateReassignTargetId && customers.filter(c => c.agentId === selectedAgent.uid).length > 0}
                                            onClick={handleDeactivateAgent}
                                        >
                                            Deactivate & Reassign
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </Card>
                    </div>
                )
            }
            {/* Customer Report Modal */}
            {
                selectedCustomerForReport && (
                    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 dark:bg-black/80 backdrop-blur-sm">
                        <Card className="w-full max-w-4xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
                            <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-blue-500/10 rounded-xl text-blue-600 dark:text-blue-400">
                                        <History className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{selectedCustomerForReport.name}</h2>
                                        <div className="flex items-center gap-2 mt-1">
                                            <p className="text-slate-500 dark:text-slate-400 text-sm">Customer Payment Ledger</p>
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
                                    <div className="text-center py-20 text-slate-400">Loading Report Data...</div>
                                ) : (
                                    <>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                                            <Card className="bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 p-4">
                                                <p className="text-xs text-slate-500 uppercase tracking-wider font-bold">Principal</p>
                                                <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                                                    ₹{((reportLoans.length > 0)
                                                        ? reportLoans.reduce((sum, l) => sum + (l.amount || 0), 0)
                                                        : (selectedCustomerForReport.totalLoanAmount || selectedCustomerForReport.loanAmount || 0)).toLocaleString()}
                                                </p>
                                            </Card>
                                            <Card className="bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 p-4">
                                                <p className="text-xs text-slate-500 uppercase tracking-wider font-bold">Total Paid</p>
                                                <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                                                    ₹{((reportLoans.length > 0)
                                                        ? reportLoans.reduce((sum, l) => sum + (l.paidAmount || 0), 0)
                                                        : (selectedCustomerForReport.totalPaidAmount || 0)).toLocaleString()}
                                                </p>
                                            </Card>
                                            <Card className="bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 p-4">
                                                <p className="text-xs text-slate-500 uppercase tracking-wider font-bold">Balance Due</p>
                                                <p className="text-xl font-bold text-amber-600 dark:text-amber-400 mt-1">
                                                    ₹{((reportLoans.length > 0)
                                                        ? reportLoans.reduce((sum, l) => sum + (l.outstandingAmount || 0), 0)
                                                        : (selectedCustomerForReport.currentDueAmount || selectedCustomerForReport.loanAmount || 0)).toLocaleString()}
                                                </p>
                                            </Card>
                                        </div>

                                        {/* All Loans List */}
                                        <div className="mb-8 p-4 bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm relative z-0">
                                            <div className="flex justify-between items-center mb-4">
                                                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                                    <Wallet className="w-4 h-4" /> All Loans
                                                </h3>
                                            </div>
                                            {reportLoans.length === 0 ? (
                                                <div className="text-center py-6 text-slate-500 bg-slate-50 dark:bg-slate-800 rounded-lg">No active loans found.</div>
                                            ) : (
                                                <div className="space-y-3">
                                                    {reportLoans.map(loan => (
                                                        <div key={loan.id} className="p-4 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800/50 flex justify-between items-center group">
                                                            <div>
                                                                <div className="flex items-center gap-2">
                                                                    <span className="font-bold text-slate-900 dark:text-white">₹{loan.amount.toLocaleString()}</span>
                                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${loan.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>{loan.status}</span>
                                                                </div>
                                                                <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-2">
                                                                    <span className="text-indigo-600 font-medium">Disbursed: ₹{(loan.disbursedAmount || 0).toLocaleString()}</span>
                                                                    <span>•</span>
                                                                    <span>ID: {loan.id.slice(0, 8)}</span>
                                                                </div>
                                                            </div>
                                                            <div className="text-right flex flex-col items-end gap-0.5">
                                                                <div className="text-[10px] font-bold text-slate-600 dark:text-slate-400">
                                                                    {new Date(loan.startDate).toLocaleDateString()}
                                                                </div>
                                                                <div className="text-[10px] text-slate-400">
                                                                    {new Date(loan.startDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                </div>
                                                                <div className="text-[10px] text-amber-600 font-bold mt-1">₹{loan.outstandingAmount.toLocaleString()} Due</div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        <div className="space-y-4">
                                            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-widest">Transaction History</h3>
                                            {reportTransactions.length === 0 ? (
                                                <div className="text-center py-12 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                                                    <Clock className="w-8 h-8 text-slate-400 dark:text-slate-600 mx-auto mb-2" />
                                                    <p className="text-slate-500">No transactions recorded.</p>
                                                </div>
                                            ) : (
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-left">
                                                        <thead>
                                                            <tr className="text-xs text-slate-500 uppercase border-b border-slate-200 dark:border-slate-800">
                                                                <th className="pb-3 font-semibold">Date & Time</th>
                                                                <th className="pb-3 font-semibold">Description</th>
                                                                <th className="pb-3 font-semibold">Collected By</th>
                                                                <th className="pb-3 font-semibold text-right">Amount</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                                                            {reportTransactions.map(tx => (
                                                                <tr key={tx.id} className="text-sm group hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                                                                    <td className="py-4 whitespace-nowrap">
                                                                        <div className="flex flex-col">
                                                                            <span className="text-slate-900 dark:text-slate-200 font-medium whitespace-nowrap">
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
                                                                    <td className="py-4">
                                                                        <span className="text-slate-500 dark:text-slate-400 text-xs px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                                                                            {agents.find(u => u.uid === tx.collectedBy)?.displayName || 'Unknown'}
                                                                        </span>
                                                                    </td>
                                                                    <td className="py-4 text-right whitespace-nowrap">
                                                                        <span className="font-bold text-emerald-600 dark:text-emerald-400">₹{tx.amount.toLocaleString()}</span>
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
            <DeleteConfirmationModal
                isOpen={showDeleteModal}
                onClose={() => setShowDeleteModal(false)}
                onDelete={confirmDelete}
                onDeactivate={confirmDeactivate}
                title="Manage Agent"
                message={`What would you like to do with ${agentToDelete?.displayName}?`}
                entityName="agent"
            />
        </div >
    );
};
