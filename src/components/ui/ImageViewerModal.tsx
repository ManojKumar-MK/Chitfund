import React from 'react';
import { X, Download } from 'lucide-react';

interface ImageViewerModalProps {
    isOpen: boolean;
    onClose: () => void;
    imageUrl: string;
    title: string;
}

export const ImageViewerModal: React.FC<ImageViewerModalProps> = ({ isOpen, onClose, imageUrl, title }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm animate-in fade-in duration-200">
            {/* Toolbar */}
            <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between z-10 bg-gradient-to-b from-black/50 to-transparent">
                <h3 className="text-white font-medium text-lg drop-shadow-md">{title}</h3>
                <div className="flex items-center gap-2">
                    <a
                        href={imageUrl}
                        download={`${title.toLowerCase().replace(/\s+/g, '_')}.jpg`}
                        className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors backdrop-blur-md"
                        title="Download"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <Download className="w-5 h-5" />
                    </a>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors backdrop-blur-md"
                        title="Close"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Image Container */}
            <div
                className="w-full h-full p-4 flex items-center justify-center overflow-auto"
                onClick={onClose} // Click outside to close
            >
                <img
                    src={imageUrl}
                    alt={title}
                    className="max-w-full max-h-full object-contain shadow-2xl rounded-sm select-none"
                    onClick={(e) => e.stopPropagation()} // Prevent click propagation
                />
            </div>
        </div>
    );
};
