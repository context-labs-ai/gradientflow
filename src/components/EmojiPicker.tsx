import React, { useRef, useEffect, lazy, Suspense } from 'react';
import { Theme, type EmojiClickData } from 'emoji-picker-react';
import { motion, AnimatePresence } from 'framer-motion';

// Lazy load the emoji picker to reduce initial bundle size
const EmojiPicker = lazy(() => import('emoji-picker-react'));

interface EmojiPickerComponentProps {
    isOpen: boolean;
    onClose: () => void;
    onEmojiSelect: (emoji: string) => void;
    anchorEl?: HTMLElement | null;
}

export const EmojiPickerComponent: React.FC<EmojiPickerComponentProps> = ({
    isOpen,
    onClose,
    onEmojiSelect,
    anchorEl,
}) => {
    const pickerRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
        if (!isOpen) return;

        const handleClickOutside = (event: MouseEvent) => {
            if (
                pickerRef.current &&
                !pickerRef.current.contains(event.target as Node) &&
                anchorEl &&
                !anchorEl.contains(event.target as Node)
            ) {
                onClose();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen, onClose, anchorEl]);

    // Close on Escape key
    useEffect(() => {
        if (!isOpen) return;

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };

        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [isOpen, onClose]);

    const handleEmojiClick = (emojiData: EmojiClickData) => {
        onEmojiSelect(emojiData.emoji);
        onClose();
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    ref={pickerRef}
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    transition={{ duration: 0.15 }}
                    className="emoji-picker-wrapper"
                >
                    <Suspense fallback={<div style={{ width: 320, height: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)' }}>Loading...</div>}>
                        <EmojiPicker
                            onEmojiClick={handleEmojiClick}
                            theme={Theme.AUTO}
                            width={320}
                            height={400}
                            searchPlaceHolder="Search emoji..."
                            previewConfig={{
                                showPreview: false,
                            }}
                        />
                    </Suspense>
                </motion.div>
            )}
        </AnimatePresence>
    );
};
