import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { API_BASE } from '../api/client';

interface SocketContextType {
    socket: Socket | null;
    isConnected: boolean;
    connectionError: string | null;
    connect: () => void;
    disconnect: () => void;
}

const SocketContext = createContext<SocketContextType>({
    socket: null,
    isConnected: false,
    connectionError: null,
    connect: () => {},
    disconnect: () => {},
});

interface SocketProviderProps {
    children: ReactNode;
}

// Helper to get JWT token from cookie
function getTokenFromCookie(): string | null {
    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
        const [name, value] = cookie.trim().split('=');
        if (name === 'token') {
            return decodeURIComponent(value);
        }
    }
    return null;
}

export function SocketProvider({ children }: SocketProviderProps) {
    const [socket, setSocket] = useState<Socket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [connectionError, setConnectionError] = useState<string | null>(null);

    const connect = useCallback(() => {
        // Don't connect if already connected
        if (socket?.connected) return;

        const token = getTokenFromCookie();
        if (!token) {
            console.log('[Socket] No auth token, skipping connection');
            return;
        }

        // Determine socket URL - in production use relative path, in dev use API_BASE
        const socketUrl = API_BASE || window.location.origin;

        console.log('[Socket] Connecting to', socketUrl);
        const socketInstance = io(socketUrl, {
            auth: {
                token,
            },
            withCredentials: true,
            transports: ['websocket', 'polling'],
            autoConnect: true,
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
        });

        socketInstance.on('connect', () => {
            console.log('[Socket] Connected');
            setIsConnected(true);
            setConnectionError(null);
            // Request sync state on connect
            socketInstance.emit('sync:request');
        });

        socketInstance.on('disconnect', (reason) => {
            console.log('[Socket] Disconnected:', reason);
            setIsConnected(false);
        });

        socketInstance.on('connect_error', (error) => {
            console.error('[Socket] Connection error:', error.message);
            setConnectionError(error.message);
            setIsConnected(false);
        });

        setSocket(socketInstance);
    }, [socket]);

    const disconnect = useCallback(() => {
        if (socket) {
            socket.disconnect();
            setSocket(null);
            setIsConnected(false);
        }
    }, [socket]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (socket) {
                socket.disconnect();
            }
        };
    }, [socket]);

    return (
        <SocketContext.Provider value={{ socket, isConnected, connectionError, connect, disconnect }}>
            {children}
        </SocketContext.Provider>
    );
}

export const useSocket = () => useContext(SocketContext);
