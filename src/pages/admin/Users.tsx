import React, { useState, useEffect } from 'react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { toast } from 'sonner';
import { Input } from '../../components/ui/Input';
import { Plus, Search, UserPlus, Shield, User as UserIcon, Loader2, Mail } from 'lucide-react';
import { UserService } from '../../services/userService';
import type { User, UserRole } from '../../types';
import { useAuth } from '../../context/AuthContext';

export const Users = () => {
    const { user: currentUser } = useAuth();
    const [users, setUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);

    // Form State
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [role, setRole] = useState<UserRole>('AGENT');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        setIsLoading(true);
        try {
            const data = await UserService.getAll();
            setUsers(data);
        } catch (error) {
            console.error("Error fetching users:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleInviteUser = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            // Default password is the email itself
            await UserService.inviteUser(email, role, name, email);
            await fetchUsers();
            setShowAddModal(false);
            resetForm();
        } catch (error) {
            console.error("Error inviting user:", error);
            toast.error("Failed to invite user. Email might already exist.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const resetForm = () => {
        setName('');
        setEmail('');
        setRole('AGENT');
    };

    const filteredUsers = users.filter(u =>
        (u.displayName?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        u.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (isLoading) {
        return <div className="p-8 flex justify-center text-slate-400"><Loader2 className="animate-spin" /> Loading Users...</div>;
    }

    return (
        <div className="p-8 max-w-7xl mx-auto text-white">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 text-transparent bg-clip-text">
                        User Management
                    </h1>
                    <p className="text-slate-400 mt-1">Manage system access and roles</p>
                </div>
                <Button onClick={() => setShowAddModal(true)} className="gap-2 bg-purple-600 hover:bg-purple-500 text-white border-none shadow-lg shadow-purple-900/20">
                    <UserPlus className="w-5 h-5" /> Add User
                </Button>
            </div>

            {/* Search */}
            <div className="mb-8">
                <div className="relative max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <Input
                        placeholder="Search users..."
                        className="pl-10 bg-slate-800/50 border-slate-700 text-white focus:border-purple-500"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredUsers.map((user) => (
                    <Card key={user.uid} className="relative group border-slate-800 bg-slate-900/50 hover:border-purple-500/50 transition-colors">
                        <div className="flex items-start gap-4">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold text-white shadow-lg ${user.role === 'ADMIN' ? 'bg-gradient-to-br from-purple-500 to-pink-500' : 'bg-gradient-to-br from-blue-500 to-cyan-500'
                                }`}>
                                {user.displayName?.charAt(0) || 'U'}
                            </div>
                            <div className="flex-1">
                                <h3 className="font-semibold text-lg text-slate-100 flex items-center gap-2">
                                    {user.displayName}
                                    {user.uid === currentUser?.uid && <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded">You</span>}
                                </h3>
                                <p className="text-sm text-slate-400 flex items-center gap-1">
                                    <Mail className="w-3 h-3" /> {user.email}
                                </p>
                                <div className="mt-3 flex items-center gap-2">
                                    <span className={`text-xs px-2 py-1 rounded border ${user.role === 'ADMIN'
                                        ? 'bg-purple-900/30 border-purple-800 text-purple-300'
                                        : 'bg-blue-900/30 border-blue-800 text-blue-300'
                                        } flex items-center gap-1`}>
                                        {user.role === 'ADMIN' ? <Shield className="w-3 h-3" /> : <UserIcon className="w-3 h-3" />}
                                        {user.role}
                                    </span>
                                    <span className={`text-xs px-2 py-1 rounded border ${user.status === 'ACTIVE'
                                        ? 'bg-emerald-900/30 border-emerald-800 text-emerald-300'
                                        : 'bg-red-900/30 border-red-800 text-red-300'
                                        }`}>
                                        {user.status}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </Card>
                ))}
            </div>

            {/* Add User Modal */}
            {showAddModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <Card className="w-full max-w-md bg-slate-900 border-slate-700">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-2xl font-bold text-white">Add New User</h2>
                            <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-slate-800 rounded-full transition-colors">
                                <Plus className="w-6 h-6 rotate-45 text-slate-400" />
                            </button>
                        </div>

                        <div className="mb-6 p-4 bg-blue-900/20 border border-blue-800 rounded-lg text-sm text-blue-200">
                            <strong>Note:</strong> Create an account for the agent. You must set an initial password, which they will use to log in for the first time.
                        </div>

                        <form onSubmit={handleInviteUser} className="space-y-6">
                            <Input label="Full Name" value={name} onChange={e => setName(e.target.value)} required />
                            <Input label="Email Address" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
                            <div className="text-xs text-slate-400 mt-1">
                                Default password will be set to the email address.
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1">Role</label>
                                <select
                                    className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white appearance-none focus:ring-2 focus:ring-purple-500 outline-none"
                                    value={role}
                                    onChange={(e) => setRole(e.target.value as UserRole)}
                                >
                                    <option value="AGENT">Field Agent</option>
                                    <option value="ADMIN">Administrator</option>
                                </select>
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
                                <Button type="button" variant="ghost" onClick={() => setShowAddModal(false)}>Cancel</Button>
                                <Button type="submit" className="bg-purple-600 hover:bg-purple-500" disabled={isSubmitting}>
                                    {isSubmitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</> : 'Create User'}
                                </Button>
                            </div>
                        </form>
                    </Card>
                </div>
            )}
        </div>
    );
};
