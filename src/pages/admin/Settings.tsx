import React, { useState } from 'react';
import { toast } from 'sonner';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useSettings } from '../../context/SettingsContext';
import { Plus, Trash2, Save, AlertTriangle } from 'lucide-react';
import { UserService } from '../../services/userService';
import { CustomerService } from '../../services/customerService';
import { LoanService } from '../../services/loanService';
import { PaymentService } from '../../services/paymentService';
import { CollectionService } from '../../services/collectionService';
import { ActivityService } from '../../services/activityService';
import { ChitGroupService } from '../../services/chitGroupService';
import { InvestorService } from '../../services/investorService';
import { db } from '../../lib/firebase';
import { deleteDoc, doc } from 'firebase/firestore';
import { SystemPurgeModal } from '../../components/ui/SystemPurgeModal';

export const Settings = () => {
    const { settings, updateInterestRates, addField } = useSettings();
    const [weeklyRate, setWeeklyRate] = useState(settings.interestRates.weekly);

    // Field Form State
    const [newFieldLabel, setNewFieldLabel] = useState('');
    const [newFieldType, setNewFieldType] = useState<'text' | 'number'>('text');

    const [activeTab, setActiveTab] = useState<'general' | 'fields' | 'danger'>('general');
    const [fieldTarget, setFieldTarget] = useState<'customer' | 'agent'>('customer');
    const [isPurgeModalOpen, setIsPurgeModalOpen] = useState(false);

    const handlePurgeAllData = async () => {
        const toastId = toast.loading("Purging all system data...");

        try {
            const collectionsToPurge = [
                { name: 'activities', service: ActivityService },
                { name: 'chitGroups', service: ChitGroupService },
                { name: 'collections', service: CollectionService },
                { name: 'payments', service: PaymentService },
                { name: 'loans', service: LoanService },
                { name: 'customers', service: CustomerService },
                { name: 'investors', service: InvestorService },
            ];

            // 1. Purge all standard collections
            for (const col of collectionsToPurge) {
                console.log(`Purging ${col.name}...`);
                const items = await col.service.getAll();
                if (items.length > 0) {
                    await Promise.allSettled(items.map((item: any) => deleteDoc(doc(db, col.name, item.id))));
                    console.log(`Deleted ${items.length} items from ${col.name}.`);
                }
            }

            // 2. Purge Users (Special handling to keep 2klubyt@gmail.com)
            console.log("Purging users...");
            const users = await UserService.getAll();
            const usersToDelete = users.filter(u => u.email?.toLowerCase() !== '2klubyt@gmail.com');

            if (usersToDelete.length > 0) {
                await Promise.allSettled(usersToDelete.map(u => UserService.delete(u.uid)));
                console.log(`Deleted ${usersToDelete.length} users.`);
            }

            toast.dismiss(toastId);
            toast.success("System purge complete. All data cleared except for the main admin.");

        } catch (error: any) {
            console.error("Purge failed:", error);
            toast.dismiss(toastId);
            toast.error("Purge failed: " + error.message);
            throw error; // Rethrow to let the modal know it failed
        }
    };

    const handleSaveRates = () => {
        updateInterestRates(weeklyRate);
        toast.success('Interest rates updated successfully!');
    };

    const handleAddField = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newFieldLabel) return;

        addField(fieldTarget, {
            id: fieldTarget + '-' + Date.now(),
            label: newFieldLabel,
            type: newFieldType,
            required: false
        });
        setNewFieldLabel('');
    };

    return (
        <div className="p-8 max-w-4xl mx-auto text-slate-900 dark:text-white">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-700 to-slate-500 dark:from-gray-200 dark:to-gray-400 text-transparent bg-clip-text mb-8">
                System Configurations
            </h1>

            <div className="flex gap-4 mb-8">
                <Button
                    variant={activeTab === 'general' ? 'primary' : 'secondary'}
                    onClick={() => setActiveTab('general')}
                >
                    General Settings
                </Button>
                <Button
                    variant={activeTab === 'fields' ? 'primary' : 'secondary'}
                    onClick={() => setActiveTab('fields')}
                >
                    Form Fields
                </Button>
                <Button
                    variant={activeTab === 'danger' ? 'primary' : 'secondary'}
                    onClick={() => setActiveTab('danger')}
                    className={activeTab === 'danger' ? 'bg-red-600 hover:bg-red-700 border-transparent text-white' : 'text-red-600 border-red-200 hover:bg-red-50 dark:hover:bg-red-900/10'}
                >
                    Danger Zone
                </Button>
            </div>

            {activeTab === 'general' && (
                <div className="grid gap-6">
                    <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-lg">
                                <Save className="w-5 h-5" />
                            </div>
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Interest Rates</h2>
                        </div>

                        <div className="grid grid-cols-1 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-400 mb-2">
                                    Weekly Interest Rate (%)
                                </label>
                                <Input
                                    type="number"
                                    step="0.1"
                                    value={weeklyRate}
                                    onChange={(e) => setWeeklyRate(parseFloat(e.target.value))}
                                />
                                <p className="text-xs text-slate-500 mt-1">Applied to weekly schemes.</p>
                            </div>
                        </div>

                        <div className="mt-8 flex justify-end">
                            <Button onClick={handleSaveRates} className="bg-indigo-600 hover:bg-indigo-500">
                                Save Changes
                            </Button>
                        </div>
                    </Card>
                </div>
            )}

            {activeTab === 'fields' && (
                <div className="space-y-6">
                    <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">Add Custom Field</h2>
                        <form onSubmit={handleAddField} className="flex gap-4 items-end">
                            <div className="flex-1">
                                <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">Target Form</label>
                                <select
                                    className="w-full bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-white"
                                    value={fieldTarget}
                                    onChange={(e) => setFieldTarget(e.target.value as 'customer' | 'agent')}
                                >
                                    <option value="customer">Customer Form</option>
                                    <option value="agent">Agent Form</option>
                                </select>
                            </div>
                            <div className="flex-1">
                                <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">Field Label</label>
                                <Input
                                    placeholder="e.g. Nickname"
                                    value={newFieldLabel}
                                    onChange={(e) => setNewFieldLabel(e.target.value)}
                                />
                            </div>
                            <div className="w-32">
                                <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">Type</label>
                                <select
                                    className="w-full bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 rounded-lg p-2 text-slate-900 dark:text-white"
                                    value={newFieldType}
                                    onChange={(e) => setNewFieldType(e.target.value as any)}
                                >
                                    <option value="text">Text</option>
                                    <option value="number">Number</option>
                                </select>
                            </div>
                            <Button type="submit" className="mb-[2px]">
                                <Plus className="w-5 h-5" />
                            </Button>
                        </form>
                    </Card>

                    <div className="grid md:grid-cols-2 gap-6">
                        <Card className="bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800">
                            <h3 className="font-semibold text-lg mb-4 text-indigo-600 dark:text-indigo-400">Customer Fields</h3>
                            {settings.customFields.customer.length === 0 ? (
                                <p className="text-slate-500 text-sm italic">No custom fields added.</p>
                            ) : (
                                <ul className="space-y-2">
                                    {settings.customFields.customer.map(field => (
                                        <li key={field.id} className="flex justify-between items-center bg-white dark:bg-slate-800 p-3 rounded border border-slate-200 dark:border-slate-700">
                                            <span className="text-slate-700 dark:text-slate-200">{field.label} <span className="text-xs text-slate-500">({field.type})</span></span>
                                            <Trash2 className="w-4 h-4 text-red-500 dark:text-red-400 cursor-pointer" />
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </Card>

                        <Card className="bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800">
                            <h3 className="font-semibold text-lg mb-4 text-emerald-600 dark:text-emerald-400">Agent Fields</h3>
                            {settings.customFields.agent.length === 0 ? (
                                <p className="text-slate-500 text-sm italic">No custom fields added.</p>
                            ) : (
                                <ul className="space-y-2">
                                    {settings.customFields.agent.map(field => (
                                        <li key={field.id} className="flex justify-between items-center bg-white dark:bg-slate-800 p-3 rounded border border-slate-200 dark:border-slate-700">
                                            <span className="text-slate-700 dark:text-slate-200">{field.label} <span className="text-xs text-slate-500">({field.type})</span></span>
                                            <Trash2 className="w-4 h-4 text-red-500 dark:text-red-400 cursor-pointer" />
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </Card>
                    </div>
                </div>
            )}
            {activeTab === 'danger' && (
                <div className="space-y-6">
                    <Card className="bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-900/30">
                        <div className="flex items-center gap-3 mb-4 text-red-700 dark:text-red-400">
                            <AlertTriangle className="w-6 h-6" />
                            <h2 className="text-xl font-bold">System Reset</h2>
                        </div>
                        <p className="text-slate-700 dark:text-slate-300 mb-6">
                            This action will permanently delete all data from the system, including:
                        </p>
                        <ul className="list-disc list-inside mt-2 ml-2 space-y-1 text-sm text-slate-600 dark:text-slate-400 mb-6">
                            <li>All Agents and Users (except 2klubyt@gmail.com)</li>
                            <li>All Customer Profiles</li>
                            <li>All Loans and active schemes</li>
                            <li>All Transaction history and Payment records</li>
                            <li>All Collection records</li>
                        </ul>

                        <div className="flex justify-end">
                            <Button
                                onClick={() => setIsPurgeModalOpen(true)}
                                className="bg-red-600 hover:bg-red-700 text-white border-none shadow-lg shadow-red-500/20"
                            >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete All Data
                            </Button>
                        </div>
                    </Card>

                    <SystemPurgeModal
                        isOpen={isPurgeModalOpen}
                        onClose={() => setIsPurgeModalOpen(false)}
                        onPurge={handlePurgeAllData}
                    />
                </div>
            )}
        </div>
    );
};
