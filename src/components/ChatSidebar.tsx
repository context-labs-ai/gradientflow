import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';
import {
    FileText,
    Link2,
    Image,
    CheckSquare,
    Users,
    ExternalLink,
    Loader2,
    Copy,
    ClipboardCheck,
    AlertCircle,
    X,
    Search,
    Sparkles,
    Settings,
    RotateCcw,
    StopCircle,
    ChevronDown,
    ChevronRight,
    Clipboard,
    User as UserIcon,
    Maximize2,
    Clock,
    MessageCircle,
    Database,
    Trash2,
    Plus,
    Pencil,
    Check,
} from 'lucide-react';
import { api } from '../api/client';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { useChat } from '../context/ChatContext';
import type { Todo } from '../types/chat';

// Types
type TabType = 'content' | 'tasks' | 'participants' | 'search';
type ContentSubTab = 'documents' | 'links' | 'media';

interface ExtractedDocument {
    id: string;
    filename: string;
    url?: string;
    timestamp: number;
    senderId: string;
    uploadedToRag?: boolean;
    documentId?: string;
    chunksCreated?: number;
    messageId: string;
}

interface ExtractedLink {
    url: string;
    domain: string;
    timestamp: number;
    senderId: string;
}

interface ExtractedMedia {
    url: string;
    timestamp: number;
    senderId: string;
}

interface ExtractedTodo {
    id: string;
    text: string;
    timestamp: number;
    senderId: string;
}

interface ChatSidebarProps {
    isOpen: boolean;
    onClose: () => void;
    onOpenSettings?: () => void;
}

// Patterns
const URL_PATTERN = /https?:\/\/[^\s<]+[^<.,:;"')\]\s]/gi;
const IMAGE_PATTERN = /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico)(\?|$)/i;
const TODO_PATTERNS = [
    /(?:^|\n)\s*[-*]\s*\[[ x]\]\s*(.+)/gi,
    /(?:TODO|FIXME|待办|任务)[：:]\s*(.+)/gi,
];

export const ChatSidebar: React.FC<ChatSidebarProps> = ({
    isOpen,
    onClose,
    onOpenSettings,
}) => {
    const { state } = useChat();
    const [activeTab, setActiveTab] = useState<TabType>('content');
    const [contentSubTab, setContentSubTab] = useState<ContentSubTab>('documents');
    const [searchQuery, setSearchQuery] = useState('');

    // Summary state
    const [summary, setSummary] = useState('');
    const [reasoning, setReasoning] = useState('');
    const [loadingSummary, setLoadingSummary] = useState(false);
    const [isStreaming, setIsStreaming] = useState(false);
    const [streamingPhase, setStreamingPhase] = useState<'idle' | 'reasoning' | 'output'>('idle');
    const [summaryError, setSummaryError] = useState<string | null>(null);
    const [summaryCopyStatus, setSummaryCopyStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [summaryLanguage, setSummaryLanguage] = useState<'zh' | 'en'>('zh');
    const [isSummaryExpanded, setIsSummaryExpanded] = useState(true);
    const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
    const abortControllerRef = useRef<AbortController | null>(null);
    const reasoningRef = useRef<HTMLDivElement>(null);

    // Tasks state - now using backend storage
    const [backendTodos, setBackendTodos] = useState<Todo[]>([]);
    const [todosLoading, setTodosLoading] = useState(false);
    const [taskCopyStatus, setTaskCopyStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [togglingTodo, setTogglingTodo] = useState<string | null>(null);
    const lastSyncedMessagesRef = useRef<string>('');
    // Create/Edit/Delete todo state
    const [newTodoText, setNewTodoText] = useState('');
    const [isCreatingTodo, setIsCreatingTodo] = useState(false);
    const [editingTodoId, setEditingTodoId] = useState<string | null>(null);
    const [editTodoText, setEditTodoText] = useState('');
    const [savingEdit, setSavingEdit] = useState(false);
    const [deletingTodoId, setDeletingTodoId] = useState<string | null>(null);
    const newTodoInputRef = useRef<HTMLInputElement>(null);

    // Document delete state
    const [deletingDocs, setDeletingDocs] = useState<Record<string, boolean>>({});
    const [deletedDocs, setDeletedDocs] = useState<Record<string, boolean>>({});

    // LLM config status
    const [llmStatus, setLlmStatus] = useState<'idle' | 'loading' | 'configured' | 'not-configured' | 'error'>('idle');

    // Check LLM status from backend
    useEffect(() => {
        const checkLLMStatus = async () => {
            if (!isOpen) return;
            setLlmStatus('loading');
            try {
                const config = await api.llm.getConfig();
                if (config.endpoint && config.hasApiKey) {
                    setLlmStatus('configured');
                } else {
                    setLlmStatus('not-configured');
                }
            } catch {
                setLlmStatus('error');
            }
        };
        checkLLMStatus();
    }, [isOpen]);

    // Fetch todos from backend when sidebar opens
    useEffect(() => {
        const fetchTodos = async () => {
            if (!isOpen) return;
            setTodosLoading(true);
            try {
                const res = await api.todos.list();
                setBackendTodos(res.todos);
            } catch (err) {
                console.error('Failed to fetch todos:', err);
            } finally {
                setTodosLoading(false);
            }
        };
        fetchTodos();
    }, [isOpen]);

    // Extract data from messages
    const { documents, links, media, extractedTodos } = useMemo(() => {
        const docs: ExtractedDocument[] = [];
        const lnks: ExtractedLink[] = [];
        const imgs: ExtractedMedia[] = [];
        const todoItems: ExtractedTodo[] = [];

        state.messages.forEach((msg) => {
            // Extract file attachments from message metadata
            const attachment = msg.metadata?.attachment as {
                filename?: string;
                size?: number;
                type?: string;
                uploadedToRag?: boolean;
                documentId?: string;
                chunksCreated?: number;
            } | undefined;

            if (attachment?.filename) {
                docs.push({
                    id: attachment.documentId || `${msg.id}-attachment`,
                    filename: attachment.filename,
                    timestamp: msg.timestamp,
                    senderId: msg.senderId,
                    uploadedToRag: attachment.uploadedToRag,
                    documentId: attachment.documentId,
                    chunksCreated: attachment.chunksCreated,
                    messageId: msg.id,
                });
            }

            // Extract URLs
            const urlMatches = msg.content.match(URL_PATTERN) || [];
            urlMatches.forEach((url) => {
                try {
                    const urlObj = new URL(url);
                    if (IMAGE_PATTERN.test(url)) {
                        imgs.push({ url, timestamp: msg.timestamp, senderId: msg.senderId });
                    } else {
                        lnks.push({
                            url,
                            domain: urlObj.hostname.replace('www.', ''),
                            timestamp: msg.timestamp,
                            senderId: msg.senderId,
                        });
                    }
                } catch { /* ignore invalid URLs */ }
            });

            // Extract TODOs
            TODO_PATTERNS.forEach((pattern) => {
                let match;
                const content = msg.content;
                pattern.lastIndex = 0;
                while ((match = pattern.exec(content)) !== null) {
                    todoItems.push({
                        id: `${msg.id}-${match.index}`,
                        text: match[1].trim(),
                        timestamp: msg.timestamp,
                        senderId: msg.senderId,
                    });
                }
            });
        });

        return {
            documents: docs.sort((a, b) => b.timestamp - a.timestamp),
            links: lnks.sort((a, b) => b.timestamp - a.timestamp),
            media: imgs.sort((a, b) => b.timestamp - a.timestamp),
            extractedTodos: todoItems.sort((a, b) => b.timestamp - a.timestamp),
        };
    }, [state.messages]);

    // Sync extracted todos to backend when messages change
    useEffect(() => {
        if (!isOpen || extractedTodos.length === 0) return;

        // Create a hash of current extracted todos to detect changes
        const currentHash = extractedTodos.map(t => `${t.id}:${t.text}`).join('|');
        if (currentHash === lastSyncedMessagesRef.current) return;

        const syncTodos = async () => {
            try {
                // Convert extracted todos to sync format (need sourceMessageId from the id)
                const todosToSync = extractedTodos.map(t => ({
                    text: t.text,
                    sourceMessageId: t.id.split('-')[0], // Extract message ID from "msgId-index"
                    senderId: t.senderId,
                    timestamp: t.timestamp,
                }));

                const res = await api.todos.sync(todosToSync);
                setBackendTodos(res.todos);
                lastSyncedMessagesRef.current = currentHash;
            } catch (err) {
                console.error('Failed to sync todos:', err);
            }
        };

        syncTodos();
    }, [isOpen, extractedTodos]);

    // Group todos by sender (using backend todos)
    const groupedTodos = useMemo(() => {
        const groups: Map<string, { sender: typeof state.users[0] | undefined; todos: Todo[]; lastActive: number }> = new Map();
        backendTodos.forEach((todo) => {
            const sender = state.users.find((u) => u.id === todo.senderId);
            const key = todo.senderId;
            if (!groups.has(key)) {
                groups.set(key, { sender, todos: [], lastActive: todo.createdAt });
            }
            const group = groups.get(key)!;
            group.todos.push(todo);
            group.lastActive = Math.max(group.lastActive, todo.createdAt);
        });
        return Array.from(groups.values()).sort((a, b) => b.lastActive - a.lastActive);
    }, [backendTodos, state.users]);

    const pendingTaskCount = useMemo(() => {
        return backendTodos.filter((t) => !t.completed).length;
    }, [backendTodos]);

    // Participants
    const participants = useMemo(() => {
        const senderMap = new Map<string, { count: number; lastActive: number }>();
        state.messages.forEach((msg) => {
            const existing = senderMap.get(msg.senderId);
            if (existing) {
                existing.count++;
                existing.lastActive = Math.max(existing.lastActive, msg.timestamp);
            } else {
                senderMap.set(msg.senderId, { count: 1, lastActive: msg.timestamp });
            }
        });

        return state.users
            .filter((user) => senderMap.has(user.id))
            .map((user) => ({
                user,
                messageCount: senderMap.get(user.id)?.count || 0,
                lastActive: senderMap.get(user.id)?.lastActive || 0,
            }))
            .sort((a, b) => b.messageCount - a.messageCount);
    }, [state.messages, state.users]);

    // Search results
    const searchResults = useMemo(() => {
        if (!searchQuery.trim()) return [];
        const query = searchQuery.toLowerCase();
        return state.messages
            .filter((msg) => msg.content.toLowerCase().includes(query))
            .sort((a, b) => b.timestamp - a.timestamp);
    }, [state.messages, searchQuery]);

    // Helpers
    const formatTime = (timestamp: number) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays === 0) {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else if (diffDays === 1) {
            return '昨天';
        } else if (diffDays < 7) {
            return date.toLocaleDateString([], { weekday: 'short' });
        } else {
            return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
        }
    };

    const toggleTaskCompletion = async (todoId: string) => {
        const todo = backendTodos.find(t => t.id === todoId);
        if (!todo || togglingTodo === todoId) return;

        setTogglingTodo(todoId);
        try {
            const res = await api.todos.update(todoId, { completed: !todo.completed });
            setBackendTodos(prev => prev.map(t => t.id === todoId ? res.todo : t));
        } catch (err) {
            console.error('Failed to toggle todo:', err);
            toast.error('更新失败');
        } finally {
            setTogglingTodo(null);
        }
    };

    const copyTasksToClipboard = async () => {
        const pendingTasks = backendTodos.filter((t) => !t.completed);
        const text = pendingTasks.map((t) => `- [ ] ${t.text}`).join('\n');
        try {
            await navigator.clipboard.writeText(text);
            setTaskCopyStatus('success');
            setTimeout(() => setTaskCopyStatus('idle'), 2000);
        } catch {
            setTaskCopyStatus('error');
            setTimeout(() => setTaskCopyStatus('idle'), 2000);
        }
    };

    const handleCreateTodo = async () => {
        const text = newTodoText.trim();
        if (!text || isCreatingTodo) return;

        setIsCreatingTodo(true);
        try {
            const res = await api.todos.create({ text });
            setBackendTodos(prev => [res.todo, ...prev]);
            setNewTodoText('');
            toast.success('待办已添加');
        } catch (err) {
            console.error('Failed to create todo:', err);
            toast.error('添加失败');
        } finally {
            setIsCreatingTodo(false);
        }
    };

    const handleStartEdit = (todo: Todo) => {
        setEditingTodoId(todo.id);
        setEditTodoText(todo.text);
    };

    const handleCancelEdit = () => {
        setEditingTodoId(null);
        setEditTodoText('');
    };

    const handleSaveEdit = async () => {
        if (!editingTodoId || savingEdit) return;
        const text = editTodoText.trim();
        if (!text) {
            toast.error('待办内容不能为空');
            return;
        }

        setSavingEdit(true);
        try {
            const res = await api.todos.update(editingTodoId, { text });
            setBackendTodos(prev => prev.map(t => t.id === editingTodoId ? res.todo : t));
            setEditingTodoId(null);
            setEditTodoText('');
            toast.success('待办已更新');
        } catch (err) {
            console.error('Failed to update todo:', err);
            toast.error('更新失败');
        } finally {
            setSavingEdit(false);
        }
    };

    const handleDeleteTodo = async (todoId: string) => {
        if (deletingTodoId === todoId) return;

        setDeletingTodoId(todoId);
        try {
            await api.todos.delete(todoId);
            setBackendTodos(prev => prev.filter(t => t.id !== todoId));
            toast.success('待办已删除');
        } catch (err) {
            console.error('Failed to delete todo:', err);
            toast.error('删除失败');
        } finally {
            setDeletingTodoId(null);
        }
    };

    const handleDeleteDocument = async (doc: ExtractedDocument) => {
        if (!doc.documentId || deletingDocs[doc.id]) return;

        setDeletingDocs((prev) => ({ ...prev, [doc.id]: true }));
        try {
            await api.knowledgeBase.delete(doc.documentId);
            setDeletedDocs((prev) => ({ ...prev, [doc.id]: true }));
            toast.success(`已从知识库删除: ${doc.filename}`);
        } catch (err) {
            console.error('Failed to delete document:', err);
            toast.error('删除失败');
        } finally {
            setDeletingDocs((prev) => ({ ...prev, [doc.id]: false }));
        }
    };

    const copySummaryToClipboard = async () => {
        try {
            await navigator.clipboard.writeText(summary);
            setSummaryCopyStatus('success');
            setTimeout(() => setSummaryCopyStatus('idle'), 2000);
        } catch {
            setSummaryCopyStatus('error');
            setTimeout(() => setSummaryCopyStatus('idle'), 2000);
        }
    };

    const generateSummary = async () => {
        // Check if LLM is configured
        if (llmStatus !== 'configured') {
            setSummaryError('请先配置 LLM API（点击上方"前往设置"）');
            return;
        }

        // Prepare messages for summarization
        const messageTexts = state.messages.slice(-50).map((msg) => {
            const sender = state.users.find((u) => u.id === msg.senderId);
            return `[${sender?.name || '未知'}]: ${msg.content}`;
        });

        if (messageTexts.length === 0) {
            setSummaryError('没有可总结的消息');
            return;
        }

        setLoadingSummary(true);
        setSummaryError(null);
        setSummary('');
        setReasoning('');
        setIsStreaming(true);
        setStreamingPhase('idle'); // Start idle, will switch based on channel

        // Create abort controller
        abortControllerRef.current = new AbortController();

        const API_BASE = import.meta.env.VITE_API_URL ?? (import.meta.env.PROD ? '' : 'http://localhost:4000');

        try {
            const response = await fetch(`${API_BASE}/messages/summarize`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: messageTexts,
                    language: summaryLanguage,
                }),
                signal: abortControllerRef.current.signal,
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `请求失败: ${response.status}`);
            }

            // Process SSE stream
            const reader = response.body?.getReader();
            if (!reader) {
                throw new Error('无法读取响应流');
            }

            const decoder = new TextDecoder();
            let buffer = '';
            let reasoningContent = '';
            let finalContent = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });

                // Process complete SSE lines
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6).trim();
                        if (data === '[DONE]') continue;

                        try {
                            const parsed = JSON.parse(data);
                            if (parsed.error) {
                                throw new Error(parsed.details || parsed.error);
                            }

                            // Handle channel switch events
                            if (parsed.type === 'channel_switch') {
                                if (parsed.content === 'analysis') {
                                    // Entering reasoning/analysis phase
                                    setStreamingPhase('reasoning');
                                    reasoningContent = '';
                                    setReasoning('');
                                } else if (parsed.content === 'final') {
                                    // Entering final output phase - clear reasoning
                                    setStreamingPhase('output');
                                    setReasoning(''); // Clear reasoning display
                                    finalContent = '';
                                    setSummary('');
                                }
                            }
                            // Handle reasoning content
                            else if (parsed.type === 'reasoning' && parsed.content) {
                                reasoningContent += parsed.content;
                                setReasoning(reasoningContent);
                            }
                            // Handle final output content
                            else if (parsed.type === 'final' && parsed.content) {
                                finalContent += parsed.content;
                                setSummary(finalContent);
                            }
                            // Handle legacy chunk format (for non-harmony models)
                            else if (parsed.type === 'chunk' && parsed.content) {
                                // Skip if content contains harmony tokens - wait for proper channel parsing
                                if (/<\|/.test(parsed.content) || /<\|/.test(finalContent)) {
                                    continue;
                                }
                                // If we haven't detected any channel, show as output directly
                                finalContent += parsed.content;
                                setSummary(finalContent);
                                setStreamingPhase('output');
                            }
                        } catch (e) {
                            if (e instanceof Error && e.message !== 'Unexpected end of JSON input') {
                                console.warn('SSE parse error:', e);
                            }
                        }
                    }
                }
            }

            if (!finalContent && !reasoningContent) {
                setSummaryError('未收到总结内容');
            }
        } catch (err) {
            if (err instanceof Error && err.name === 'AbortError') {
                // User cancelled
                return;
            }
            console.error('Summary generation failed:', err);
            setSummaryError(err instanceof Error ? err.message : '生成总结失败');
        } finally {
            setLoadingSummary(false);
            setIsStreaming(false);
            setStreamingPhase('idle');
            abortControllerRef.current = null;
        }
    };

    const stopStreaming = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        setIsStreaming(false);
        setLoadingSummary(false);
        setStreamingPhase('idle');
    };

    // Animation variants
    const listItemVariants = {
        hidden: { opacity: 0, y: 10 },
        visible: (i: number) => ({
            opacity: 1,
            y: 0,
            transition: { delay: i * 0.05, duration: 0.2 },
        }),
    };

    // Render tabs
    const renderContentTab = () => (
        <div className="sidebar-section">
            <div className="content-subtabs">
                <button
                    className={clsx('subtab', contentSubTab === 'documents' && 'active')}
                    onClick={() => setContentSubTab('documents')}
                >
                    <FileText size={14} />
                    <span>文件</span>
                    <span className="count">{documents.length}</span>
                </button>
                <button
                    className={clsx('subtab', contentSubTab === 'links' && 'active')}
                    onClick={() => setContentSubTab('links')}
                >
                    <Link2 size={14} />
                    <span>链接</span>
                    <span className="count">{links.length}</span>
                </button>
                <button
                    className={clsx('subtab', contentSubTab === 'media' && 'active')}
                    onClick={() => setContentSubTab('media')}
                >
                    <Image size={14} />
                    <span>媒体</span>
                    <span className="count">{media.length}</span>
                </button>
            </div>

            <div className="content-list">
                <AnimatePresence mode="wait">
                    {contentSubTab === 'documents' && (
                        documents.length === 0 ? (
                            <motion.div
                                key="empty-docs"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="empty-state spacious"
                            >
                                <div className="empty-illustration">
                                    <FileText size={20} />
                                </div>
                                <div className="empty-title">暂无文件</div>
                                <div className="empty-hint">分享的文件会出现在这里</div>
                            </motion.div>
                        ) : (
                            documents.map((doc, i) => {
                                const sender = state.users.find((u) => u.id === doc.senderId);
                                const isDeleted = deletedDocs[doc.id];
                                const isDeleting = deletingDocs[doc.id];
                                return (
                                    <motion.div
                                        key={doc.id}
                                        custom={i}
                                        variants={listItemVariants}
                                        initial="hidden"
                                        animate="visible"
                                        className="content-item document-item"
                                    >
                                        <div className="content-icon doc">
                                            <FileText size={16} />
                                        </div>
                                        <div className="content-info">
                                            <div className="content-title">{doc.filename}</div>
                                            <div className="content-meta">
                                                <span>{sender?.name || '未知'}</span>
                                                <span className="dot">·</span>
                                                <span>{formatTime(doc.timestamp)}</span>
                                                {doc.uploadedToRag && !isDeleted && (
                                                    <span className="rag-badge" title={`${doc.chunksCreated || 0} 个文本块`}>
                                                        <Database size={10} />
                                                        <span>知识库</span>
                                                    </span>
                                                )}
                                                {isDeleted && (
                                                    <span className="rag-deleted-badge">已移除</span>
                                                )}
                                            </div>
                                        </div>
                                        {doc.uploadedToRag && doc.documentId && !isDeleted && (
                                            <button
                                                className="doc-delete-btn"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDeleteDocument(doc);
                                                }}
                                                disabled={isDeleting}
                                                title="从知识库中删除"
                                            >
                                                {isDeleting ? <Loader2 size={14} className="spin" /> : <Trash2 size={14} />}
                                            </button>
                                        )}
                                    </motion.div>
                                );
                            })
                        )
                    )}

                    {contentSubTab === 'links' && (
                        links.length === 0 ? (
                            <motion.div
                                key="empty-links"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="empty-state spacious"
                            >
                                <div className="empty-illustration">
                                    <Link2 size={20} />
                                </div>
                                <div className="empty-title">暂无链接</div>
                                <div className="empty-hint">分享的链接会出现在这里</div>
                            </motion.div>
                        ) : (
                            links.map((link, i) => {
                                const sender = state.users.find((u) => u.id === link.senderId);
                                return (
                                    <motion.a
                                        key={`${link.url}-${i}`}
                                        custom={i}
                                        variants={listItemVariants}
                                        initial="hidden"
                                        animate="visible"
                                        href={link.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="content-item link-item"
                                    >
                                        <div className="content-icon link">
                                            <Link2 size={16} />
                                        </div>
                                        <div className="content-info">
                                            <div className="content-title">
                                                {link.domain}
                                                <ExternalLink size={12} className="external-icon" />
                                            </div>
                                            <div className="content-meta">
                                                <span>{sender?.name || '未知'}</span>
                                                <span className="dot">·</span>
                                                <span>{formatTime(link.timestamp)}</span>
                                            </div>
                                        </div>
                                    </motion.a>
                                );
                            })
                        )
                    )}

                    {contentSubTab === 'media' && (
                        media.length === 0 ? (
                            <motion.div
                                key="empty-media"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="empty-state spacious"
                            >
                                <div className="empty-illustration">
                                    <Image size={20} />
                                </div>
                                <div className="empty-title">暂无媒体</div>
                                <div className="empty-hint">分享的图片会出现在这里</div>
                            </motion.div>
                        ) : (
                            <div className="media-grid">
                                {media.map((img, i) => (
                                    <motion.a
                                        key={`${img.url}-${i}`}
                                        custom={i}
                                        variants={listItemVariants}
                                        initial="hidden"
                                        animate="visible"
                                        href={img.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="media-item"
                                    >
                                        <img src={img.url} alt="" loading="lazy" />
                                    </motion.a>
                                ))}
                            </div>
                        )
                    )}
                </AnimatePresence>
            </div>
        </div>
    );

    const renderTasksTab = () => (
        <div className="sidebar-section">
            {/* LLM Config CTA */}
            <div className="tasks-section">
                <div className="section-header">
                    <Settings size={16} />
                    <span>AI 设置</span>
                    {llmStatus === 'loading' && <span className="status-pill neutral">检测中</span>}
                    {llmStatus === 'configured' && <span className="status-pill success">已配置</span>}
                    {llmStatus === 'not-configured' && <span className="status-pill warning">未配置</span>}
                    {llmStatus === 'error' && <span className="status-pill error">加载失败</span>}
                </div>
                <div className="llm-cta">
                    <div className="llm-cta-header-row">
                        <span className="llm-cta-title-cn">配置模型和 API Key</span>
                    </div>
                    <button
                        className="generate-btn compact-btn"
                        onClick={() => {
                            if (onOpenSettings) onOpenSettings();
                            onClose();
                        }}
                    >
                        <Settings size={14} />
                        <span>前往设置</span>
                    </button>
                </div>
            </div>

            {/* AI Summary Section */}
            <div className="tasks-section">
                <div
                    className="section-header"
                    style={{ cursor: 'pointer' }}
                    onClick={() => setIsSummaryExpanded(!isSummaryExpanded)}
                >
                    <button className="icon-btn-small" style={{ padding: 0, marginRight: 4 }}>
                        {isSummaryExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </button>
                    <Sparkles size={16} />
                    <span>AI 总结</span>
                    {summary && (
                        <button
                            className="icon-btn-small"
                            style={{ marginLeft: 'auto' }}
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsSummaryModalOpen(true);
                            }}
                            title="全屏查看"
                        >
                            <Maximize2 size={14} />
                        </button>
                    )}
                </div>

                <AnimatePresence>
                    {isSummaryExpanded && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            style={{ overflow: 'hidden' }}
                        >
                            <div className="summary-container">
                                <div className="language-toggle">
                                    <button
                                        className={clsx('lang-btn', summaryLanguage === 'zh' && 'active')}
                                        onClick={() => setSummaryLanguage('zh')}
                                    >
                                        中文
                                    </button>
                                    <button
                                        className={clsx('lang-btn', summaryLanguage === 'en' && 'active')}
                                        onClick={() => setSummaryLanguage('en')}
                                    >
                                        English
                                    </button>
                                </div>

                                {isStreaming ? (
                                    <button className="generate-btn stop-btn" onClick={stopStreaming}>
                                        <StopCircle size={14} />
                                        <span>停止生成</span>
                                    </button>
                                ) : (
                                    <button className="generate-btn" onClick={generateSummary} disabled={loadingSummary}>
                                        {loadingSummary ? (
                                            <>
                                                <Loader2 size={14} className="spin" />
                                                <span>生成中...</span>
                                            </>
                                        ) : (
                                            <>
                                                {summary ? <RotateCcw size={14} /> : <Sparkles size={14} />}
                                                <span>{summary ? '重新生成' : '生成总结'}</span>
                                            </>
                                        )}
                                    </button>
                                )}

                                {(isStreaming || reasoning) && streamingPhase === 'reasoning' && (
                                    <div className="reasoning-section" ref={reasoningRef}>
                                        <div className="reasoning-header">
                                            <Clock size={12} />
                                            <span>思考中...</span>
                                        </div>
                                        <div className="reasoning-content">
                                            {reasoning || '正在分析聊天内容...'}
                                        </div>
                                    </div>
                                )}

                                {summaryError && (
                                    <div className="summary-error">
                                        <AlertCircle size={14} />
                                        <span>{summaryError}</span>
                                    </div>
                                )}

                                {summary && (
                                    <div className="summary-output">
                                        <div className="summary-header">
                                            <span>总结</span>
                                            <button
                                                className="icon-btn-small"
                                                onClick={copySummaryToClipboard}
                                                title="复制总结"
                                            >
                                                {summaryCopyStatus === 'success' ? (
                                                    <ClipboardCheck size={14} />
                                                ) : (
                                                    <Copy size={14} />
                                                )}
                                            </button>
                                        </div>
                                        <div className="summary-text">
                                            <ReactMarkdown remarkPlugins={[remarkBreaks]}>
                                                {summary}
                                            </ReactMarkdown>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Tasks Section */}
            <div className="tasks-section">
                <div className="section-header">
                    <CheckSquare size={16} />
                    <span>待办事项</span>
                    {pendingTaskCount > 0 && (
                        <span className="task-count">{pendingTaskCount}</span>
                    )}
                    <button
                        className="icon-btn-small"
                        style={{ marginLeft: 'auto' }}
                        onClick={copyTasksToClipboard}
                        title="复制任务列表"
                    >
                        {taskCopyStatus === 'success' ? (
                            <ClipboardCheck size={14} />
                        ) : taskCopyStatus === 'error' ? (
                            <AlertCircle size={14} />
                        ) : (
                            <Clipboard size={14} />
                        )}
                    </button>
                </div>

                {/* Add new todo input */}
                <div className="todo-add-form">
                    <input
                        ref={newTodoInputRef}
                        type="text"
                        className="todo-add-input"
                        placeholder="添加新待办..."
                        value={newTodoText}
                        onChange={(e) => setNewTodoText(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleCreateTodo();
                            }
                        }}
                        disabled={isCreatingTodo}
                    />
                    <button
                        className="todo-add-btn"
                        onClick={handleCreateTodo}
                        disabled={!newTodoText.trim() || isCreatingTodo}
                        title="添加待办"
                    >
                        {isCreatingTodo ? <Loader2 size={16} className="spin" /> : <Plus size={16} />}
                    </button>
                </div>

                {todosLoading ? (
                    <div className="empty-state">
                        <Loader2 size={20} className="spin" />
                        <div className="empty-title">加载中...</div>
                    </div>
                ) : backendTodos.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-illustration">
                            <CheckSquare size={20} />
                        </div>
                        <div className="empty-title">暂无待办事项</div>
                        <div className="empty-hint">在上方输入框添加，或在聊天中提及任务</div>
                    </div>
                ) : (
                    <div className="tasks-list">
                        {groupedTodos.map((group, gIdx) => (
                            <motion.div
                                key={group.sender?.id || gIdx}
                                custom={gIdx}
                                variants={listItemVariants}
                                initial="hidden"
                                animate="visible"
                                className="task-group"
                            >
                                <div className="task-group-header">
                                    <div className="task-group-avatar">
                                        {group.sender?.name?.[0]?.toUpperCase() || '?'}
                                    </div>
                                    <span className="task-group-name">{group.sender?.name || '未知用户'}</span>
                                </div>
                                {group.todos.map((todo) => (
                                    <div
                                        key={todo.id}
                                        className={clsx(
                                            'task-item',
                                            todo.completed && 'completed',
                                            togglingTodo === todo.id && 'toggling',
                                            editingTodoId === todo.id && 'editing'
                                        )}
                                    >
                                        {editingTodoId === todo.id ? (
                                            /* Edit mode */
                                            <div className="task-edit-form">
                                                <input
                                                    type="text"
                                                    className="task-edit-input"
                                                    value={editTodoText}
                                                    onChange={(e) => setEditTodoText(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault();
                                                            handleSaveEdit();
                                                        } else if (e.key === 'Escape') {
                                                            handleCancelEdit();
                                                        }
                                                    }}
                                                    autoFocus
                                                    disabled={savingEdit}
                                                />
                                                <div className="task-edit-actions">
                                                    <button
                                                        className="task-action-btn save"
                                                        onClick={handleSaveEdit}
                                                        disabled={savingEdit}
                                                        title="保存"
                                                    >
                                                        {savingEdit ? <Loader2 size={14} className="spin" /> : <Check size={14} />}
                                                    </button>
                                                    <button
                                                        className="task-action-btn cancel"
                                                        onClick={handleCancelEdit}
                                                        disabled={savingEdit}
                                                        title="取消"
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            /* Normal mode */
                                            <>
                                                <div
                                                    className={clsx('task-checkbox', todo.completed && 'checked')}
                                                    onClick={() => toggleTaskCompletion(todo.id)}
                                                >
                                                    {togglingTodo === todo.id ? (
                                                        <Loader2 size={14} className="spin" />
                                                    ) : todo.completed ? (
                                                        <CheckSquare size={14} />
                                                    ) : null}
                                                </div>
                                                <div className="task-content" onClick={() => toggleTaskCompletion(todo.id)}>
                                                    <div className="task-text">{todo.text}</div>
                                                    <div className="task-meta">{formatTime(todo.createdAt)}</div>
                                                </div>
                                                <div className="task-actions">
                                                    <button
                                                        className="task-action-btn edit"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleStartEdit(todo);
                                                        }}
                                                        title="编辑"
                                                    >
                                                        <Pencil size={12} />
                                                    </button>
                                                    <button
                                                        className="task-action-btn delete"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDeleteTodo(todo.id);
                                                        }}
                                                        disabled={deletingTodoId === todo.id}
                                                        title="删除"
                                                    >
                                                        {deletingTodoId === todo.id ? (
                                                            <Loader2 size={12} className="spin" />
                                                        ) : (
                                                            <Trash2 size={12} />
                                                        )}
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                ))}
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );

    const renderSearchTab = () => (
        <div className="sidebar-section">
            <div className="search-container">
                <div className="search-input-wrapper">
                    <Search size={16} className="search-icon" />
                    <input
                        type="text"
                        className="search-input"
                        placeholder="搜索消息..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && (
                        <button
                            className="search-clear-btn"
                            onClick={() => setSearchQuery('')}
                        >
                            <X size={14} />
                        </button>
                    )}
                </div>
            </div>
            <div className="search-results-list">
                <AnimatePresence mode="wait">
                    {searchResults.length === 0 ? (
                        <motion.div
                            key="empty-search"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="empty-state"
                        >
                            <div className="empty-illustration">
                                <Search size={20} />
                            </div>
                            <div className="empty-title">
                                {searchQuery ? '未找到相关消息' : '搜索聊天记录'}
                            </div>
                            <div className="empty-hint">
                                {searchQuery ? '换个关键词试试' : '输入关键词开始搜索'}
                            </div>
                        </motion.div>
                    ) : (
                        searchResults.map((msg, i) => {
                            const sender = state.users.find((u) => u.id === msg.senderId);
                            return (
                                <motion.div
                                    key={msg.id}
                                    custom={i}
                                    variants={listItemVariants}
                                    initial="hidden"
                                    animate="visible"
                                    className="search-result-item"
                                    onClick={() => {
                                        const element = document.getElementById(`message-${msg.id}`);
                                        if (element) {
                                            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                            element.classList.add('highlight-message');
                                            setTimeout(() => element.classList.remove('highlight-message'), 2000);
                                        }
                                    }}
                                >
                                    <div className="result-header">
                                        <div className="result-user">
                                            <div
                                                className="user-avatar-tiny"
                                                style={{ backgroundColor: sender?.type === 'agent' ? 'var(--accent-secondary)' : 'var(--accent-primary)' }}
                                            >
                                                {sender?.name?.[0]?.toUpperCase() || '?'}
                                            </div>
                                            <span className="result-name">{sender?.name || '未知用户'}</span>
                                        </div>
                                        <span className="result-time">{formatTime(msg.timestamp)}</span>
                                    </div>
                                    <div className="result-content">
                                        {msg.content.length > 150 ? msg.content.slice(0, 150) + '...' : msg.content}
                                    </div>
                                </motion.div>
                            );
                        })
                    )}
                </AnimatePresence>
            </div>
        </div>
    );

    const renderParticipantsTab = () => (
        <div className="sidebar-section">
            <div className="section-header">
                <Users size={16} />
                <span>成员</span>
                <span className="count">{participants.length}</span>
            </div>
            <div className="participants-list">
                <AnimatePresence>
                    {participants.map(({ user, messageCount, lastActive }, i) => (
                        <motion.div
                            key={user.id}
                            custom={i}
                            variants={listItemVariants}
                            initial="hidden"
                            animate="visible"
                            className="participant-item"
                        >
                            <div className="participant-avatar">
                                {user.avatar ? (
                                    <img src={user.avatar} alt={user.name} />
                                ) : (
                                    <UserIcon size={18} />
                                )}
                                <span
                                    className={clsx(
                                        'status-dot',
                                        user.status === 'online' && 'online',
                                        user.status === 'busy' && 'busy'
                                    )}
                                />
                            </div>
                            <div className="participant-info">
                                <div className="participant-name">
                                    {user.name}
                                    <span className={clsx('role-badge', user.type === 'agent' ? 'agent' : 'human')}>
                                        {user.type === 'agent' ? '机器人' : '成员'}
                                    </span>
                                </div>
                                <div className="participant-meta">
                                    {messageCount} 条消息
                                    {lastActive > 0 && ` · ${formatTime(lastActive)}`}
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
        </div>
    );

    return (
        <>
            {/* Backdrop */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        className="sidebar-backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                    />
                )}
            </AnimatePresence>

            {/* Sidebar */}
            <div className={clsx('chat-sidebar', isOpen && 'open')}>
                <div className="sidebar-header">
                    <div className="sidebar-header-icon">
                        <MessageCircle size={20} />
                    </div>
                    <div className="sidebar-header-content">
                        <h3>聊天信息</h3>
                        <div className="sidebar-header-subtitle">
                            <span className="online-dot" />
                            <span>{participants.length} 位成员 · {state.messages.length} 条消息</span>
                        </div>
                    </div>
                    <button className="close-btn" onClick={onClose}>
                        <X size={18} />
                    </button>
                </div>

                <div className="sidebar-tabs">
                    <button
                        className={clsx('tab', activeTab === 'content' && 'active')}
                        onClick={() => setActiveTab('content')}
                    >
                        <FileText size={16} />
                        <span>内容</span>
                    </button>
                    <button
                        className={clsx('tab', activeTab === 'search' && 'active')}
                        onClick={() => setActiveTab('search')}
                    >
                        <Search size={16} />
                        <span>搜索</span>
                    </button>
                    <button
                        className={clsx('tab', activeTab === 'tasks' && 'active')}
                        onClick={() => setActiveTab('tasks')}
                    >
                        <CheckSquare size={16} />
                        <span>任务</span>
                    </button>
                    <button
                        className={clsx('tab', activeTab === 'participants' && 'active')}
                        onClick={() => setActiveTab('participants')}
                    >
                        <Users size={16} />
                        <span>成员</span>
                    </button>
                </div>

                <div className="sidebar-content">
                    {activeTab === 'content' && renderContentTab()}
                    {activeTab === 'search' && renderSearchTab()}
                    {activeTab === 'tasks' && renderTasksTab()}
                    {activeTab === 'participants' && renderParticipantsTab()}
                </div>
            </div>

            {/* Summary Fullscreen Modal */}
            <AnimatePresence>
                {isSummaryModalOpen && (
                    <motion.div
                        className="summary-modal-backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setIsSummaryModalOpen(false)}
                    >
                        <motion.div
                            className="summary-modal"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.2 }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="summary-modal-header">
                                <div className="summary-modal-title">
                                    <Sparkles size={18} />
                                    <span>AI 总结</span>
                                </div>
                                <div className="summary-modal-actions">
                                    <button
                                        className="icon-btn-small"
                                        onClick={copySummaryToClipboard}
                                        title="复制总结"
                                    >
                                        {summaryCopyStatus === 'success' ? (
                                            <ClipboardCheck size={16} />
                                        ) : (
                                            <Copy size={16} />
                                        )}
                                    </button>
                                    <button
                                        className="icon-btn-small"
                                        onClick={() => setIsSummaryModalOpen(false)}
                                        title="关闭"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                            </div>
                            <div className="summary-modal-content">
                                <ReactMarkdown remarkPlugins={[remarkBreaks]}>
                                    {summary}
                                </ReactMarkdown>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
};

export default ChatSidebar;
