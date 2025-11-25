import React from 'react';
import { User, Message } from '../../types/chat';
import './styles.css';

interface ReplyContextProps {
    repliedMessage: Message;
    repliedUser: User;
    onReplyClick: () => void;
}

export const ReplyContext: React.FC<ReplyContextProps> = ({
    repliedMessage,
    repliedUser,
    onReplyClick,
}) => {
    return (
        <div className="reply-context" onClick={onReplyClick}>
            <div className="reply-bar" />
            <div className="reply-content-wrapper">
                <span className="reply-author">{repliedUser.name}</span>
                <span className="reply-text">{repliedMessage.content}</span>
            </div>
        </div>
    );
};
