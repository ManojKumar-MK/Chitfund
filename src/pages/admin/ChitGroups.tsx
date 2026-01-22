import { BadgeIndianRupee, Calendar, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { Input } from '../../components/ui/Input';
import { ChitGroupService } from '../../services/chitGroupService';
import type { ChitGroup } from '../../types';

export const ChitGroups = () => {
    const [groups, setGroups] = useState<ChitGroup[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);

    // Form State
    const [newGroupName, setNewGroupName] = useState('');
    const [chitValue, setChitValue] = useState('');
    const [duration, setDuration] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        fetchGroups();
    }, []);

    const fetchGroups = async () => {
        setLoading(true);
        try {
            const data = await ChitGroupService.getAll();
            setGroups(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleAddGroup = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const val = parseFloat(chitValue);
            const dur = parseInt(duration);

            await ChitGroupService.create({
                name: newGroupName,
                value: val,
                durationWeeks: dur,
                weeklyInstallment: val / dur,
                membersCount: 0,
                foremanCommissionPercent: 5, // Default
                startDate: new Date().toISOString(),
                endDate: new Date(new Date().setDate(new Date().getDate() + (dur * 7))).toISOString(),
                status: 'UPCOMING',
                members: []
            });

            await fetchGroups();
            setShowAddModal(false);
            resetForm();
        } catch (err) {
            console.error(err);
        } finally {
            setIsSubmitting(false);
        }
    };

    const resetForm = () => {
        setNewGroupName('');
        setChitValue('');
        setDuration('');
    };

    if (loading) return <div className="p-8 text-center text-slate-500 dark:text-slate-400">Loading Chit Groups...</div>;

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-green-400 to-emerald-400 text-transparent bg-clip-text">
                        Chit Groups
                    </h1>
                    <p className="text-slate-600 dark:text-slate-400 mt-1">Manage active and upcoming chit funds</p>
                </div>
                <Button onClick={() => setShowAddModal(true)} className="gap-2 bg-emerald-600 hover:bg-emerald-500 text-white">
                    <Plus className="w-4 h-4" /> Create New Chit
                </Button>
            </div>

            {
                groups.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {groups.map((group) => (
                            <Card key={group.id} className="relative group hover:border-green-500/50 transition-colors">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="p-2 rounded-lg bg-green-500/10 text-green-500 dark:text-green-400">
                                        <BadgeIndianRupee className="w-6 h-6" />
                                    </div>
                                    <span className={`px-2 py-1 rounded text-xs font-medium ${group.status === 'ACTIVE' ? 'bg-green-500/20 text-green-600 dark:text-green-400' : 'bg-blue-500/20 text-blue-600 dark:text-blue-400'
                                        }`}>
                                        {group.status}
                                    </span>
                                </div>

                                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{group.name}</h3>

                                <div className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                                    <div className="flex justify-between">
                                        <span>Value:</span>
                                        <span className="text-slate-900 dark:text-white font-medium">₹ {group.value.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Weekly:</span>
                                        <span className="text-slate-900 dark:text-white font-medium">₹ {group.weeklyInstallment.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Members:</span>
                                        <span className="text-slate-900 dark:text-white font-medium">{group.membersCount} / {group.durationWeeks}</span>
                                    </div>
                                </div>

                                <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 flex items-center text-xs text-slate-500 gap-2">
                                    <Calendar className="w-3 h-3" />
                                    <span>{group.durationWeeks} Weeks</span>
                                </div>
                            </Card>
                        ))}
                    </div>
                ) : (
                    <EmptyState
                        title="No Chit Groups Found"
                        description="Create your first chit group to get started."
                        actionLabel="Create New Chit"
                        onAction={() => setShowAddModal(true)}
                        icon={BadgeIndianRupee}
                    />
                )
            }

            {/* Add Group Modal */}
            {
                showAddModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/80 backdrop-blur-sm p-4">
                        <Card className="w-full max-w-md bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 shadow-2xl">
                            <h2 className="text-xl font-bold mb-4 text-slate-900 dark:text-white">Create New Chit Group</h2>
                            <form onSubmit={handleAddGroup} className="space-y-4">
                                <Input
                                    label="Group Name"
                                    placeholder="Ex. Elite 50K Group"
                                    value={newGroupName}
                                    onChange={(e) => setNewGroupName(e.target.value)}
                                    required
                                />
                                <Input
                                    label="Total Value (₹)"
                                    type="number"
                                    placeholder="50000"
                                    value={chitValue}
                                    onChange={(e) => setChitValue(e.target.value)}
                                    required
                                />
                                <Input
                                    label="Duration (Weeks)"
                                    type="number"
                                    placeholder="20"
                                    value={duration}
                                    onChange={(e) => setDuration(e.target.value)}
                                    required
                                />
                                <div className="flex justify-end gap-3 mt-6">
                                    <Button type="button" variant="ghost" onClick={() => setShowAddModal(false)}>
                                        Cancel
                                    </Button>
                                    <Button type="submit" isLoading={isSubmitting} className="bg-emerald-600 hover:bg-emerald-500 text-white">
                                        Create Group
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
