const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000';

const request = async <T>(path: string, options: RequestInit = {}): Promise<T> => {
    const res = await fetch(`${API_BASE}${path}`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
        ...options,
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
        const error = new Error(body?.error || res.statusText || `Request failed: ${res.status}`);
        (error as any).status = res.status;
        (error as any).body = body;
        throw error;
    }
    return body as T;
};

export const api = {
    auth: {
        me: () => request<{ user: User }>('/auth/me'),
        login: (payload: { email: string; password: string }) =>
            request<{ user: User }>('/auth/login', { method: 'POST', body: JSON.stringify(payload) }),
        register: (payload: { email: string; password: string; name: string }) =>
            request<{ user: User }>('/auth/register', { method: 'POST', body: JSON.stringify(payload) }),
        logout: () => request<{ ok: boolean }>('/auth/logout', { method: 'POST' }),
    },
    messages: {
        list: (params?: { limit?: number; before?: number }) => {
            const search = new URLSearchParams();
            if (params?.limit) search.set('limit', String(params.limit));
            if (params?.before) search.set('before', String(params.before));
            const suffix = search.toString() ? `?${search.toString()}` : '';
            return request<{ messages: Message[]; users: User[] }>(`/messages${suffix}`);
        },
        create: (payload: { content: string; replyToId?: string }) =>
            request<{ message: Message; users?: User[] }>('/messages', { method: 'POST', body: JSON.stringify(payload) }),
    },
    typing: {
        set: (isTyping: boolean) => request<{ typingUsers: string[] }>('/typing', { method: 'POST', body: JSON.stringify({ isTyping }) }),
        list: () => request<{ typingUsers: string[] }>('/typing'),
    },
    users: {
        list: () => request<{ users: User[] }>('/users'),
    },
};
import { Message, User } from '../types/chat';
