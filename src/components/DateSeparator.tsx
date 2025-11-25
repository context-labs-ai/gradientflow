import React from 'react';
import { motion } from 'framer-motion';

interface DateSeparatorProps {
    timestamp: number;
}

export const DateSeparator: React.FC<DateSeparatorProps> = ({ timestamp }) => {
    const dateLabel = getDateLabel(timestamp);

    return (
        <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="date-separator"
        >
            <div className="date-separator-line" />
            <span className="date-separator-text">{dateLabel}</span>
            <div className="date-separator-line" />
        </motion.div>
    );
};

function getDateLabel(timestamp: number): string {
    const messageDate = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Reset time to compare dates only
    const resetTime = (date: Date) => {
        date.setHours(0, 0, 0, 0);
        return date;
    };

    const messageDateOnly = resetTime(new Date(messageDate));
    const todayOnly = resetTime(new Date(today));
    const yesterdayOnly = resetTime(new Date(yesterday));

    if (messageDateOnly.getTime() === todayOnly.getTime()) {
        return 'Today';
    } else if (messageDateOnly.getTime() === yesterdayOnly.getTime()) {
        return 'Yesterday';
    } else {
        // Format as "Month Day, Year" (e.g., "Nov 24, 2024")
        const options: Intl.DateTimeFormatOptions = {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        };
        return messageDate.toLocaleDateString('en-US', options);
    }
}

/**
 * Helper function to determine if a date separator should be shown
 * between two messages
 */
export function shouldShowDateSeparator(
    currentMessage: { timestamp: number },
    previousMessage?: { timestamp: number }
): boolean {
    if (!previousMessage) return true;

    const currentDate = new Date(currentMessage.timestamp);
    const previousDate = new Date(previousMessage.timestamp);

    // Compare dates (ignoring time)
    currentDate.setHours(0, 0, 0, 0);
    previousDate.setHours(0, 0, 0, 0);

    return currentDate.getTime() !== previousDate.getTime();
}
