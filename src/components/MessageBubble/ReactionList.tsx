import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { Reaction } from '../../types/chat';
import './styles.css';

interface ReactionListProps {
    reactions: Reaction[];
    onReact: (emoji: string) => void;
    hasReacted: (emoji: string) => boolean;
}

export const ReactionList: React.FC<ReactionListProps> = React.memo(({
    reactions,
    onReact,
    hasReacted,
}) => {
    if (reactions.length === 0) return null;

    return (
        <div className="reactions-list">
            <AnimatePresence>
                {reactions.map((reaction) => {
                    const active = hasReacted(reaction.emoji);
                    return (
                        <motion.button
                            key={reaction.emoji}
                            className={clsx('reaction-pill', active && 'active')}
                            onClick={() => onReact(reaction.emoji)}
                            initial={{ opacity: 0, y: 6, scale: 0.9 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -4, scale: 0.9 }}
                            transition={{ type: 'spring', stiffness: 320, damping: 24 }}
                            whileHover={{ y: -2, scale: 1.06 }}
                            whileTap={{ scale: 0.94 }}
                            title={`${reaction.count} reacted with ${reaction.emoji}`}
                        >
                            <span>{reaction.emoji}</span>
                            <span className="count">{reaction.count}</span>
                        </motion.button>
                    );
                })}
            </AnimatePresence>
        </div>
    );
});
