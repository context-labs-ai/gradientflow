import React, { useMemo, useState } from 'react';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { api } from '../api/client';
import { useChat } from '../context/ChatContext';

interface AuthScreenProps {
    onAuthenticated: () => Promise<void>;
    error?: string;
}

type TouchedFields = {
    name: boolean;
    email: boolean;
    password: boolean;
};

const INFO_HIGHLIGHTS = [
    {
        title: '多源信号联动',
        desc: '实时捕获系统、文档与 Agent 输出，自动汇聚同一上下文。',
    },
    {
        title: '事件级自动化',
        desc: '命中关键词、状态或外部 Hook 时即可调度工具链或任务流。',
    },
    {
        title: '统一记忆体',
        desc: '成员与 LLM 共享一条时间线，历史片段可回放、可引用。',
    },
] as const;

const INFO_STATS = [
    { value: '15+', label: '常驻观测 Agent' },
    { value: '30s', label: '信号整合延迟' },
    { value: '100%', label: '策略留痕覆盖' },
] as const;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const AuthScreen: React.FC<AuthScreenProps> = ({ onAuthenticated, error }) => {
    const { dispatch } = useChat();
    const [mode, setMode] = useState<'login' | 'register'>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<string | null>(error || null);
    const [messageTone, setMessageTone] = useState<'error' | 'success'>('error');
    const [showPassword, setShowPassword] = useState(false);
    const [shakeError, setShakeError] = useState(false);
    const [touched, setTouched] = useState<TouchedFields>({ name: false, email: false, password: false });

    const isRegisterMode = mode === 'register';

    const runBlockingValidation = () => {
        const emailInvalid = !EMAIL_PATTERN.test(email.trim());
        const passwordInvalid = password.trim().length < 8;
        const nameInvalid = isRegisterMode && name.trim().length < 2;
        return emailInvalid || passwordInvalid || nameInvalid;
    };

    const triggerShake = () => {
        setShakeError(true);
        setTimeout(() => setShakeError(false), 600);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setTouched({ name: true, email: true, password: true });
        setLoading(true);
        setMessage(null);
        setMessageTone('error');

        if (runBlockingValidation()) {
            setLoading(false);
            triggerShake();
            setMessage('请先修复表单中的错误提示');
            setMessageTone('error');
            dispatch({ type: 'SET_AUTH_STATUS', payload: 'unauthenticated' });
            return;
        }

        try {
            if (isRegisterMode) {
                await api.auth.register({ email: email.trim(), password, name: name.trim() || email.split('@')[0] });
                setMessageTone('success');
                setMessage('注册成功，正在自动登录…');
            } else {
                await api.auth.login({ email: email.trim(), password });
                setMessageTone('success');
                setMessage('登录成功，正在进入聊天室…');
            }
            await onAuthenticated();
        } catch (err: any) {
            triggerShake();
            const status = err?.status as number | undefined;
            const raw = (err?.message as string) || '';
            const reason = raw || (status ? `请求失败（${status}）` : '请求失败');
            let friendly: string;

            if (isRegisterMode) {
                if (status === 409) {
                    friendly = '邮箱已被注册，请直接登录或更换邮箱';
                } else if (status === 400) {
                    friendly = raw || '注册信息不完整或密码太短';
                } else {
                    friendly = `注册失败：${reason}`;
                }
            } else {
                if (status === 401) {
                    friendly = '邮箱或密码不正确';
                } else {
                    friendly = `登录失败：${reason}`;
                }
            }

            if (raw && !friendly.includes(raw) && status !== 409) {
                friendly = `${friendly}（${raw}）`;
            }

            setMessageTone('error');
            setMessage(friendly);
            dispatch({ type: 'SET_AUTH_STATUS', payload: 'unauthenticated' });
        } finally {
            setLoading(false);
        }
    };

    const handleModeChange = (next: 'login' | 'register') => {
        setMode(next);
        setTouched({ name: false, email: false, password: false });
        setMessage(null);
        setMessageTone('error');
        setShakeError(false);
    };

    const fieldErrors = useMemo(() => {
        const next = {
            name: '',
            email: '',
            password: '',
        };

        if (touched.email) {
            if (!email.trim()) {
                next.email = '邮箱不能为空';
            } else if (!EMAIL_PATTERN.test(email.trim())) {
                next.email = '请输入有效邮箱地址';
            }
        }

        if (touched.password) {
            if (!password.trim()) {
                next.password = '密码不能为空';
            } else if (password.trim().length < 8) {
                next.password = '至少 8 位字符';
            }
        }

        if (isRegisterMode && touched.name) {
            if (!name.trim()) {
                next.name = '昵称不能为空';
            } else if (name.trim().length < 2) {
                next.name = '至少输入 2 个字符';
            }
        }

        return next;
    }, [email, password, name, touched, isRegisterMode]);

    return (
        <div className="auth-screen">
            <div className="ambient ambient-one" />
            <div className="ambient ambient-two" />
            <div className="ambient ambient-three" />

            <div className="auth-grid">
                <div className="info-card">
                    <div className="pill">多模态 · 编排式协作</div>
                    <h1>
                        Active LLM Chatroom <span className="badge">Alpha</span>
                    </h1>
                    <p className="info-copy">
                        这是一个为多智能体场景设计的“常在线”协作空间：它监控上下文信号、同步策略轨迹，
                        并在需要时自动唤起工具链，让团队与 AI 安全地共享同一条时间线。
                    </p>
                    <div className="info-highlights">
                        {INFO_HIGHLIGHTS.map((item, index) => (
                            <div className="highlight" key={item.title} style={{ animationDelay: `${0.15 * (index + 1)}s` }}>
                                <span className="indicator" aria-hidden="true" />
                                <div>
                                    <div className="highlight-title">{item.title}</div>
                                    <div className="highlight-desc">{item.desc}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="info-stats">
                        {INFO_STATS.map((stat, index) => (
                            <div className="info-stat" key={stat.label} style={{ animationDelay: `${0.2 * (index + 1)}s` }}>
                                <div className="stat-value">{stat.value}</div>
                                <div className="stat-label">{stat.label}</div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="auth-card">
                    <div className="card-header">
                        <div className="pill subtle">{isRegisterMode ? '创建新成员' : '欢迎回来'}</div>
                        <h2>{isRegisterMode ? '注册并接入工作区' : '登录工作区'}</h2>
                        <p className="auth-subtitle">为每位成员绑定独立身份，所有事件都将实时推送给协作 Agent。</p>
                    </div>
                    <form onSubmit={handleSubmit} noValidate>
                        {isRegisterMode && (
                            <div className="field">
                                <label htmlFor="name">昵称</label>
                                <input
                                    id="name"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    onBlur={() => setTouched((prev) => ({ ...prev, name: true }))}
                                    placeholder="展示给其他成员的名称"
                                    autoComplete="name"
                                />
                                {fieldErrors.name && <span className="field-error">{fieldErrors.name}</span>}
                            </div>
                        )}
                        <div className="field">
                            <label htmlFor="email">邮箱</label>
                            <input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                onBlur={() => setTouched((prev) => ({ ...prev, email: true }))}
                                placeholder="you@example.com"
                                autoComplete="email"
                            />
                            {fieldErrors.email && <span className="field-error">{fieldErrors.email}</span>}
                        </div>
                        <div className="field">
                            <label htmlFor="password">密码</label>
                            <div className="input-with-action">
                                <input
                                    id="password"
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    onBlur={() => setTouched((prev) => ({ ...prev, password: true }))}
                                    minLength={8}
                                    placeholder="至少 8 位字符"
                                    autoComplete={isRegisterMode ? 'new-password' : 'current-password'}
                                />
                                <button
                                    type="button"
                                    className="toggle-password"
                                    onClick={() => setShowPassword((prev) => !prev)}
                                    aria-label={showPassword ? '隐藏密码' : '显示密码'}
                                >
                                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                            {fieldErrors.password && <span className="field-error">{fieldErrors.password}</span>}
                        </div>
                        <div
                            className={`auth-feedback ${message ? 'visible' : ''} ${shakeError ? 'shake' : ''} ${messageTone}`}
                            aria-live="polite"
                        >
                            {message || ' '}
                        </div>
                        <button type="submit" disabled={loading} className="submit-btn">
                            {loading && <Loader2 size={18} className="btn-spinner" aria-hidden="true" />}
                            <span>{isRegisterMode ? '注册' : '登录'}</span>
                        </button>
                    </form>
                    <div className="switcher">
                        {isRegisterMode ? '已经有账号？' : '还没有账号？'}
                        <button type="button" onClick={() => handleModeChange(isRegisterMode ? 'login' : 'register')}>
                            {isRegisterMode ? '去登录' : '去注册'}
                        </button>
                    </div>
                </div>
            </div>
            <style>{`
                .auth-screen {
                    position: relative;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    min-height: 100vh;
                    padding: 40px 24px;
                    background: radial-gradient(circle at 15% 20%, rgba(51, 144, 236, 0.18), transparent 52%),
                                radial-gradient(circle at 80% 10%, rgba(15, 23, 42, 0.25), transparent 45%),
                                #f5f7fb;
                    overflow: hidden;
                }
                .ambient {
                    position: absolute;
                    filter: blur(90px);
                    opacity: 0.55;
                    z-index: 1;
                    animation: ambientDrift 32s ease-in-out infinite;
                }
                .ambient-one {
                    width: 360px;
                    height: 360px;
                    top: 6%;
                    left: 2%;
                    background: linear-gradient(120deg, rgba(51, 144, 236, 0.6), rgba(34, 197, 94, 0.4));
                }
                .ambient-two {
                    width: 420px;
                    height: 420px;
                    bottom: -12%;
                    right: 0;
                    animation-delay: -8s;
                    background: linear-gradient(200deg, rgba(99, 102, 241, 0.35), rgba(14, 165, 233, 0.35));
                }
                .ambient-three {
                    width: 260px;
                    height: 260px;
                    top: 35%;
                    right: 20%;
                    animation-delay: -14s;
                    background: linear-gradient(160deg, rgba(236, 72, 153, 0.25), rgba(59, 130, 246, 0.25));
                }
                .auth-grid {
                    position: relative;
                    z-index: 2;
                    width: 100%;
                    max-width: 1100px;
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
                    gap: 28px;
                }
                .info-card {
                    background: rgba(255, 255, 255, 0.9);
                    border: 1px solid rgba(148, 163, 184, 0.25);
                    border-radius: 24px;
                    padding: 30px;
                    backdrop-filter: blur(8px);
                    box-shadow: 0 30px 80px rgba(15, 23, 42, 0.18);
                    display: flex;
                    flex-direction: column;
                    gap: 18px;
                    animation: cardFloat 18s ease-in-out infinite alternate;
                }
                .pill {
                    display: inline-flex;
                    align-items: center;
                    padding: 6px 14px;
                    border-radius: 999px;
                    font-size: 0.85rem;
                    font-weight: 600;
                    color: #0f172a;
                    background: linear-gradient(120deg, rgba(16, 185, 129, 0.2), rgba(51, 144, 236, 0.2));
                    border: 1px solid rgba(51, 144, 236, 0.25);
                }
                .pill.subtle {
                    background: rgba(51, 144, 236, 0.18);
                    border: 1px solid rgba(51, 144, 236, 0.25);
                    color: #dbeafe;
                    font-size: 0.78rem;
                }
                .info-card h1 {
                    margin: 0;
                    font-size: 2rem;
                    line-height: 1.25;
                    color: #0f172a;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                .badge {
                    padding: 4px 9px;
                    border-radius: 999px;
                    background: rgba(51, 144, 236, 0.15);
                    color: #2563eb;
                    font-size: 0.72rem;
                    font-weight: 700;
                }
                .info-copy {
                    margin: 0;
                    color: #475569;
                    font-size: 1rem;
                    line-height: 1.5;
                }
                .info-highlights {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }
                .highlight {
                    display: grid;
                    grid-template-columns: auto 1fr;
                    gap: 12px;
                    align-items: flex-start;
                    padding: 12px;
                    background: rgba(248, 250, 252, 0.95);
                    border-radius: 16px;
                    border: 1px solid rgba(226, 232, 240, 0.9);
                    opacity: 0;
                    transform: translateY(14px);
                    animation: fadeSlide 0.8s forwards ease;
                }
                .indicator {
                    width: 10px;
                    height: 10px;
                    border-radius: 50%;
                    background: linear-gradient(135deg, #22c55e, #0ea5e9);
                    box-shadow: 0 0 0 6px rgba(14, 165, 233, 0.15);
                    margin-top: 4px;
                }
                .highlight-title {
                    font-weight: 700;
                    color: #0f172a;
                    font-size: 0.95rem;
                }
                .highlight-desc {
                    color: #475569;
                    font-size: 0.88rem;
                    margin-top: 2px;
                }
                .info-stats {
                    display: grid;
                    grid-template-columns: repeat(3, minmax(0, 1fr));
                    gap: 12px;
                    padding-top: 6px;
                }
                .info-stat {
                    background: rgba(15, 23, 42, 0.04);
                    border-radius: 14px;
                    padding: 14px;
                    opacity: 0;
                    transform: translateY(18px);
                    animation: fadeSlide 0.9s forwards ease;
                }
                .stat-value {
                    font-size: 1.4rem;
                    font-weight: 700;
                    color: #0f172a;
                }
                .stat-label {
                    color: #64748b;
                    font-size: 0.85rem;
                }
                .auth-card {
                    background: #0f172a;
                    border-radius: 26px;
                    padding: 30px;
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    box-shadow: 0 35px 90px rgba(15, 23, 42, 0.45);
                    display: flex;
                    flex-direction: column;
                    gap: 20px;
                    color: #e2e8f0;
                    position: relative;
                    overflow: hidden;
                }
                .auth-card::after {
                    content: '';
                    position: absolute;
                    inset: 12px;
                    border-radius: 22px;
                    border: 1px solid rgba(148, 163, 184, 0.12);
                    pointer-events: none;
                }
                .card-header h2 {
                    margin: 8px 0 4px;
                    font-size: 1.6rem;
                    color: #fff;
                }
                .auth-subtitle {
                    margin: 0;
                    color: #cbd5e1;
                    line-height: 1.5;
                }
                form {
                    display: flex;
                    flex-direction: column;
                    gap: 18px;
                    position: relative;
                    z-index: 1;
                }
                .field {
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                }
                label {
                    font-size: 0.9rem;
                    color: #cbd5e1;
                }
                input {
                    padding: 12px 14px;
                    border-radius: 16px;
                    border: 1px solid rgba(255, 255, 255, 0.12);
                    background: rgba(15, 23, 42, 0.7);
                    color: #fff;
                    font-size: 1rem;
                    transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
                }
                input::placeholder {
                    color: rgba(226, 232, 240, 0.55);
                }
                input:focus {
                    outline: none;
                    border-color: rgba(51, 144, 236, 0.9);
                    box-shadow: 0 0 0 3px rgba(51, 144, 236, 0.25);
                    background: rgba(15, 23, 42, 0.85);
                }
                .input-with-action {
                    display: flex;
                    align-items: center;
                    position: relative;
                }
                .input-with-action input {
                    width: 100%;
                    padding-right: 44px;
                }
                .toggle-password {
                    position: absolute;
                    right: 8px;
                    top: 50%;
                    transform: translateY(-50%);
                    border: none;
                    background: transparent;
                    color: #94a3b8;
                    padding: 6px;
                    border-radius: 999px;
                    transition: background 0.2s;
                    display: inline-flex;
                }
                .toggle-password:hover {
                    background: rgba(148, 163, 184, 0.2);
                    color: #fff;
                }
                .field-error {
                    font-size: 0.8rem;
                    color: #fca5a5;
                }
                .auth-feedback {
                    min-height: 20px;
                    color: #fecdd3;
                    font-size: 0.9rem;
                    border-radius: 12px;
                    padding: 0;
                    opacity: 0;
                    transform: translateY(-6px);
                    transition: opacity 0.25s ease, transform 0.25s ease;
                }
                .auth-feedback.visible {
                    padding: 10px 12px;
                    background: rgba(248, 113, 113, 0.12);
                    border: 1px solid rgba(239, 68, 68, 0.35);
                    opacity: 1;
                    transform: translateY(0);
                }
                .auth-feedback.success {
                    background: rgba(34, 197, 94, 0.12);
                    border: 1px solid rgba(34, 197, 94, 0.35);
                    color: #bbf7d0;
                }
                .auth-feedback.shake {
                    animation: shake 0.36s both ease-in-out;
                }
                .submit-btn {
                    background: linear-gradient(120deg, #3390ec, #22c55e);
                    color: #0f172a;
                    border-radius: 16px;
                    padding: 14px;
                    font-size: 1rem;
                    font-weight: 700;
                    border: 1px solid rgba(255, 255, 255, 0.15);
                    cursor: pointer;
                    transition: transform 0.18s ease, box-shadow 0.18s ease;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: 10px;
                }
                .submit-btn:disabled {
                    opacity: 0.8;
                    cursor: not-allowed;
                }
                .submit-btn:not(:disabled):hover {
                    transform: translateY(-2px);
                    box-shadow: 0 20px 35px rgba(51, 144, 236, 0.35);
                }
                .btn-spinner {
                    animation: spin 1s linear infinite;
                }
                .switcher {
                    display: flex;
                    justify-content: center;
                    gap: 6px;
                    color: #cbd5e1;
                    font-size: 0.92rem;
                    z-index: 1;
                }
                .switcher button {
                    color: #63b3ff;
                    font-weight: 600;
                }
                @keyframes ambientDrift {
                    0% { transform: translate3d(0, 0, 0) scale(1); }
                    50% { transform: translate3d(5%, 4%, 0) scale(1.08); }
                    100% { transform: translate3d(-4%, -3%, 0) scale(1); }
                }
                @keyframes cardFloat {
                    0% { transform: translateY(0); }
                    100% { transform: translateY(-8px); }
                }
                @keyframes fadeSlide {
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    25% { transform: translateX(-6px); }
                    50% { transform: translateX(6px); }
                    75% { transform: translateX(-3px); }
                }
                @media (max-width: 768px) {
                    .auth-screen {
                        padding: 24px 16px;
                    }
                    .info-card {
                        order: 2;
                        animation: none;
                    }
                    .auth-card {
                        order: 1;
                    }
                }
                @media (prefers-reduced-motion: reduce) {
                    .ambient,
                    .info-card,
                    .highlight,
                    .info-stat,
                    .submit-btn,
                    .btn-spinner {
                        animation: none;
                        transition: none;
                    }
                }
            `}</style>
        </div>
    );
};
