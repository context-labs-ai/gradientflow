import { createContext, useContext, useMemo, ReactNode } from 'react';
import { User, Message } from '../types/chat';
import { useChat } from './ChatContext';

interface UsersLookupContextType {
    usersMap: Map<string, User>;
    getUserById: (id: string) => User | undefined;
}

const UsersLookupContext = createContext<UsersLookupContextType | undefined>(undefined);

export const UsersLookupProvider = ({ children }: { children: ReactNode }) => {
    const { state } = useChat();

    const usersMap = useMemo(() => {
        const map = new Map<string, User>();
        state.users.forEach((user) => map.set(user.id, user));
        return map;
    }, [state.users]);

    const getUserById = useMemo(() => {
        return (id: string) => usersMap.get(id);
    }, [usersMap]);

    const value = useMemo(() => ({ usersMap, getUserById }), [usersMap, getUserById]);

    return (
        <UsersLookupContext.Provider value={value}>
            {children}
        </UsersLookupContext.Provider>
    );
};

export const useUsersLookup = () => {
    const context = useContext(UsersLookupContext);
    if (!context) throw new Error('useUsersLookup must be used within a UsersLookupProvider');
    return context;
};

// Helper hook to get sender for a message - O(1) lookup
export const useMessageSender = (message: Message) => {
    const { getUserById } = useUsersLookup();
    return useMemo(() => getUserById(message.senderId), [getUserById, message.senderId]);
};
