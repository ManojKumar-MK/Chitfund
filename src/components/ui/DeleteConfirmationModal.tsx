import React from 'react';
import { Button } from './Button';
import { Trash2, AlertTriangle, Archive } from 'lucide-react';

interface DeleteConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onDelete: () => void;
    onDeactivate: () => void;
    title?: string;
    message?: string;
    isDeactivating?: boolean;
    isDeleting?: boolean;
    entityName?: string;
}

export const DeleteConfirmationModal: React.FC<DeleteConfirmationModalProps> = ({
    isOpen,
    onClose,
    onDelete,
    onDeactivate,
    title = "Delete Record",
    message,
    isDeactivating = false,
    isDeleting = false,
    entityName = "record"
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-800 scale-100 transform transition-all">
                <div className="flex flex-col items-center text-center mb-6">
                    <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-4 text-amber-600 dark:text-amber-500">
                        <AlertTriangle className="w-6 h-6" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                        {title}
                    </h3>
                    <p className="text-slate-500 dark:text-slate-400">
                        {message || `How would you like to handle this ${entityName}?`}
                    </p>
                </div>

                <div className="space-y-3">
                    <button
                        onClick={onDeactivate}
                        disabled={isDeactivating || isDeleting}
                        className="w-full group flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-amber-500 dark:hover:border-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/10 transition-all text-left"
                    >
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 group-hover:text-amber-500 transition-colors">
                                <Archive className="w-5 h-5" />
                            </div>
                            <div>
                                <div className="font-semibold text-slate-900 dark:text-white">Deactivate (Soft Delete)</div>
                                <div className="text-xs text-slate-500">Mark as inactive but keep data for reports.</div>
                            </div>
                        </div>
                    </button>

                    <button
                        onClick={onDelete}
                        disabled={isDeactivating || isDeleting}
                        className="w-full group flex items-center justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-red-500 dark:hover:border-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-all text-left"
                    >
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 group-hover:text-red-500 transition-colors">
                                <Trash2 className="w-5 h-5" />
                            </div>
                            <div>
                                <div className="font-semibold text-slate-900 dark:text-white">Delete Permanently</div>
                                <div className="text-xs text-slate-500">Remove completely. This cannot be undone.</div>
                            </div>
                        </div>
                    </button>
                </div>

                <div className="mt-6 flex justify-end">
                    <Button variant="ghost" onClick={onClose} disabled={isDeactivating || isDeleting}>
                        Cancel
                    </Button>
                </div>
            </div>
        </div>
    );
};
