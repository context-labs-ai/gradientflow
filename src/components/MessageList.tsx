import React, { useEffect, useRef } from 'react';
import { useChat } from '../context/ChatContext';
import { MessageBubble } from './MessageBubble';
import { AnimatePresence, motion } from 'framer-motion';

export const MessageList: React.FC = () => {
    const { state } = useChat();
    const bottomRef = useRef<HTMLDivElement>(null);
    const currentUserId = state.currentUser?.id;
    const typingNames = state.typingUsers
        .map(id => state.users.find(u => u.id === id))
        .filter(Boolean)
        .map(user => (user!.id === currentUserId ? 'You' : user!.name));

    const buildTypingText = () => {
        if (typingNames.length === 0) return '';
        if (typingNames.length === 1) {
            return typingNames[0] === 'You' ? 'You are typing' : `${typingNames[0]} is typing`;
        }
        if (typingNames.length === 2) return `${typingNames[0]} and ${typingNames[1]} are typing`;
        const others = typingNames.length - 2;
        return `${typingNames[0]}, ${typingNames[1]} and ${others} more are typing`;
    };

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [state.messages]);

    const typingText = buildTypingText();

    return (
        <div className="message-list">
            <div className="messages-wrapper">
                {state.messages.map((message, index) => {
                    const isOwnMessage = message.senderId === currentUserId;

                    // Determine if we should show the avatar (if previous message was from different user)
                    const prevMessage = state.messages[index - 1];
                    const showAvatar = !prevMessage || prevMessage.senderId !== message.senderId;

                    return (
                        <MessageBubble
                            key={message.id}
                            message={message}
                            isOwnMessage={isOwnMessage}
                            showAvatar={showAvatar}
                        />
                    );
                })}
                <AnimatePresence>
                    {typingNames.length > 0 && (
                        <motion.div
                            className="typing-indicator"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 8 }}
                            transition={{ duration: 0.2 }}
                        >
                            <div className="typing-bubble">
                                <span className="typing-text">{typingText}</span>
                                <span className="typing-dots" aria-hidden="true">
                                    <span className="dot" />
                                    <span className="dot" />
                                    <span className="dot" />
                                </span>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
                <div ref={bottomRef} />
            </div>

            <style>{`
        .message-list {
          flex: 1;
          overflow-y: auto;
          padding: var(--spacing-md) 0;
          display: flex;
          flex-direction: column;
          background-color: var(--bg-primary);
        }

        .messages-wrapper {
          display: flex;
          flex-direction: column;
          width: 100%;
          max-width: 768px;
          margin: 0 auto;
          margin-top: auto;
          padding: 0 var(--spacing-md);
          gap: 2px;
        }

        .typing-indicator {
          display: flex;
          align-items: center;
          padding: 12px 0 18px;
        }

        .typing-bubble {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          padding: 8px 14px;
          background: var(--bg-secondary);
          border-radius: 18px;
          border: 1px solid var(--border-light);
          color: var(--text-secondary);
          font-size: 0.9rem;
          box-shadow: var(--shadow-sm);
        }

        .typing-text {
          white-space: nowrap;
          font-weight: 500;
        }

        .typing-dots {
          display: inline-flex;
          gap: 4px;
        }

        .dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background-color: var(--text-tertiary);
          animation: typingBlink 1.4s infinite ease-in-out both;
        }

        .dot:nth-child(2) { animation-delay: 0.18s; }
        .dot:nth-child(3) { animation-delay: 0.32s; }

        @keyframes typingBlink {
          0%, 80%, 100% { opacity: 0.25; transform: translateY(0); }
          40% { opacity: 1; transform: translateY(-2px); }
        }
      `}</style>
        </div>
    );
};

