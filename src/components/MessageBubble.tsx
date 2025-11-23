import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Message } from '../types/chat';
import { useChat } from '../context/ChatContext';
import { Reply, MoreHorizontal } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';

interface MessageBubbleProps {
  message: Message;
  isOwnMessage: boolean;
  showAvatar: boolean;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message, isOwnMessage, showAvatar }) => {
  const { state, dispatch } = useChat();
  const currentUserId = state.currentUser?.id;
  const sender = state.users.find(u => u.id === message.senderId);
  const [isHovered, setIsHovered] = useState(false);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const HOVER_IN_DELAY = 80;
  const HOVER_OUT_DELAY = 220;

  const clearHoverTimeout = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
  };

  const repliedMessage = message.replyToId ? state.messages.find(m => m.id === message.replyToId) : null;
  const repliedUser = repliedMessage ? state.users.find(u => u.id === repliedMessage.senderId) : null;

  const handleReaction = (emoji: string) => {
    if (!state.currentUser) return;
    dispatch({
      type: 'ADD_REACTION',
      payload: { messageId: message.id, reaction: { emoji, count: 1, userIds: [state.currentUser.id] } }
    });
  };

  const handleReply = () => {
    dispatch({ type: 'SET_REPLYING_TO', payload: message });
  };

  const handleMouseEnter = () => {
    clearHoverTimeout();
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHovered(true);
    }, HOVER_IN_DELAY);
  };

  const handleMouseLeave = () => {
    clearHoverTimeout();
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHovered(false);
    }, HOVER_OUT_DELAY);
  };

  useEffect(() => () => clearHoverTimeout(), []);

  const timestamp = useMemo(() => new Date(message.timestamp), [message.timestamp]);
  const timeLabel = timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const fullTimeLabel = timestamp.toLocaleString();

  return (
    <motion.div
      initial={{ opacity: 0, x: isOwnMessage ? 16 : -16, scale: 0.98 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: isOwnMessage ? 10 : -10 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      layout
      className={clsx('message-container', isOwnMessage ? 'own' : 'other')}
    >
      {!isOwnMessage && (
        <div className="avatar-column">
          {showAvatar && sender && (
            <img src={sender.avatar} alt={sender.name} className="avatar" />
          )}
        </div>
      )}

      <div
        className="content-column"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {!isOwnMessage && showAvatar && sender && (
          <div className="sender-name">
            {sender.name}
            {sender.isLLM && <span className="bot-tag">BOT</span>}
            <span className="timestamp">{timeLabel}</span>
          </div>
        )}

        {repliedMessage && repliedUser && (
          <div className="reply-context" onClick={handleReply}>
            <div className="reply-bar" />
            <div className="reply-content-wrapper">
              <span className="reply-author">{repliedUser.name}</span>
              <span className="reply-text">{repliedMessage.content}</span>
            </div>
          </div>
        )}

        <div className={clsx('bubble', isOwnMessage ? 'own' : 'other', isHovered && 'hovered')}>
          <span className="bubble-text">{message.content}</span>
          <span className="bubble-timestamp" aria-label={fullTimeLabel} title={fullTimeLabel}>
            {timeLabel}
          </span>
        </div>

        {message.reactions.length > 0 && (
          <div className="reactions-list">
            {message.reactions.map((reaction, idx) => (
              <button
                key={idx}
                className={clsx('reaction-pill', currentUserId && reaction.userIds.includes(currentUserId) && 'active')}
                onClick={() => handleReaction(reaction.emoji)}
              >
                <span>{reaction.emoji}</span>
                <span className="count">{reaction.count}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {isHovered && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 8 }}
            transition={{ duration: 0.15 }}
            className="actions-group"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            <div className="emoji-panel">
              {['👍', '❤️', '😂', '😮', '😢', '🔥'].map(emoji => (
                <button
                  key={emoji}
                  className={clsx('emoji-btn', currentUserId && message.reactions.find(r => r.emoji === emoji && r.userIds.includes(currentUserId)) && 'active')}
                  onClick={() => handleReaction(emoji)}
                >
                  {emoji}
                </button>
              ))}
            </div>
            <div className="action-buttons">
              <button className="action-btn" onClick={handleReply} title="Reply">
                <Reply size={16} />
              </button>
              <button className="action-btn" title="More">
                <MoreHorizontal size={16} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .message-container {
          display: flex;
          gap: var(--spacing-sm);
          margin-bottom: 2px;
          padding: 2px 0;
          position: relative;
          align-items: flex-end;
        }

        .message-container.own {
          flex-direction: row-reverse;
        }

        .avatar-column {
          width: 36px;
          flex-shrink: 0;
          display: flex;
          margin-bottom: 4px;
        }

        .avatar {
          width: 36px;
          height: 36px;
          border-radius: var(--radius-full);
          object-fit: cover;
        }

        .content-column {
          display: flex;
          flex-direction: column;
          max-width: 75%;
          align-items: flex-start;
          position: relative;
        }

        .message-container.own .content-column {
          align-items: flex-end;
        }

        .sender-name {
          font-size: 0.75rem;
          font-weight: 500;
          color: var(--text-secondary);
          margin-bottom: 2px;
          margin-left: 12px;
          display: flex;
          align-items: center;
          gap: var(--spacing-xs);
        }

        .timestamp {
          font-size: 0.7rem;
          color: var(--text-tertiary);
          font-weight: 400;
          margin-left: var(--spacing-xs);
        }

        .bot-tag {
          font-size: 0.6rem;
          background-color: var(--accent-primary);
          color: white;
          padding: 1px 4px;
          border-radius: 4px;
        }

        .bubble {
          padding: 8px 12px;
          border-radius: var(--radius-xl);
          font-size: 1rem;
          line-height: 1.4;
          position: relative;
          box-shadow: var(--shadow-sm);
          transition: background-color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease, border-color 0.18s ease;
          border: 1px solid transparent;
          background-image: linear-gradient(180deg, rgba(255,255,255,0.05), rgba(0,0,0,0.02));
          transform-origin: center;
          will-change: transform, box-shadow;
          display: inline-flex;
          gap: 8px;
          align-items: flex-end;
        }

        .bubble-text {
          white-space: pre-wrap;
          word-wrap: break-word;
          word-break: break-word;
        }

        .bubble-timestamp {
          font-size: 0.7rem;
          color: var(--text-tertiary);
          opacity: 0;
          transform: translateY(4px);
          transition: opacity 0.18s ease, transform 0.18s ease;
        }

        .bubble.hovered .bubble-timestamp {
          opacity: 0.9;
          transform: translateY(0);
        }

        @media (max-width: 768px) {
          .bubble-timestamp {
            opacity: 0.8;
            transform: translateY(0);
          }
        }

        .bubble::after {
          content: '';
          position: absolute;
          inset: -2px;
          border-radius: calc(var(--radius-xl) + 2px);
          pointer-events: none;
          background: radial-gradient(circle at 20% 20%, rgba(51, 144, 236, 0.14), transparent 55%);
          opacity: 0;
          transition: opacity 0.2s ease, transform 0.2s ease;
        }

        .bubble.hovered {
          box-shadow: var(--shadow-lg), 0 0 0 1px rgba(0, 0, 0, 0.04);
          transform: translateY(-1px);
        }

        .bubble.hovered::after {
          opacity: 1;
          transform: scale(1.01);
        }

        .bubble.own {
          background-color: var(--message-own-bg);
          color: var(--message-own-text);
          border-bottom-right-radius: 4px;
          border-color: rgba(51, 144, 236, 0.16);
        }

        .bubble.other {
          background-color: var(--message-other-bg);
          color: var(--message-other-text);
          border-bottom-left-radius: 4px;
          border-color: rgba(0, 0, 0, 0.05);
        }

        .bubble.own.hovered {
          background-color: #e8ffd4;
          box-shadow: var(--shadow-lg), 0 4px 16px rgba(51, 144, 236, 0.15);
        }

        .bubble.other.hovered {
          background-color: #f8fafc;
          box-shadow: var(--shadow-lg), 0 4px 16px rgba(0, 0, 0, 0.08);
        }

        .reply-context {
          display: flex;
          align-items: stretch;
          gap: var(--spacing-xs);
          margin-bottom: 4px;
          font-size: 0.85rem;
          cursor: pointer;
          padding-left: 4px;
        }

        .reply-bar {
          width: 3px;
          background-color: var(--accent-primary);
          border-radius: 2px;
        }
        
        .reply-content-wrapper {
            display: flex;
            flex-direction: column;
            justify-content: center;
        }

        .reply-author {
          font-weight: 600;
          color: var(--accent-primary);
          font-size: 0.8rem;
        }

        .reply-text {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 200px;
          color: var(--text-secondary);
        }

        .reactions-list {
          display: flex;
          gap: 4px;
          margin-top: 4px;
        }

        .reaction-pill {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 2px 8px;
          background-color: var(--bg-primary);
          border: 1px solid var(--border-light);
          border-radius: var(--radius-full);
          font-size: 0.75rem;
          color: var(--text-secondary);
          transition: var(--transition-fast);
          box-shadow: var(--shadow-sm);
        }

        .reaction-pill:hover {
          background-color: var(--bg-tertiary);
        }

        .reaction-pill.active {
          background-color: var(--accent-primary);
          border-color: var(--accent-primary);
          color: white;
        }

        .actions-group {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 4px;
          background-color: var(--bg-primary);
          border: 1px solid var(--border-light);
          border-radius: var(--radius-full);
          box-shadow: var(--shadow-md);
          position: absolute;
          top: -42px;
          z-index: 10;
        }

        .message-container.own .actions-group {
          right: 0;
          flex-direction: row-reverse;
        }

        .message-container.other .actions-group {
          left: 0;
        }

        .emoji-panel {
            display: flex;
            gap: 2px;
            padding-right: 8px;
            border-right: 1px solid var(--border-light);
        }
        
        .message-container.own .emoji-panel {
            padding-right: 0;
            padding-left: 8px;
            border-right: none;
            border-left: 1px solid var(--border-light);
        }

        .emoji-btn {
            padding: 6px;
            border-radius: 50%;
            font-size: 1.2rem;
            transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }

        .emoji-btn:hover {
            transform: scale(1.3);
            background-color: var(--bg-tertiary);
        }

        .action-buttons {
            display: flex;
            gap: 2px;
        }

        .action-btn {
          padding: 6px;
          border-radius: 50%;
          color: var(--text-secondary);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background-color 0.2s;
        }

        .action-btn:hover {
          background-color: var(--bg-tertiary);
          color: var(--text-primary);
        }
      `}</style>
    </motion.div>
  );
};

