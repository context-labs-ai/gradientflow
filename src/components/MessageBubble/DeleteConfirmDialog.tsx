import React from 'react';
import { Trash2 } from 'lucide-react';
import './styles.css';

interface DeleteConfirmDialogProps {
    onCancel: () => void;
    onConfirm: () => void;
    isDeleting: boolean;
    error: string | null;
}

export const DeleteConfirmDialog: React.FC<DeleteConfirmDialogProps> = ({
    onCancel,
    onConfirm,
    isDeleting,
    error,
}) => {
    return (
        <div className="delete-confirm-card">
            <div className="delete-icon-wrapper">
                <Trash2 size={20} className="delete-icon-svg" />
            </div>
            <div className="delete-content-col">
                <span className="delete-title">Delete message?</span>
                <span className="delete-subtitle">This cannot be undone.</span>
            </div>
            {error && <span className="delete-error">{error}</span>}
            <div className="delete-confirm-actions">
                <button className="delete-confirm-btn ghost" onClick={onCancel} disabled={isDeleting}>
                    Cancel
                </button>
                <button
                    className="delete-confirm-btn destructive"
                    onClick={onConfirm}
                    disabled={isDeleting}
                >
                    {isDeleting ? 'Deleting...' : 'Delete'}
                </button>
            </div>
        </div>
    );
};
