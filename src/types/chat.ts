export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

export const DEFAULT_CONVERSATION_ID = 'global';

export interface User {
  id: string;
  name: string;
  avatar: string;
  isLLM: boolean;
  status: 'online' | 'offline' | 'busy';
  email?: string;
  createdAt?: number;
}

export interface Reaction {
  emoji: string;
  count: number;
  userIds: string[];
}

export type MessageStatus =
  | { type: 'sending' }
  | { type: 'sent'; sentAt: number }
  | { type: 'delivered'; deliveredAt: number }
  | { type: 'read'; readAt: number }
  | { type: 'failed'; error: string };

export interface MessageEditMetadata {
  content: string;
  editedAt: number;
}

export interface Message {
  id: string;
  content: string;
  senderId: string;
  timestamp: number;
  reactions: Reaction[];
  conversationId: string;
  role: MessageRole;
  metadata?: Record<string, unknown>;
  replyToId?: string; // ID of the message being replied to
  mentions?: string[]; // IDs of users mentioned
  status?: MessageStatus; // Message delivery status
  editHistory?: MessageEditMetadata[]; // Edit history
  editedAt?: number; // Timestamp of last edit
}

export interface ChatState {
  currentUser: User | null;
  users: User[];
  messages: Message[];
  typingUsers: string[]; // IDs of users currently typing
  replyingTo?: Message; // The message currently being replied to
  authStatus: 'loading' | 'authenticated' | 'unauthenticated';
}
