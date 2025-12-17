import React, { useMemo, useState } from 'react';
import { Eye, EyeOff, Loader2, ArrowRight, Cpu, Shield, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation, Trans } from 'react-i18next';
import { api } from '../api/client';
import { useChat } from '../context/ChatContext';
import { SimulatedChat } from './SimulatedChat';
import { LanguageSwitcher } from './LanguageSwitcher';

interface AuthScreenProps {
    onAuthenticated: () => Promise<void>;
    error?: string;
}

type TouchedFields = {
    name: boolean;
    email: boolean;
    password: boolean;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const FEATURE_ICONS = [Cpu, Shield, Zap];
const FEATURE_KEYS = ['memory', 'privacy', 'intent'] as const;



export const AuthScreen: React.FC<AuthScreenProps> = ({ onAuthenticated, error }) => {
    const { t } = useTranslation();
    const { dispatch } = useChat();
    const [mode, setMode] = useState<'login' | 'register'>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<string | null>(error || null);
    const [messageTone, setMessageTone] = useState<'error' | 'success'>('error');
    const [showPassword, setShowPassword] = useState(false);
    const [touched, setTouched] = useState<TouchedFields>({ name: false, email: false, password: false });

    const isRegisterMode = mode === 'register';

    const runBlockingValidation = () => {
        const emailInvalid = !EMAIL_PATTERN.test(email.trim());
        const passwordInvalid = password.trim().length < 8;
        const nameInvalid = isRegisterMode && name.trim().length < 2;
        return emailInvalid || passwordInvalid || nameInvalid;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setTouched({ name: true, email: true, password: true });
        setLoading(true);
        setMessage(null);
        setMessageTone('error');

        if (runBlockingValidation()) {
            setLoading(false);
            setMessage(t('auth.validation.fixErrors'));
            setMessageTone('error');
            dispatch({ type: 'SET_AUTH_STATUS', payload: 'unauthenticated' });
            return;
        }

        try {
            if (isRegisterMode) {
                await api.auth.register({ email: email.trim(), password, name: name.trim() || email.split('@')[0] });
                setMessageTone('success');
                setMessage(t('auth.messages.registerSuccess'));
            } else {
                await api.auth.login({ email: email.trim(), password });
                setMessageTone('success');
                setMessage(t('auth.messages.loginSuccess'));
            }
            await onAuthenticated();
        } catch (err: any) {
            const status = err?.status as number | undefined;
            const raw = (err?.message as string) || '';
            const reason = raw || (status ? `${t('auth.messages.requestFailed')} (${status})` : t('auth.messages.requestFailed'));
            let friendly: string;

            if (isRegisterMode) {
                if (status === 409) {
                    friendly = t('auth.messages.emailTaken');
                } else if (status === 400) {
                    friendly = raw || t('auth.messages.invalidRegister');
                } else {
                    friendly = t('auth.messages.registerFailed', { reason });
                }
            } else {
                if (status === 401) {
                    friendly = t('auth.messages.invalidCredentials');
                } else {
                    friendly = t('auth.messages.loginFailed', { reason });
                }
            }

            if (raw && !friendly.includes(raw) && status !== 409) {
                friendly = `${friendly} (${raw})`;
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
    };

    const fieldErrors = useMemo(() => {
        const next = {
            name: '',
            email: '',
            password: '',
        };

        if (touched.email) {
            if (!email.trim()) {
                next.email = t('auth.validation.emailRequired');
            } else if (!EMAIL_PATTERN.test(email.trim())) {
                next.email = t('auth.validation.emailInvalid');
            }
        }

        if (touched.password) {
            if (!password.trim()) {
                next.password = t('auth.validation.passwordRequired');
            } else if (password.trim().length < 8) {
                next.password = t('auth.validation.passwordMinLength');
            }
        }

        if (isRegisterMode && touched.name) {
            if (!name.trim()) {
                next.name = t('auth.validation.nicknameRequired');
            } else if (name.trim().length < 2) {
                next.name = t('auth.validation.nicknameMinLength');
            }
        }

        return next;
    }, [email, password, name, touched, isRegisterMode, t]);

    return (
        <div className="auth-screen">
            <div className="background-gradient" />
            <div className="background-orbs">
                <div className="orb orb-1" />
                <div className="orb orb-2" />
                <div className="orb orb-3" />
            </div>

            <div className="language-switcher-container">
                <LanguageSwitcher />
            </div>

            <div className="auth-container">
                {/* 1. Top Header Section */}
                <motion.div
                    className="header-section"
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                >
                    <motion.div
                        className="parallax-badge"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.6 }}
                        whileHover={{ y: -5 }}
                    >
                        <div className="parallax-content">
                            <span className="powered-by">{t('auth.poweredBy')}</span>
                            <div className="parallax-logo-wrapper">
                                <img src="/parallax.png" alt="Parallax" className="parallax-logo" />
                            </div>
                        </div>
                        <div className="parallax-glow" />
                    </motion.div>

                    <h1>
                        <Trans i18nKey="auth.headline">
                            Next-Gen <span className="text-gradient">Multi-Agent Collaboration</span> Space
                        </Trans>
                    </h1>
                    <p className="brand-desc" dangerouslySetInnerHTML={{ __html: t('auth.description') }} />
                </motion.div>

                {/* 2. Main Content: Chat + Login Side-by-Side */}
                <div className="main-content">
                    <motion.div
                        className="chat-section"
                        initial={{ opacity: 0, x: -30 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.8, delay: 0.2 }}
                    >
                        <SimulatedChat />
                    </motion.div>

                    <motion.div
                        className="auth-panel"
                        initial={{ opacity: 0, x: 30 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.8, delay: 0.4 }}
                    >
                        <div className="auth-card">
                            <div className="card-header">
                                <AnimatePresence mode="wait">
                                    <motion.h2
                                        key={isRegisterMode ? 'reg' : 'log'}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        transition={{ duration: 0.2 }}
                                    >
                                        {isRegisterMode ? t('auth.createIdentity') : t('auth.welcomeBack')}
                                    </motion.h2>
                                </AnimatePresence>
                                <p className="auth-subtitle">
                                    {isRegisterMode ? t('auth.registerSubtitle') : t('auth.loginSubtitle')}
                                </p>
                            </div>

                            <form onSubmit={handleSubmit} noValidate>
                                <AnimatePresence>
                                    {isRegisterMode && (
                                        <motion.div
                                            className="field"
                                            initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                                            animate={{ opacity: 1, height: 'auto', marginBottom: 24 }}
                                            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                                        >
                                            <label htmlFor="name">{t('auth.nickname')}</label>
                                            <input
                                                id="name"
                                                value={name}
                                                onChange={(e) => setName(e.target.value)}
                                                onBlur={() => setTouched((prev) => ({ ...prev, name: true }))}
                                                placeholder={t('auth.nicknamePlaceholder')}
                                                autoComplete="name"
                                                className={fieldErrors.name ? 'error' : ''}
                                            />
                                            {fieldErrors.name && <span className="field-error-msg">{fieldErrors.name}</span>}
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                <div className="field">
                                    <label htmlFor="email">{t('auth.email')}</label>
                                    <input
                                        id="email"
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        onBlur={() => setTouched((prev) => ({ ...prev, email: true }))}
                                        placeholder="name@company.com"
                                        autoComplete="email"
                                        className={fieldErrors.email ? 'error' : ''}
                                    />
                                    {fieldErrors.email && <span className="field-error-msg">{fieldErrors.email}</span>}
                                </div>

                                <div className="field">
                                    <label htmlFor="password">{t('auth.password')}</label>
                                    <div className="input-wrapper">
                                        <input
                                            id="password"
                                            type={showPassword ? 'text' : 'password'}
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            onBlur={() => setTouched((prev) => ({ ...prev, password: true }))}
                                            placeholder="••••••••"
                                            autoComplete={isRegisterMode ? 'new-password' : 'current-password'}
                                            className={fieldErrors.password ? 'error' : ''}
                                        />
                                        <button
                                            type="button"
                                            className="toggle-password"
                                            onClick={() => setShowPassword(!showPassword)}
                                        >
                                            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                        </button>
                                    </div>
                                    {fieldErrors.password && <span className="field-error-msg">{fieldErrors.password}</span>}
                                </div>

                                <AnimatePresence>
                                    {message && (
                                        <motion.div
                                            className={`auth-message ${messageTone}`}
                                            initial={{ opacity: 0, y: -10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -10 }}
                                        >
                                            {message}
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                <motion.button
                                    type="submit"
                                    disabled={loading}
                                    className="submit-btn"
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                >
                                    {loading ? <Loader2 className="animate-spin" size={20} /> : (
                                        <>
                                            {isRegisterMode ? t('auth.register') : t('auth.login')}
                                            {!loading && <ArrowRight size={18} className="ml-2" />}
                                        </>
                                    )}
                                </motion.button>
                            </form>

                            <div className="auth-footer">
                                {isRegisterMode ? t('auth.haveAccount') : t('auth.noAccount')}
                                <button onClick={() => handleModeChange(isRegisterMode ? 'login' : 'register')}>
                                    {isRegisterMode ? t('auth.loginNow') : t('auth.registerNow')}
                                </button>
                            </div>

                        </div>
                    </motion.div>
                </div>
            </div>

            <motion.div
                className="bottom-features"
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8, duration: 0.8 }}
            >
                <div className="features-grid">
                    {FEATURE_KEYS.map((key, index) => {
                        const Icon = FEATURE_ICONS[index];
                        return (
                            <motion.div
                                key={key}
                                className="feature-item"
                                whileHover={{ y: -5, backgroundColor: "rgba(255, 255, 255, 0.6)" }}
                            >
                                <div className="feature-icon">
                                    <Icon />
                                </div>
                                <div className="feature-content">
                                    <div className="feature-title">{t(`auth.features.${key}.title`)}</div>
                                    <div className="feature-desc">{t(`auth.features.${key}.desc`)}</div>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            </motion.div>

            <style>{`
            .auth-screen {
                height: 100vh;
                display: flex;
                flex-direction: column;
                align-items: center;
                background: #f8fafc;
                color: #0f172a;
                position: relative;
                overflow-x: hidden;
                overflow-y: auto;
                font-family: 'Inter', system-ui, -apple-system, sans-serif;
                padding: 40px 20px;
                box-sizing: border-box;
            }

            .language-switcher-container {
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 100;
            }

            /* 流动背景动画 - 淡蓝紫丝绸感 */
            .background-gradient {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                z-index: 0;
                overflow: hidden;
                pointer-events: none;
                background: linear-gradient(150deg, #e8eaf6 0%, #e3f2fd 30%, #f3e5f5 70%, #e8eaf6 100%);
            }

            .background-gradient::before {
                content: '';
                position: absolute;
                top: -30%;
                left: -30%;
                width: 160%;
                height: 160%;
                background:
                    linear-gradient(130deg,
                        transparent 0%,
                        rgba(187, 222, 251, 0.4) 20%,
                        rgba(209, 196, 233, 0.3) 40%,
                        transparent 60%),
                    linear-gradient(250deg,
                        transparent 0%,
                        rgba(179, 229, 252, 0.35) 30%,
                        rgba(225, 190, 231, 0.25) 50%,
                        transparent 70%);
                animation: silkFlow1 20s ease-in-out infinite;
                filter: blur(30px);
            }

            .background-gradient::after {
                content: '';
                position: absolute;
                top: -20%;
                left: -20%;
                width: 140%;
                height: 140%;
                background:
                    linear-gradient(170deg,
                        transparent 0%,
                        rgba(255, 255, 255, 0.5) 30%,
                        rgba(187, 222, 251, 0.3) 50%,
                        transparent 70%),
                    linear-gradient(280deg,
                        transparent 0%,
                        rgba(225, 190, 231, 0.2) 40%,
                        rgba(179, 229, 252, 0.25) 60%,
                        transparent 80%);
                animation: silkFlow2 25s ease-in-out infinite;
                filter: blur(40px);
            }

            /* 柔和光晕层 */
            .background-orbs {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                z-index: 0;
                pointer-events: none;
                overflow: hidden;
            }

            .orb {
                position: absolute;
                border-radius: 50%;
                filter: blur(80px);
            }

            .orb-1 {
                width: 800px;
                height: 800px;
                background: radial-gradient(circle, rgba(187, 222, 251, 0.4) 0%, transparent 60%);
                top: -300px;
                left: -200px;
                animation: orbFloat1 30s ease-in-out infinite;
            }

            .orb-2 {
                width: 600px;
                height: 600px;
                background: radial-gradient(circle, rgba(209, 196, 233, 0.35) 0%, transparent 60%);
                bottom: -200px;
                right: -150px;
                animation: orbFloat2 25s ease-in-out infinite;
            }

            .orb-3 {
                width: 500px;
                height: 500px;
                background: radial-gradient(circle, rgba(179, 229, 252, 0.3) 0%, transparent 60%);
                top: 40%;
                left: 60%;
                animation: orbFloat3 35s ease-in-out infinite;
            }

            @keyframes silkFlow1 {
                0%, 100% {
                    transform: translate(0%, 0%) rotate(0deg);
                }
                50% {
                    transform: translate(5%, 3%) rotate(2deg);
                }
            }

            @keyframes silkFlow2 {
                0%, 100% {
                    transform: translate(0%, 0%) rotate(0deg);
                }
                50% {
                    transform: translate(-4%, 5%) rotate(-2deg);
                }
            }

            @keyframes orbFloat1 {
                0%, 100% {
                    transform: translate(0, 0);
                }
                50% {
                    transform: translate(60px, 40px);
                }
            }

            @keyframes orbFloat2 {
                0%, 100% {
                    transform: translate(0, 0);
                }
                50% {
                    transform: translate(-50px, -40px);
                }
            }

            @keyframes orbFloat3 {
                0%, 100% {
                    transform: translate(0, 0);
                    opacity: 0.8;
                }
                50% {
                    transform: translate(-40px, 30px);
                    opacity: 0.5;
                }
            }

            .auth-container {
                position: relative;
                z-index: 1;
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 40px;
                max-width: 1200px;
                width: 100%;
                margin-bottom: 60px;
                flex-shrink: 0;
            }

            /* Header Section */
            .header-section {
                display: flex;
                flex-direction: column;
                align-items: center;
                text-align: center;
                gap: 24px;
                margin-bottom: 10px;
            }

            h1 {
                font-size: 3.5rem;
                line-height: 1.1;
                font-weight: 800;
                letter-spacing: -0.03em;
                margin: 0;
                color: #0f172a;
            }

            .text-gradient {
                background: linear-gradient(135deg, #2563eb 0%, #4f46e5 50%, #7c3aed 100%);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-size: 200% auto;
                animation: gradientMove 5s ease infinite;
            }

            .brand-desc {
                font-size: 1.1rem;
                line-height: 1.6;
                color: #475569;
                margin: 0;
                max-width: 600px;
                font-weight: 400;
            }

            /* Main Content Grid */
            .main-content {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 60px;
                width: 100%;
                align-items: stretch;
            }

            .chat-section {
                display: flex;
                justify-content: flex-end;
                height: 0;
                min-height: 100%;
            }

            .auth-panel {
                display: flex;
                justify-content: flex-start;
            }

            .chat-section .simulated-chat-card {
                height: 100%;
            }

            /* Auth Card */
            .auth-card {
                width: 100%;
                max-width: 450px;
                display: flex;
                flex-direction: column;
                box-sizing: border-box;
                background: rgba(255, 255, 255, 0.65);
                backdrop-filter: blur(40px) saturate(180%);
                -webkit-backdrop-filter: blur(40px) saturate(180%);
                border: 1px solid rgba(255, 255, 255, 0.5);
                border-radius: 28px;
                padding: 40px;
                box-shadow:
                    0 25px 50px -12px rgba(0, 0, 0, 0.1),
                    0 0 0 1px rgba(255, 255, 255, 0.3) inset;
            }

            .card-header {
                text-align: center;
                margin-bottom: 32px;
            }

            .card-header h2 {
                font-size: 1.8rem;
                font-weight: 800;
                margin: 0 0 8px;
                color: #1e293b;
                letter-spacing: -0.02em;
            }

            .auth-subtitle {
                color: #64748b;
                font-size: 0.95rem;
                margin: 0;
            }

            form {
                display: flex;
                flex-direction: column;
                gap: 20px;
            }

            .field {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }

            label {
                font-size: 0.85rem;
                font-weight: 600;
                color: #475569;
                margin-left: 4px;
            }

            input {
                box-sizing: border-box;
                background: rgba(255, 255, 255, 0.5);
                border: 1px solid rgba(203, 213, 225, 0.6);
                border-radius: 14px;
                padding: 12px 16px;
                color: #0f172a;
                font-size: 1rem;
                transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                width: 100%;
                backdrop-filter: blur(10px);
            }

            input:focus {
                outline: none;
                border-color: #3b82f6;
                background: rgba(255, 255, 255, 0.9);
                box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);
            }
            
            input:hover:not(:focus) {
                border-color: #cbd5e1;
            }

            input.error {
                border-color: #ef4444;
                background: #fef2f2;
            }

            .field-error-msg {
                font-size: 0.8rem;
                color: #ef4444;
                margin-left: 4px;
            }

            .input-wrapper {
                position: relative;
                display: flex;
                align-items: center;
            }

            .input-wrapper input {
                width: 100%;
                padding-right: 48px;
            }

            .toggle-password {
                position: absolute;
                right: 12px;
                top: 50%;
                transform: translateY(-50%);
                background: none;
                border: none;
                color: #94a3b8;
                cursor: pointer;
                padding: 6px;
                border-radius: 8px;
                transition: all 0.2s;
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10;
            }

            .toggle-password:hover {
                color: #64748b;
                background: rgba(0,0,0,0.04);
            }

            .submit-btn {
                background: linear-gradient(135deg, #2563eb, #1d4ed8);
                color: white;
                border: none;
                border-radius: 14px;
                padding: 14px;
                font-size: 1rem;
                font-weight: 600;
                cursor: pointer;
                margin-top: 8px;
                display: flex;
                justify-content: center;
                align-items: center;
                box-shadow: 0 8px 20px -4px rgba(37, 99, 235, 0.3);
            }

            .submit-btn:disabled {
                opacity: 0.7;
                cursor: not-allowed;
                box-shadow: none;
            }

            .auth-message {
                font-size: 0.85rem;
                padding: 12px;
                border-radius: 10px;
                text-align: center;
                font-weight: 500;
            }

            .auth-message.error {
                background: #fef2f2;
                color: #ef4444;
                border: 1px solid #fecaca;
            }

            .auth-message.success {
                background: #f0fdf4;
                color: #16a34a;
                border: 1px solid #bbf7d0;
            }

            .auth-footer {
                margin-top: 24px;
                text-align: center;
                font-size: 0.9rem;
                color: #64748b;
            }

            .auth-footer button {
                background: none;
                border: none;
                color: #2563eb;
                font-weight: 600;
                cursor: pointer;
                margin-left: 6px;
                transition: color 0.2s;
            }

            .auth-footer button:hover {
                color: #1d4ed8;
                text-decoration: underline;
            }

            /* Features at Bottom */
            .bottom-features {
                width: 100%;
                max-width: 1200px;
                padding: 0 20px;
                z-index: 2;
                flex-shrink: 0;
                margin-bottom: 40px;
            }

            .features-grid {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 24px;
            }

            .feature-item {
                display: flex;
                gap: 16px;
                align-items: flex-start;
                padding: 24px;
                border-radius: 24px;
                background: rgba(255, 255, 255, 0.4);
                border: 1px solid rgba(255, 255, 255, 0.4);
                backdrop-filter: blur(10px);
                transition: all 0.3s ease;
                cursor: default;
                box-shadow: 0 4px 20px rgba(0,0,0,0.02);
            }
            
            .feature-icon {
                width: 48px;
                height: 48px;
                display: flex;
                align-items: center;
                justify-content: center;
                background: linear-gradient(135deg, #eff6ff, #dbeafe);
                border: 1px solid #bfdbfe;
                border-radius: 16px;
                color: #2563eb;
                flex-shrink: 0;
                box-shadow: 0 4px 10px rgba(37, 99, 235, 0.1);
            }
            
            .feature-icon svg {
                width: 24px;
                height: 24px;
            }

            .feature-content {
                flex: 1;
                padding-top: 2px;
            }

            .feature-title {
                font-size: 1.05rem;
                font-weight: 700;
                color: #0f172a;
                margin-bottom: 6px;
            }

            .feature-desc {
                font-size: 0.9rem;
                color: #64748b;
                line-height: 1.5;
            }

            /* Parallax Badge */
            .parallax-badge {
                position: relative;
                padding: 3px;
                border-radius: 24px;
                background: linear-gradient(135deg, #f1f5f9, #fff, #f1f5f9);
                width: fit-content;
                overflow: hidden;
                box-shadow: 0 10px 25px -5px rgba(0,0,0,0.06);
                cursor: pointer;
            }

            .parallax-content {
                background: #fff;
                padding: 10px 20px;
                border-radius: 21px;
                display: flex;
                align-items: center;
                gap: 12px;
            }

            .powered-by {
                font-size: 0.7rem;
                text-transform: uppercase;
                letter-spacing: 0.15em;
                color: #94a3b8;
                font-weight: 700;
            }

            .parallax-logo-wrapper {
                display: flex;
                align-items: center;
            }

            .parallax-logo {
                height: 24px;
                width: auto;
            }
            
            .parallax-glow {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: linear-gradient(90deg, transparent, rgba(255,255,255,0.9), transparent);
                transform: skewX(-20deg) translateX(-150%);
                animation: shimmer 4s infinite;
                pointer-events: none;
            }

            @keyframes shimmer {
                0% { transform: skewX(-20deg) translateX(-150%); }
                100% { transform: skewX(-20deg) translateX(150%); }
            }
            
            @keyframes gradientMove {
                0% { background-position: 0% 50%; }
                50% { background-position: 100% 50%; }
                100% { background-position: 0% 50%; }
            }
            /* 大屏幕适配 - 1200px 以下开始调整 */
            @media (max-width: 1200px) {
                .main-content {
                    gap: 40px;
                }

                .auth-card, .simulated-chat-card {
                    max-width: 400px;
                }
            }

            /* 平板横屏 & 小笔记本 - 1024px 以下 */
            @media (max-width: 1024px) {
                .auth-screen {
                    padding: 30px 16px;
                }

                .main-content {
                    grid-template-columns: 1fr;
                    gap: 32px;
                    max-width: 480px;
                }

                .chat-section, .auth-panel {
                    justify-content: center;
                }

                .chat-section {
                    order: 2;
                }

                .auth-panel {
                    order: 1;
                }

                .auth-card {
                    max-width: 100%;
                }

                .features-grid {
                    grid-template-columns: 1fr;
                    gap: 16px;
                }

                h1 {
                    font-size: 2.5rem;
                }

                .brand-desc {
                    font-size: 1rem;
                }

                .auth-container {
                    gap: 32px;
                    margin-bottom: 40px;
                }

                .header-section {
                    gap: 16px;
                }
            }

            /* 平板竖屏 - 768px 以下 */
            @media (max-width: 768px) {
                .auth-screen {
                    padding: 24px 16px;
                }

                h1 {
                    font-size: 2rem;
                }

                .brand-desc {
                    font-size: 0.95rem;
                }

                .auth-card {
                    padding: 32px 24px;
                    border-radius: 24px;
                }

                .card-header h2 {
                    font-size: 1.5rem;
                }

                .feature-item {
                    padding: 20px;
                    border-radius: 20px;
                }

                .feature-icon {
                    width: 44px;
                    height: 44px;
                }

                .feature-title {
                    font-size: 1rem;
                }

                .feature-desc {
                    font-size: 0.85rem;
                }

                .bottom-features {
                    padding: 0 16px;
                }
            }

            /* 手机 - 480px 以下 */
            @media (max-width: 480px) {
                .auth-screen {
                    padding: 20px 12px;
                }

                h1 {
                    font-size: 1.6rem;
                }

                .brand-desc {
                    font-size: 0.9rem;
                }

                .parallax-content {
                    padding: 8px 14px;
                }

                .parallax-logo {
                    height: 20px;
                }

                .powered-by {
                    font-size: 0.6rem;
                }

                .auth-card {
                    padding: 28px 20px;
                    border-radius: 20px;
                }

                .card-header {
                    margin-bottom: 24px;
                }

                .card-header h2 {
                    font-size: 1.4rem;
                }

                .auth-subtitle {
                    font-size: 0.85rem;
                }

                form {
                    gap: 16px;
                }

                input {
                    padding: 10px 14px;
                    border-radius: 12px;
                }

                .submit-btn {
                    padding: 12px;
                    border-radius: 12px;
                }

                .feature-item {
                    padding: 16px;
                    flex-direction: column;
                    text-align: center;
                    gap: 12px;
                }

                .feature-content {
                    padding-top: 0;
                }
            }
            `}</style>
        </div >
    );
};
