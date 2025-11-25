# OpenAI Group Chat - 项目改进建议

## 📋 概述

本文档提供了对当前项目的全面审查，涵盖 UI/UX 设计、代码效率和功能增强等方面的改进建议。

---

## 🎨 UI/UX 改进建议

<!-- ### 1. **响应式设计优化**

#### 当前问题
- 移动端体验虽有基本支持，但仍有优化空间
- 某些组件在小屏幕上的布局可能不够理想

#### 改进建议
- 优化消息气泡在小屏幕上的最大宽度 (当前 75%)
- 为侧边栏添加更流畅的滑动动画
- 考虑添加平板尺寸的专用断点 (例如 @media 768px-1024px)
- 优化搜索成员功能在移动端的交互

```css
/* 建议的移动端优化 */
@media (max-width: 480px) {
  .content-column {
    max-width: 85%; /* 在更小的屏幕上增加宽度 */
  }
  
  .bubble {
    font-size: 0.95rem; /* 稍微缩小字体 */
  }
}
``` -->

<!-- ### 2. **暗色模式支持**

#### 建议实现
添加暗色主题切换功能，提升用户体验和可访问性。

```css
/* 暗色主题变量示例 */
[data-theme="dark"] {
  --bg-primary: #1a1a1a;
  --bg-secondary: #2d2d2d;
  --bg-tertiary: #3a3a3a;
  --text-primary: #ffffff;
  --text-secondary: #b0b0b0;
  --text-tertiary: #808080;
  --message-other-bg: #2d2d2d;
  --message-own-bg: #1e4d2b;
}
```

实现步骤:
1. 在 `index.css` 中添加暗色主题 CSS 变量
2. 创建主题切换上下文和 hook
3. 在 Sidebar 中添加主题切换按钮
4. 使用 localStorage 持久化用户偏好 -->

<!-- ### 3. **无障碍性 (Accessibility) 增强**

#### 当前缺失的功能
- 缺少键盘导航支持
- ARIA 标签不够完整
- 对比度在某些元素上可能不足

#### 改进建议
```tsx
// 为消息列表添加键盘导航
<div 
  role="log" 
  aria-live="polite" 
  aria-label="Chat messages"
  tabIndex={0}
>
  {/* messages */}
</div>

// 改进按钮的可访问性
<button
  aria-label="React with thumbs up"
  aria-pressed={hasReacted('👍')}
>
  👍
</button>
``` -->

---

## 💻 代码效率改进建议

### 1. **性能优化**

#### React 性能优化

```tsx
// 使用 memo 优化组件重渲染
export const MessageBubble = React.memo<MessageBubbleProps>(({ message, isOwnMessage, showAvatar }) => {
  // ...
}, (prevProps, nextProps) => {
  // 自定义比较逻辑
  return prevProps.message.id === nextProps.message.id &&
         prevProps.message.reactions === nextProps.message.reactions &&
         prevProps.isOwnMessage === nextProps.isOwnMessage;
});

// 使用 useMemo 和 useCallback
const reactionOptions = useMemo(() => ['👍', '❤️', '😂', '😮', '😢', '🔥'], []);

const handleReaction = useCallback(async (emoji: string) => {
  // ... 
}, [state.currentUser, message.id, dispatch]);
```

### 2. **代码组织优化**

#### 样式管理

当前问题: 所有样式都内联在组件中，难以维护

建议方案:
```tsx
// Option 1: 使用 CSS Modules
import styles from './MessageBubble.module.css';

// Option 2: 使用 styled-components 或 emotion
import styled from '@emotion/styled';

const BubbleContainer = styled.div`
  padding: 8px 12px;
  border-radius: var(--radius-xl);
  /* ... */
`;

// Option 3: 提取到单独的 CSS 文件
import './MessageBubble.css';
```

#### 常量和配置集中管理

```typescript
// src/constants/animations.ts
export const ANIMATION_CONFIG = {
  HOVER_IN_DELAY: 350,
  HOVER_OUT_DELAY: 120,
  TYPING_STOP_DELAY: 1500,
  MESSAGE_POLL_INTERVAL: 4000,
} as const;

// src/constants/ui.ts
export const UI_CONFIG = {
  MAX_MESSAGE_WIDTH: '75%',
  REACTION_OPTIONS: ['👍', '❤️', '😂', '😮', '😢', '🔥'],
  CONTENT_MAX_WIDTH: '768px',
} as const;
```

### 3. **TypeScript 类型安全性增强**

```typescript
// src/types/chat.ts - 添加更严格的类型定义

// 使用 discriminated unions 提高类型安全
type MessageStatus = 
  | { type: 'sending' }
  | { type: 'sent'; sentAt: number }
  | { type: 'delivered'; deliveredAt: number }
  | { type: 'read'; readAt: number }
  | { type: 'failed'; error: string };

interface Message {
  id: string;
  content: string;
  senderId: string;
  timestamp: number;
  status: MessageStatus; // 添加状态跟踪
  reactions: Reaction[];
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  replyToId?: string;
  mentions?: string[];
  metadata?: Record<string, unknown>;
  editHistory?: Array<{ content: string; editedAt: number }>; // 编辑历史
}
```

---

## ✨ 功能增强建议

### 1. **消息功能增强**

#### 优先级: 高

- **消息编辑**: 允许用户编辑已发送的消息
  ```tsx
  // 添加编辑状态
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  ```

- **消息搜索**: 实现全文搜索功能
  ```tsx
  // 添加搜索功能
  const [searchQuery, setSearchQuery] = useState('');
  const filteredMessages = messages.filter(msg => 
    msg.content.toLowerCase().includes(searchQuery.toLowerCase())
  );
  ```

- **消息引用/转发**: 允许转发消息到其他会话

- **代码高亮**: 对代码块进行语法高亮
  ```tsx
  import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
  ```

### 2. **文件和媒体支持**

#### 优先级: 高

当前状态: Paperclip 按钮存在但无功能

实现建议:
```tsx
// components/FileUpload.tsx
const FileUpload: React.FC = () => {
  const handleFileSelect = async (files: FileList) => {
    const formData = new FormData();
    Array.from(files).forEach(file => {
      formData.append('files', file);
    });
    
    const response = await api.files.upload(formData);
    // 处理上传后的文件
  };
  
  return (
    <input
      type="file"
      onChange={(e) => e.target.files && handleFileSelect(e.target.files)}
      multiple
      accept="image/*,video/*,.pdf,.doc,.docx"
    />
  );
};
```

功能清单:
- 图片预览和上传
- 视频/音频播放
- 文档文件共享
- 拖放上传支持
- 文件大小和类型验证
- 上传进度显示

### 3. **实时功能增强**

#### 优先级: 中

当前: 使用轮询 (polling) 获取消息

建议升级到 WebSocket:
```typescript
// src/services/websocket.ts
class WebSocketService {
  private ws: WebSocket | null = null;
  
  connect(url: string) {
    this.ws = new WebSocket(url);
    
    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      // 处理实时消息
    };
    
    this.ws.onclose = () => {
      // 自动重连逻辑
      setTimeout(() => this.connect(url), 5000);
    };
  }
  
  sendMessage(message: Message) {
    this.ws?.send(JSON.stringify(message));
  }
}
```

好处:
- 降低服务器负载
- 减少延迟
- 更好的实时性
- 降低带宽消耗

### 4. **通知系统**

#### 优先级: 中

```tsx
// hooks/useNotifications.ts
const useNotifications = () => {
  const requestPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
    return false;
  };
  
  const sendNotification = (title: string, body: string) => {
    if (Notification.permission === 'granted') {
      new Notification(title, {
        body,
        icon: '/logo.png',
        badge: '/badge.png',
      });
    }
  };
  
  return { requestPermission, sendNotification };
};
```

功能:
- 新消息通知
- @提及通知
- 浏览器原生通知
- 桌面通知支持

### 5. **高级交互功能**

#### 语音消息录制

```tsx
// hooks/useVoiceRecorder.ts
const useVoiceRecorder = () => {
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  
  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder.current = new MediaRecorder(stream);
    mediaRecorder.current.start();
    setIsRecording(true);
  };
  
  // ...
};
```

#### 消息已读状态

```tsx
// 使用 Intersection Observer 追踪消息可见性
const useMessageReadStatus = (messageId: string) => {
  const ref = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          // 标记消息为已读
          api.messages.markAsRead(messageId);
        }
      },
      { threshold: 0.5 }
    );
    
    if (ref.current) observer.observe(ref.current);
    
    return () => observer.disconnect();
  }, [messageId]);
  
  return ref;
};
```

### 6. **用户体验增强**

#### 草稿保存

```tsx
// 使用 localStorage 保存消息草稿
const useDraftMessage = (conversationId: string) => {
  const [draft, setDraft] = useState(() => {
    return localStorage.getItem(`draft_${conversationId}`) || '';
  });
  
  useEffect(() => {
    localStorage.setItem(`draft_${conversationId}`, draft);
  }, [draft, conversationId]);
  
  return [draft, setDraft] as const;
};
```

#### 消息本地缓存

```tsx
// 使用 IndexedDB 缓存消息
import { openDB } from 'idb';

const messageDB = await openDB('messages', 1, {
  upgrade(db) {
    db.createObjectStore('messages', { keyPath: 'id' });
  },
});

// 缓存消息
await messageDB.put('messages', message);

// 读取缓存
const cachedMessages = await messageDB.getAll('messages');
```

---

## 🔧 技术债务和代码质量

### 1. **测试覆盖率**

当前状态: 无测试

建议实现:
```tsx
// __tests__/MessageBubble.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { MessageBubble } from '../MessageBubble';

describe('MessageBubble', () => {
  it('should render message content', () => {
    const message = {
      id: '1',
      content: 'Hello World',
      senderId: 'user1',
      timestamp: Date.now(),
      reactions: [],
    };
    
    render(<MessageBubble message={message} isOwnMessage={false} showAvatar={true} />);
    expect(screen.getByText('Hello World')).toBeInTheDocument();
  });
  
  it('should toggle emoji reaction', async () => {
    // ...
  });
});
```

测试清单:
- [ ] 组件单元测试
- [ ] API 集成测试  
- [ ] E2E 测试 (使用 Playwright 或 Cypress)
- [ ] 性能测试
- [ ] 可访问性测试

### 2. **代码质量工具**

```json
// .eslintrc.json - 增强规则
{
  "extends": [
    "eslint:recommended",
    "plugin:react/recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react-hooks/recommended",
    "plugin:jsx-a11y/recommended" // 无障碍性检查
  ],
  "rules": {
    "react-hooks/exhaustive-deps": "error",
    "no-console": ["warn", { "allow": ["warn", "error"] }],
    "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }]
  }
}

// package.json
{
  "scripts": {
    "test": "vitest",
    "test:coverage": "vitest --coverage",
    "type-check": "tsc --noEmit",
    "lint:fix": "eslint . --fix"
  }
}
```

### 3. **性能监控**

```tsx
// 添加性能监控
import { useEffect } from 'react';

const usePerformanceMonitoring = () => {
  useEffect(() => {
    // 监控 FCP, LCP, FID, CLS
    if ('PerformanceObserver' in window) {
      const observer = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          console.log('Performance:', entry);
          // 发送到分析服务
        });
      });
      
      observer.observe({ entryTypes: ['paint', 'largest-contentful-paint'] });
    }
  }, []);
};
```

---

## 📦 依赖和工具升级建议

### 当前依赖分析

查看 package.json 后的建议:

1. **添加有用的库**:
```json
{
  "dependencies": {
    "zustand": "^4.4.7" // 可选: 替代 Context 的状态管理
  },
  "devDependencies": {
    "msw": "^2.0.0" // API mocking
  }
}
```

2. **可选的架构改进**:
   - 考虑使用 TanStack Query (React Query) 管理服务器状态
   - 使用 Zustand 或 Jotai 简化全局状态管理

---

## 🎯 优先级总结

### 立即实施 (High Priority)
1. [x] 组件拆分 (MessageBubble)
2. [x] 添加消息虚拟化
3. [x] 错误边界和错误处理
4. [x] 富文本 Markdown 支持
5. [x] Emoji 选择器
6. [x] 动画性能优化
7. [x] UI 细节完善 (时间分隔符, @提及)
8. [ ] 实现文件上传功能
9. [ ] 添加暗色模式

### 近期实施 (Medium Priority)
10. ⚡ WebSocket 替代轮询
11. ⚡ 消息搜索功能
12. ⚡ 消息编辑功能
13. ⚡ 单元测试覆盖

### 长期规划 (Low Priority)
14. 📅 语音消息录制
15. 📅 消息已读追踪
16. 📅 离线支持和 PWA
17. 📅 性能监控和分析

---

## 📝 结论

这个项目已经有了非常好的基础，UI 设计现代且流畅，代码结构总体清晰。主要改进方向:

1. **性能优化**: 通过虚拟化和 memo 提升大量消息时的性能
2. **功能完善**: 实现文件上传、消息编辑等核心功能
3. **代码质量**: 拆分大组件，添加测试，提高可维护性
4. **用户体验**: 添加暗色模式、通知系统等提升用户满意度

建议按照优先级逐步实施这些改进，每次专注于一到两个重点任务，确保每个改进都经过充分测试后再进行下一个。

---

## 🖥️ 后端架构改进建议

### 📋 执行摘要

基于对 `server/server.js` 的详细审查，发现了多个可以改进的领域。当前后端使用 Express + lowdb，虽然作为原型和开发环境非常合适，但在安全性、性能、错误处理和功能完整性方面有较大提升空间。

---

### 🔒 安全性改进 (⚡ 高优先级)

#### 1. 输入验证和清理

**当前问题:**
- 缺少系统性的输入验证
- 直接信任客户端数据
- 没有使用专门的验证库

**改进建议:**

```javascript
// 安装验证库: npm install zod
import { z } from 'zod';

// 定义消息验证 schema
const messageSchema = z.object({
    content: z.string().min(1).max(5000), // 限制消息长度
    replyToId: z.string().uuid().optional(),
    conversationId: z.string().min(1).max(100).optional(),
    role: z.enum(['user', 'assistant', 'system', 'tool']).optional(),
    metadata: z.record(z.unknown()).optional(),
    mentions: z.array(z.string().uuid()).optional(),
});

// 使用中间件验证
app.post('/messages', authMiddleware, async (req, res) => {
    try {
        const validated = messageSchema.parse(req.body);
        // 继续处理...
    } catch (error) {
        return res.status(400).json({ 
            error: 'Invalid request data', 
            details: error.errors 
        });
    }
});
```

#### 2. 速率限制 (Rate Limiting)

**当前问题:**
- 没有任何速率限制
- 容易受到暴力破解攻击
- 容易受到 DoS 攻击

**改进建议:**

```javascript
// npm install express-rate-limit
import rateLimit from 'express-rate-limit';

// 一般 API 限制
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 分钟
    max: 100, // 限制 100 次请求
    message: 'Too many requests from this IP',
});

// 严格的认证限制
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5, // 15分钟内最多5次登录尝试
    skipSuccessfulRequests: true,
});

// 消息发送限制
const messageLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 分钟
    max: 30, // 1分钟最多30条消息
});

app.use('/api/', apiLimiter);
app.use('/auth/login', authLimiter);
app.use('/auth/register', authLimiter);
app.post('/messages', messageLimiter, authMiddleware, async (req, res) => {
    // ...
});
```

#### 3. JWT 安全性增强

**当前问题:**
- 使用简单的 'dev-secret-change-me' 作为默认密钥
- 没有 token 刷新机制
- 没有 token 撤销功能

**改进建议:**

```javascript
// 在初始化时检查并警告
const JWT_SECRET = process.env.JWT_SECRET || (() => {
    console.warn('⚠️  WARNING: Using insecure default JWT_SECRET!');
    return 'dev-secret-change-me';
})();

// 添加 refresh token 支持
const signTokenPair = (userId) => {
    const accessToken = jwt.sign(
        { id: userId }, 
        JWT_SECRET, 
        { expiresIn: '15m' }
    );
    const refreshToken = jwt.sign(
        { id: userId, type: 'refresh' }, 
        JWT_SECRET, 
        { expiresIn: '7d' }
    );
    return { accessToken, refreshToken };
};

// 添加 token 黑名单
const revokedTokens = new Set();

// 添加 refresh endpoint
app.post('/auth/refresh', async (req, res) => {
    const refreshToken = req.body.refreshToken;
    if (!refreshToken) {
        return res.status(401).json({ error: 'No refresh token' });
    }
    
    try {
        const payload = jwt.verify(refreshToken, JWT_SECRET);
        if (payload.type !== 'refresh') {
            return res.status(401).json({ error: 'Invalid token type' });
        }
        
        const user = db.data.users.find((u) => u.id === payload.id);
        if (!user) {
            return res.status(401).json({ error: 'User not found' });
        }
        
        const { accessToken, refreshToken: newRefreshToken } = signTokenPair(user.id);
        res.json({ accessToken, refreshToken: newRefreshToken });
    } catch (err) {
        return res.status(401).json({ error: 'Invalid refresh token' });
    }
});
```

#### 4. 密码策略增强

**当前问题:**
- 仅检查密码长度 >= 8
- 没有密码复杂度要求

**改进建议:**

```javascript
const passwordSchema = z.string()
    .min(10, '密码至少需要10个字符')
    .refine((password) => {
        const hasUpper = /[A-Z]/.test(password);
        const hasLower = /[a-z]/.test(password);
        const hasNumber = /\d/.test(password);
        return hasUpper && hasLower && hasNumber;
    }, '密码必须包含大写字母、小写字母和数字');
```

#### 5. 安全 Headers

```javascript
// npm install helmet
import helmet from 'helmet';

app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", 'data:', 'https://api.dicebear.com'],
        },
    },
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
    },
}));
```

---

### ⚡ 性能优化 (⚡ 高优先级)

#### 1. 数据库索引和查询优化

**当前问题:**
- 使用数组的 `find` 和 `filter`，时间复杂度 O(n)
- 没有索引，大数据量下性能差

**改进建议 - 添加内存索引:**

```javascript
class IndexedDatabase {
    constructor(adapter, defaultData) {
        this.db = new Low(adapter, defaultData);
        this.indexes = {
            userById: new Map(),
            messageById: new Map(),
            messagesByConversation: new Map(),
        };
    }

    async read() {
        await this.db.read();
        this.rebuildIndexes();
    }

    rebuildIndexes() {
        this.indexes.userById.clear();
        this.indexes.messageById.clear();
        this.indexes.messagesByConversation.clear();

        this.db.data.users.forEach(user => {
            this.indexes.userById.set(user.id, user);
        });

        this.db.data.messages.forEach(message => {
            this.indexes.messageById.set(message.id, message);
            
            const convId = message.conversationId || DEFAULT_CONVERSATION_ID;
            if (!this.indexes.messagesByConversation.has(convId)) {
                this.indexes.messagesByConversation.set(convId, []);
            }
            this.indexes.messagesByConversation.get(convId).push(message);
        });
    }

    getUserById(id) {
        return this.indexes.userById.get(id);
    }

    getMessagesByConversation(conversationId) {
        return this.indexes.messagesByConversation.get(conversationId) || [];
    }
}
```

**更好的长期方案 - 升级到 SQLite:**

```javascript
// npm install better-sqlite3
import Database from 'better-sqlite3';

const db = new Database('chat.db');

db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        senderId TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        conversationId TEXT NOT NULL,
        role TEXT NOT NULL
    );

    CREATE INDEX idx_messages_conversation 
    ON messages(conversationId, timestamp);
    CREATE INDEX idx_messages_sender ON messages(senderId);
`);
```

#### 2. 缓存策略

```javascript
// npm install node-cache
import NodeCache from 'node-cache';

const cache = new NodeCache({ 
    stdTTL: 60, // 默认 60 秒过期
    checkperiod: 120 
});

app.get('/users', authMiddleware, (req, res) => {
    const cacheKey = 'users:all';
    const cached = cache.get(cacheKey);
    
    if (cached) {
        return res.json({ users: cached });
    }
    
    const users = db.data.users.map(sanitizeUser);
    cache.set(cacheKey, users, 30); // 30秒缓存
    res.json({ users });
});
```

#### 3. 压缩中间件

```javascript
// npm install compression
import compression from 'compression';

app.use(compression({
    level: 6, // 压缩级别 0-9
}));
```

#### 4. 基于游标的分页

**当前问题:** 使用 `slice(-limit)` 需要遍历所有消息

**改进建议:**

```javascript
app.get('/messages', authMiddleware, (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const cursor = req.query.cursor ? String(req.query.cursor) : undefined;
    const conversationId = req.query.conversationId || DEFAULT_CONVERSATION_ID;

    let msgs = indexedDb.getMessagesByConversation(conversationId);
    
    if (cursor) {
        const cursorIndex = msgs.findIndex(m => m.id === cursor);
        if (cursorIndex !== -1) {
            msgs = msgs.slice(cursorIndex + 1);
        }
    }
    
    msgs = msgs.slice(0, limit);
    const nextCursor = msgs.length === limit ? msgs[msgs.length - 1].id : null;
    
    res.json({ 
        messages: msgs, 
        users: getUsersForMessages(msgs),
        nextCursor,
        hasMore: nextCursor !== null
    });
});
```

---

### 🏗️ 代码质量和架构改进 (🔧 中优先级)

#### 1. 模块化重构

**当前问题:**
- 所有逻辑都在一个 339 行的文件中
- 难以维护和测试

**建议的文件结构:**

```
server/
├── src/
│   ├── config/
│   │   ├── env.js          # 环境变量配置
│   │   └── constants.js    # 常量定义
│   ├── db/
│   │   ├── index.js        # 数据库初始化
│   │   └── seed.js         # 数据种子
│   ├── middleware/
│   │   ├── auth.js         # 认证中间件
│   │   ├── validation.js   # 验证中间件
│   │   └── errorHandler.js # 错误处理
│   ├── routes/
│   │   ├── auth.js         # 认证路由
│   │   ├── messages.js     # 消息路由
│   │   ├── users.js        # 用户路由
│   │   └── typing.js       # 输入状态路由
│   ├── services/
│   │   ├── authService.js  # 认证业务逻辑
│   │   └── messageService.js # 消息业务逻辑
│   └── app.js              # Express 应用
└── server.js               # 入口文件
```

**示例 - 消息路由模块:**

```javascript
// src/routes/messages.js
import express from 'express';

export const createMessageRouter = (db, authMiddleware) => {
    const router = express.Router();

    router.get('/', authMiddleware, async (req, res, next) => {
        try {
            // 获取消息逻辑
            res.json(result);
        } catch (error) {
            next(error);
        }
    });

    router.post('/', authMiddleware, async (req, res, next) => {
        try {
            // 创建消息逻辑
            res.json(result);
        } catch (error) {
            next(error);
        }
    });

    return router;
};
```

#### 2. 错误处理标准化

```javascript
// src/utils/errors.js
export class AppError extends Error {
    constructor(message, statusCode = 500, isOperational = true) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        Error.captureStackTrace(this, this.constructor);
    }
}

export class ValidationError extends AppError {
    constructor(message) {
        super(message, 400);
    }
}

export class UnauthorizedError extends AppError {
    constructor(message = 'Unauthorized') {
        super(message, 401);
    }
}

export class NotFoundError extends AppError {
    constructor(message = 'Not found') {
        super(message, 404);
    }
}

// src/middleware/errorHandler.js
export const errorHandler = (err, req, res, next) => {
    let error = err;

    if (!(error instanceof AppError)) {
        const statusCode = error.statusCode || 500;
        const message = error.message || 'Internal Server Error';
        error = new AppError(message, statusCode, false);
    }

    if (!error.isOperational || error.statusCode >= 500) {
        console.error('ERROR 💥:', error);
    }

    res.status(error.statusCode).json({
        error: error.message,
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
    });
};
```

#### 3. 日志系统

```javascript
// npm install winston
import winston from 'winston';

const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    transports: [
        new winston.transports.File({ filename: 'logs/combined.log' }),
        new winston.transports.File({ 
            filename: 'logs/error.log', 
            level: 'error' 
        }),
    ],
});

// 开发环境控制台输出
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
        ),
    }));
}

// 使用
logger.info('User logged in', { userId: user.id });
logger.error('Failed to send message', { error: err.message });
```

#### 4. TypeScript 迁移

将后端迁移到 TypeScript，提高类型安全性：

```typescript
// src/types/index.ts
export interface User {
    id: string;
    email: string;
    password_hash: string;
    name: string;
    avatar: string;
    isLLM: boolean;
    status: 'online' | 'offline' | 'away';
    createdAt: number;
}

export interface Message {
    id: string;
    content: string;
    senderId: string;
    timestamp: number;
    reactions: Reaction[];
    conversationId: string;
    role: 'user' | 'assistant' | 'system' | 'tool';
    replyToId?: string;
    metadata?: Record<string, unknown>;
    mentions?: string[];
}
```

---

### ✨ 功能增强 (🔧 中优先级)

#### 1. WebSocket 支持

**当前问题:**
- 使用轮询获取消息，效率低
- 延迟高，服务器负载大

**改进建议:**

```javascript
// npm install ws
import { WebSocketServer } from 'ws';
import { createServer } from 'http';

const server = createServer(app);
const wss = new WebSocketServer({ server });

const connections = new Map(); // userId -> WebSocket

wss.on('connection', (ws, req) => {
    let userId = null;

    ws.on('message', async (data) => {
        try {
            const message = JSON.parse(data.toString());

            // 处理认证
            if (message.type === 'auth') {
                const payload = jwt.verify(message.token, JWT_SECRET);
                const user = db.data.users.find((u) => u.id === payload.id);
                
                if (user) {
                    userId = user.id;
                    connections.set(userId, ws);
                    ws.send(JSON.stringify({ type: 'auth', success: true }));
                }
                return;
            }

            // 处理消息
            if (message.type === 'message') {
                const newMessage = {
                    id: randomUUID(),
                    content: message.content,
                    senderId: userId,
                    timestamp: Date.now(),
                    // ...
                };

                db.data.messages.push(newMessage);
                await db.write();

                // 广播到所有连接的用户
                broadcast({ type: 'new_message', message: newMessage });
            }
        } catch (error) {
            ws.send(JSON.stringify({ type: 'error', message: error.message }));
        }
    });

    ws.on('close', () => {
        if (userId) {
            connections.delete(userId);
        }
    });
});

function broadcast(message, excludeUserId = null) {
    const data = JSON.stringify(message);
    connections.forEach((ws, userId) => {
        if (userId !== excludeUserId && ws.readyState === ws.OPEN) {
            ws.send(data);
        }
    });
}

server.listen(PORT, () => {
    console.log(`Server with WebSocket on http://localhost:${PORT}`);
});
```

#### 2. 文件上传支持

```javascript
// npm install multer
import multer from 'multer';
import path from 'path';

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => {
        const uniqueName = `${randomUUID()}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    },
});

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => {
        const allowed = /jpeg|jpg|png|gif|pdf|doc|docx|txt|mp4|mp3/;
        const ext = allowed.test(path.extname(file.originalname).toLowerCase());
        const mime = allowed.test(file.mimetype);
        
        if (ext && mime) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type'));
        }
    },
});

app.post('/upload', authMiddleware, upload.array('files', 5), async (req, res) => {
    try {
        const files = req.files.map(file => ({
            id: randomUUID(),
            filename: file.filename,
            originalName: file.originalname,
            mimetype: file.mimetype,
            size: file.size,
            uploadedBy: req.user.id,
            uploadedAt: Date.now(),
            url: `/uploads/${file.filename}`,
        }));

        db.data.files = db.data.files || [];
        db.data.files.push(...files);
        await db.write();

        res.json({ files });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

app.use('/uploads', express.static('uploads'));
```

#### 3. 消息编辑功能

```javascript
app.patch('/messages/:messageId', authMiddleware, async (req, res) => {
    const { messageId } = req.params;
    const { content } = req.body;

    if (!content || !content.trim()) {
        return res.status(400).json({ error: 'Content required' });
    }

    const message = db.data.messages.find((m) => m.id === messageId);
    
    if (!message) {
        return res.status(404).json({ error: 'Message not found' });
    }

    if (message.senderId !== req.user.id) {
        return res.status(403).json({ error: 'Cannot edit this message' });
    }

    // 保存编辑历史
    message.editHistory = message.editHistory || [];
    message.editHistory.push({
        content: message.content,
        editedAt: Date.now(),
    });

    message.content = content.trim();
    message.edited = true;
    message.lastEditedAt = Date.now();

    await db.write();
    res.json({ message });
});
```

#### 4. 消息已读状态

```javascript
app.post('/messages/:messageId/read', authMiddleware, async (req, res) => {
    const { messageId } = req.params;
    const message = db.data.messages.find((m) => m.id === messageId);

    if (!message) {
        return res.status(404).json({ error: 'Message not found' });
    }

    message.readBy = message.readBy || [];
    
    if (!message.readBy.find(r => r.userId === req.user.id)) {
        message.readBy.push({
            userId: req.user.id,
            readAt: Date.now(),
        });
        await db.write();
    }

    res.json({ message });
});
```

---

### 🧪 测试 (🔧 中优先级)

#### 1. 单元测试框架

```javascript
// npm install --save-dev jest supertest

// __tests__/auth.test.js
import request from 'supertest';
import { createApp } from '../src/app';

describe('Auth API', () => {
    let app, db;

    beforeAll(async () => {
        db = await setupTestDb();
        app = createApp(db);
    });

    it('should register a new user', async () => {
        const response = await request(app)
            .post('/auth/register')
            .send({
                email: 'test@example.com',
                password: 'SecurePass123!',
                name: 'Test User',
            });

        expect(response.status).toBe(200);
        expect(response.body.user).toHaveProperty('id');
        expect(response.body.user.email).toBe('test@example.com');
    });

    it('should reject weak passwords', async () => {
        const response = await request(app)
            .post('/auth/register')
            .send({
                email: 'test2@example.com',
                password: '123',
            });

        expect(response.status).toBe(400);
    });
});
```

#### 2. 集成测试

```javascript
describe('Messages Flow', () => {
    it('should create, retrieve, and delete a message', async () => {
        // 创建用户并登录
        const auth = await loginTestUser();
        
        // 创建消息
        const createRes = await request(app)
            .post('/messages')
            .set('Cookie', auth.cookie)
            .send({ content: 'Test message' });

        expect(createRes.status).toBe(200);
        const messageId = createRes.body.message.id;

        // 获取消息
        const getRes = await request(app)
            .get('/messages')
            .set('Cookie', auth.cookie);

        expect(getRes.body.messages).toContainEqual(
            expect.objectContaining({ id: messageId })
        );

        // 删除消息
        const deleteRes = await request(app)
            .delete(`/messages/${messageId}`)
            .set('Cookie', auth.cookie);

        expect(deleteRes.status).toBe(200);
    });
});
```

---

### 📦 部署和运维 (📅 低优先级)

#### 1. 环境配置

```bash
# .env.example
NODE_ENV=production
PORT=4000
CLIENT_ORIGIN=https://yourdomain.com
JWT_SECRET=your-secret-key-here-change-me

# 数据库配置
DATABASE_URL=postgresql://user:password@localhost:5432/chatdb

# Redis 配置
REDIS_URL=redis://localhost:6379

# 日志配置
LOG_LEVEL=info

# 文件上传
MAX_FILE_SIZE=10485760
UPLOAD_DIR=/var/lib/chatapp/uploads
```

#### 2. Docker 支持

```dockerfile
# Dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY server/ ./server/

RUN mkdir -p /data /uploads && \
    addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app /data /uploads

USER nodejs

EXPOSE 4000

CMD ["node", "server/server.js"]
```

```yaml
# docker-compose.yml
version: '3.8'
services:
  api:
    build: .
    ports:
      - "4000:4000"
    environment:
      - NODE_ENV=production
      - JWT_SECRET=${JWT_SECRET}
    volumes:
      - chat-data:/data
      - chat-uploads:/uploads
    restart: unless-stopped

volumes:
  chat-data:
  chat-uploads:
```

#### 3. 健康检查端点

```javascript
app.get('/health', (req, res) => {
    const health = {
        uptime: process.uptime(),
        message: 'OK',
        timestamp: Date.now(),
        checks: {
            database: 'OK',
            memory: process.memoryUsage(),
        },
    };

    try {
        db.data; // 验证数据库可访问
    } catch (error) {
        health.checks.database = 'ERROR';
        health.message = 'Unhealthy';
        return res.status(503).json(health);
    }

    res.json(health);
});
```

---

### 🎯 后端改进优先级总结

#### 立即实施 (⚡ 高优先级)
1. ✅ **输入验证** - 使用 zod 验证所有输入
2. ✅ **速率限制** - 防止暴力破解和 DoS 攻击
3. ✅ **错误处理标准化** - 统一错误处理机制
4. ✅ **基础安全增强** - Helmet, CORS 优化, 密码策略
5. ✅ **日志系统** - Winston 记录请求和错误
6. ✅ **JWT 安全性** - Token 刷新和撤销机制
7. ✅ **数据库索引** - 添加内存索引或升级到 SQLite

#### 近期实施 (🔧 中优先级)
8. 🔧 **模块化重构** - 拆分成多个文件和模块
9. 🔧 **WebSocket 支持** - 替代轮询，实现真正的实时通信
10. 🔧 **缓存策略** - 使用 node-cache 提升性能
11. 🔧 **单元测试** - Jest + Supertest 测试核心功能
12. 🔧 **TypeScript 迁移** - 提高类型安全性
13. 🔧 **压缩中间件** - 减少响应大小

#### 长期规划 (📅 低优先级)
14. 📅 **数据库完全升级** - 迁移到 PostgreSQL/MongoDB
15. 📅 **文件上传** - 支持图片和文件分享
16. 📅 **消息编辑和已读** - 完整的消息管理功能
17. 📅 **性能监控** - APM 工具集成
18. 📅 **Docker 化部署** - 容器化和编排
19. 📅 **CI/CD 流程** - 自动化测试和部署

---

### 💡 实施建议

1. **分阶段进行**: 不要一次性重构所有内容，按优先级逐步实施
2. **保持向后兼容**: 确保前端不受影响，或同步更新前端
3. **充分测试**: 每个改进都应该有对应的测试用例
4. **文档更新**: 及时更新 API 文档和 README
5. **监控指标**: 实施后监控性能和错误率
6. **代码审查**: 重要改动应经过团队审查

根据 AGENTS.md 的原则，建议优先实施安全性和代码质量改进，然后再考虑功能增强。这样可以确保系统的稳定性和可维护性，为未来的扩展打下坚实基础。
