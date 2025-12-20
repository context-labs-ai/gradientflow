import { useEffect, useRef } from 'react';
import { useSocket } from '../context/SocketContext';
import { useChatDispatch } from '../context/ChatContext';
import { useTyping } from '../context/TypingContext';
import { Message, User } from '../types/chat';

interface MessageCreatedEvent {
    message: Message;
    users?: User[];
}

interface MessageUpdatedEvent {
    message: Message;
}

interface MessageDeletedEvent {
    messageIds: string[];
}

interface TypingUpdateEvent {
    typingUsers: string[];
}

interface AgentsLookingEvent {
    lookingAgents: Array<{
        agentId: string;
        agentName: string;
        userName: string;
        avatar: string;
    }>;
}

interface SyncStateEvent {
    typingUsers: string[];
    lookingAgents: AgentsLookingEvent['lookingAgents'];
}

export function useSocketEvents(onAgentsLooking?: (agents: AgentsLookingEvent['lookingAgents']) => void) {
    const { socket, isConnected } = useSocket();
    const dispatch = useChatDispatch();
    const { setTypingUsers } = useTyping();

    // Use refs to avoid stale closures
    const dispatchRef = useRef(dispatch);
    const setTypingUsersRef = useRef(setTypingUsers);
    const onAgentsLookingRef = useRef(onAgentsLooking);

    useEffect(() => {
        dispatchRef.current = dispatch;
    }, [dispatch]);

    useEffect(() => {
        setTypingUsersRef.current = setTypingUsers;
    }, [setTypingUsers]);

    useEffect(() => {
        onAgentsLookingRef.current = onAgentsLooking;
    }, [onAgentsLooking]);

    useEffect(() => {
        if (!socket || !isConnected) return;

        const handleMessageCreated = (data: MessageCreatedEvent) => {
            dispatchRef.current({ type: 'UPSERT_MESSAGES', payload: [data.message] });
            if (data.users?.length) {
                dispatchRef.current({ type: 'SET_USERS', payload: data.users });
            }
        };

        const handleMessageUpdated = (data: MessageUpdatedEvent) => {
            dispatchRef.current({ type: 'UPDATE_MESSAGE', payload: data.message });
        };

        const handleMessageDeleted = (data: MessageDeletedEvent) => {
            dispatchRef.current({ type: 'DELETE_MESSAGES', payload: { ids: data.messageIds } });
        };

        const handleTypingUpdate = (data: TypingUpdateEvent) => {
            setTypingUsersRef.current(data.typingUsers);
        };

        const handleAgentsLooking = (data: AgentsLookingEvent) => {
            onAgentsLookingRef.current?.(data.lookingAgents);
        };

        const handleSyncState = (data: SyncStateEvent) => {
            setTypingUsersRef.current(data.typingUsers);
            onAgentsLookingRef.current?.(data.lookingAgents);
        };

        socket.on('message:created', handleMessageCreated);
        socket.on('message:updated', handleMessageUpdated);
        socket.on('message:deleted', handleMessageDeleted);
        socket.on('typing:update', handleTypingUpdate);
        socket.on('agents:looking', handleAgentsLooking);
        socket.on('sync:state', handleSyncState);

        return () => {
            socket.off('message:created', handleMessageCreated);
            socket.off('message:updated', handleMessageUpdated);
            socket.off('message:deleted', handleMessageDeleted);
            socket.off('typing:update', handleTypingUpdate);
            socket.off('agents:looking', handleAgentsLooking);
            socket.off('sync:state', handleSyncState);
        };
    }, [socket, isConnected]);

    return { isConnected };
}
