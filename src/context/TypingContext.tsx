import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface TypingContextType {
    typingUsers: string[];
    setTypingUsers: (users: string[]) => void;
    setTyping: (userId: string, isTyping: boolean) => void;
}

const TypingContext = createContext<TypingContextType | undefined>(undefined);

export const TypingProvider = ({ children }: { children: ReactNode }) => {
    const [typingUsers, setTypingUsersState] = useState<string[]>([]);

    const setTypingUsers = useCallback((users: string[]) => {
        setTypingUsersState(users);
    }, []);

    const setTyping = useCallback((userId: string, isTyping: boolean) => {
        setTypingUsersState((prev) => {
            const existing = new Set(prev);
            if (isTyping) {
                existing.add(userId);
            } else {
                existing.delete(userId);
            }
            return Array.from(existing);
        });
    }, []);

    return (
        <TypingContext.Provider value={{ typingUsers, setTypingUsers, setTyping }}>
            {children}
        </TypingContext.Provider>
    );
};

export const useTyping = () => {
    const context = useContext(TypingContext);
    if (!context) throw new Error('useTyping must be used within a TypingProvider');
    return context;
};
