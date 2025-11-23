import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { randomUUID, randomBytes } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DB_PATH = process.env.DB_PATH || join(__dirname, 'data.json');

const PORT = process.env.PORT || 4000;
const CLIENT_ORIGINS = (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const TYPING_TTL = 7000;

const adapter = new JSONFile(DB_PATH);
const db = new Low(adapter, { users: [], messages: [], typing: {} });
await db.read();
db.data ||= { users: [], messages: [], typing: {} };

const app = express();
app.use(
    cors({
        credentials: true,
        origin: (origin, callback) => {
            if (!origin) return callback(null, true);
            if (CLIENT_ORIGINS.includes(origin)) return callback(null, true);
            return callback(new Error('Not allowed by CORS'));
        },
    }),
);
app.use(express.json());
app.use(cookieParser());

const sanitizeUser = (user) => {
    if (!user) return null;
    const { password_hash, ...rest } = user;
    return rest;
};

const signToken = (userId) => {
    return jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: '7d' });
};

const setSessionCookie = (res, token) => {
    res.cookie('token', token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 7 * 24 * 60 * 60 * 1000,
    });
};

const authMiddleware = (req, res, next) => {
    const bearer = req.headers.authorization?.replace('Bearer ', '');
    const token = req.cookies.token || bearer;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    try {
        const payload = jwt.verify(token, JWT_SECRET);
        const user = db.data.users.find((u) => u.id === payload.id);
        if (!user) return res.status(401).json({ error: 'Unauthorized' });
        req.user = sanitizeUser(user);
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
};

const ensureSeed = async () => {
    const llmId = 'llm1';
    const existing = db.data.users.find((u) => u.id === llmId);
    if (!existing) {
        db.data.users.push({
            id: llmId,
            email: 'gpt4@example.com',
            password_hash: randomBytes(8).toString('hex'),
            name: 'GPT-4',
            avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=GPT4',
            isLLM: true,
            status: 'online',
            createdAt: Date.now(),
        });
        await db.write();
    }
};

await ensureSeed();

app.post('/auth/register', async (req, res) => {
    const { email, password, name } = req.body || {};
    if (!email || !password || password.length < 8) {
        return res.status(400).json({ error: 'Invalid email or password too short' });
    }
    if (db.data.users.find((u) => u.email === email)) {
        return res.status(409).json({ error: 'Email already registered' });
    }
    const hash = await bcrypt.hash(password, 10);
    const user = {
        id: randomUUID(),
        email,
        password_hash: hash,
        name: name || email.split('@')[0],
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name || email)}`,
        isLLM: false,
        status: 'online',
        createdAt: Date.now(),
    };
    db.data.users.push(user);
    await db.write();

    const token = signToken(user.id);
    setSessionCookie(res, token);
    res.json({ user: sanitizeUser(user) });
});

app.post('/auth/login', async (req, res) => {
    const { email, password } = req.body || {};
    const user = db.data.users.find((u) => u.email === email);
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    const token = signToken(user.id);
    setSessionCookie(res, token);
    res.json({ user: sanitizeUser(user) });
});

app.post('/auth/logout', (_req, res) => {
    res.clearCookie('token');
    res.json({ ok: true });
});

app.get('/auth/me', authMiddleware, (req, res) => {
    res.json({ user: req.user });
});

app.get('/messages', authMiddleware, (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const before = req.query.before ? Number(req.query.before) : undefined;

    let msgs = [...db.data.messages].sort((a, b) => a.timestamp - b.timestamp);
    if (before) {
        msgs = msgs.filter((m) => m.timestamp < before);
    }
    msgs = msgs.slice(-limit);

    const usersMap = new Map();
    msgs.forEach((m) => {
        const u = db.data.users.find((x) => x.id === m.senderId);
        if (u) usersMap.set(u.id, sanitizeUser(u));
    });
    res.json({ messages: msgs, users: Array.from(usersMap.values()) });
});

app.get('/users', authMiddleware, (_req, res) => {
    res.json({ users: db.data.users.map((u) => sanitizeUser(u)) });
});

app.post('/messages', authMiddleware, async (req, res) => {
    const { content, replyToId } = req.body || {};
    if (!content || !content.trim()) return res.status(400).json({ error: 'Content required' });

    const message = {
        id: randomUUID(),
        content: content.trim(),
        senderId: req.user.id,
        timestamp: Date.now(),
        replyToId: replyToId || undefined,
        reactions: [],
    };
    db.data.messages.push(message);
    await db.write();
    res.json({ message, users: [req.user] });
});

const pruneTyping = () => {
    const now = Date.now();
    Object.entries(db.data.typing).forEach(([userId, expires]) => {
        if (expires < now) delete db.data.typing[userId];
    });
};

app.post('/typing', authMiddleware, async (req, res) => {
    const { isTyping } = req.body || {};
    pruneTyping();
    if (isTyping) {
        db.data.typing[req.user.id] = Date.now() + TYPING_TTL;
    } else {
        delete db.data.typing[req.user.id];
    }
    await db.write();
    res.json({ typingUsers: Object.keys(db.data.typing) });
});

app.get('/typing', authMiddleware, (_req, res) => {
    pruneTyping();
    res.json({ typingUsers: Object.keys(db.data.typing) });
});

app.listen(PORT, () => {
    console.log(`API server listening on http://localhost:${PORT}`);
});
