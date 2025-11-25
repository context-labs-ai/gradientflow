import React from 'react';
import { Check, CheckCheck, Clock, XCircle } from 'lucide-react';
import { MessageStatus as MessageStatusType } from '../types/chat';

interface MessageStatusProps {
    status?: MessageStatusType;
    isOwnMessage: boolean;
}

export const MessageStatus: React.FC<MessageStatusProps> = ({ status, isOwnMessage }) => {
    // Only show status for own messages
    if (!isOwnMessage || !status) return null;

    const getStatusIcon = () => {
        switch (status.type) {
            case 'sending':
                return <Clock size={14} className="message-status-icon sending" />;
            case 'sent':
                return <Check size={14} className="message-status-icon sent" />;
            case 'delivered':
                return <CheckCheck size={14} className="message-status-icon delivered" />;
            case 'read':
                return <CheckCheck size={14} className="message-status-icon read" />;
            case 'failed':
                return <XCircle size={14} className="message-status-icon failed" />;
            default:
                return null;
        }
    };

    const getStatusTitle = () => {
        switch (status.type) {
            case 'sending':
                return 'Sending...';
            case 'sent':
                return 'Sent';
            case 'delivered':
                return 'Delivered';
            case 'read':
                return 'Read';
            case 'failed':
                return `Failed: ${status.error}`;
            default:
                return '';
        }
    };

    return (
        <span className="message-status" title={getStatusTitle()}>
            {getStatusIcon()}
        </span>
    );
};
