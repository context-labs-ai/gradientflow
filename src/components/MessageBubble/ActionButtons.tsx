import React from 'react';
import { Reply, Trash2, MoreHorizontal } from 'lucide-react';
import './styles.css';

interface ActionButtonsProps {
    onReply: () => void;
    onDelete?: () => void;
    isOwnMessage: boolean;
}

export const ActionButtons: React.FC<ActionButtonsProps> = React.memo(({
    onReply,
    onDelete,
    isOwnMessage,
}) => {
    return (
        <div className="action-buttons">
            <button className="action-btn" onClick={onReply} title="Reply">
                <Reply size={16} />
            </button>
            {isOwnMessage && onDelete ? (
                <button className="action-btn delete-btn" onClick={onDelete} title="Delete">
                    <Trash2 size={16} />
                </button>
            ) : (
                <button className="action-btn" title="More">
                    <MoreHorizontal size={16} />
                </button>
            )}
        </div>
    );
});
