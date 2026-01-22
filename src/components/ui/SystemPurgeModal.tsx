import React, { useState } from 'react';
import { Button } from './Button';
import { Input } from './Input';
import { AlertTriangle, Trash2, X } from 'lucide-react';

interface SystemPurgeModalProps {
    isOpen: boolean;
    onClose: () => void;
    onPurge: () => Promise<void>;
}

export const SystemPurgeModal: React.FC<SystemPurgeModalProps> = ({
    isOpen,
    onClose,
    onPurge,
}) => {
    const [confirmText, setConfirmText] = useState('');
    const [isPurging, setIsPurging] = useState(false);

    if (!isOpen) return null;

    const handlePurge = async () => {
        if (confirmText !== 'PURGE') return;
        setIsPurging(true);
        try {
            await onPurge();
            onClose();
        } finally {
            setIsPurging(false);
            setConfirmText('');
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-800 scale-100 transform transition-all relative">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>

                <div className="flex flex-col items-center text-center mb-6">
                    <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4 text-red-600 dark:text-red-500">
                        <AlertTriangle className="w-8 h-8" />
                    </div>
                    <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                        System Purge
                    </h3>
                    <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                        This action will permanently <span className="text-red-600 font-bold uppercase underline">delete everything</span> in the system.
                    </p>
                </div>

                <div className="bg-red-50 dark:bg-red-900/10 rounded-xl p-4 mb-6 text-sm text-red-700 dark:text-red-400">
                    <p className="font-semibold mb-2">The following will be lost forever:</p>
                    <ul className="list-disc list-inside space-y-1 opacity-80">
                        <li>All Customer profiles & documents</li>
                        <li>All Active Loans & Chit Schemes</li>
                        <li>All Payments & Collection logs</li>
                        <li>All Activities & Audit trails</li>
                        <li>All Agents (except you)</li>
                    </ul>
                </div>

                <div className="space-y-4">
                    <div className="text-center">
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
                            Type <span className="font-mono font-bold text-slate-900 dark:text-white">PURGE</span> below to confirm.
                        </p>
                        <Input
                            value={confirmText}
                            onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
                            placeholder="Type PURGE here"
                            className="text-center font-bold tracking-widest uppercase border-red-200 focus:border-red-500 focus:ring-red-500/20"
                            autoFocus
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-2">
                        <Button variant="secondary" onClick={onClose} disabled={isPurging}>
                            Go Back
                        </Button>
                        <Button
                            variant="danger"
                            disabled={confirmText !== 'PURGE' || isPurging}
                            isLoading={isPurging}
                            onClick={handlePurge}
                            className="shadow-red-500/20"
                        >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Purge System
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};
