import React from 'react';
import { User } from '../../types/chat';
import './styles.css';

interface MessageContentProps {
    content: string;
    users: User[];
}

export const MessageContent: React.FC<MessageContentProps> = ({ content, users }) => {
    const renderMessageContent = (content: string, users: User[]) => {
        const mentionRegex = /@(\w+)/g;
        const parts: (string | JSX.Element)[] = [];
        let lastIndex = 0;
        let match;

        while ((match = mentionRegex.exec(content)) !== null) {
            if (match.index > lastIndex) {
                parts.push(content.substring(lastIndex, match.index));
            }

            const mentionedUsername = match[1];
            const mentionedUser = users.find(u =>
                u.name.toLowerCase() === mentionedUsername.toLowerCase() ||
                u.id === mentionedUsername
            );

            parts.push(
                <span
                    key={match.index}
                    className="mention-highlight"
                    title={mentionedUser ? `@${mentionedUser.name}` : undefined}
                >
                    @{mentionedUsername}
                </span>
            );

            lastIndex = match.index + match[0].length;
        }

        if (lastIndex < content.length) {
            parts.push(content.substring(lastIndex));
        }

        return parts.length > 0 ? parts : content;
    };

    return <span className="bubble-text">{renderMessageContent(content, users)}</span>;
};
