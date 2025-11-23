# Active LLM Group Chat — 开发者文档

面向开发者的结构说明、运行手册和扩展建议，覆盖前端/后端、状态模型与主要组件。

---

## 1) 项目结构与依赖

- `src/`：前端（React + TypeScript + Vite）
  - `api/`: API 客户端封装 (`src/api/client.ts`)
  - `components/`: UI 组件（AuthScreen、Sidebar、MessageList、MessageBubble、MessageInput、Layout 等）
  - `context/ChatContext.tsx`: 全局状态与 reducer
  - `hooks/useLLM.ts`: 前端模拟 LLM 逻辑
  - `types/`: 数据模型定义
- `server/`: 轻后端（Express + lowdb）
  - `server.js`: API 服务
  - `data.json`: 默认数据存储（用户/消息/typing）
- 脚本：`npm run dev`（前端）、`npm run server`（后端）、`npm run build`、`npm run lint`、`npm run preview`
- 主要依赖：React 18、TypeScript、Vite、framer-motion、lucide-react、clsx、Express、lowdb、bcryptjs、jsonwebtoken、cookie-parser、cors

---

## 2) 状态模型（`src/types/chat.ts`）

```ts
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

export interface Message {
  id: string;
  content: string;
  senderId: string;
  timestamp: number;
  reactions: Reaction[];
  replyToId?: string;
  mentions?: string[];
}

export interface ChatState {
  currentUser: User | null;
  users: User[];
  messages: Message[];
  typingUsers: string[];
  replyingTo?: Message;
  authStatus: 'loading' | 'authenticated' | 'unauthenticated';
}
```

---

## 3) 前端工作流

- **鉴权与启动（`src/App.tsx`）**
  - 启动时调用 `/auth/me` 校验会话；并行拉取 `/users`、`/messages`，组合去重后 HYDRATE。
  - 会话失败则进入 `AuthScreen`；成功后进入聊天页。
- **轮询**
  - 消息：每 4s 调用 `/messages`，更新 `messages` 与补充的 `users`。
  - Typing：每 2.5s 调用 `/typing`，同步 `typingUsers`。
- **发送与输入（`MessageInput.tsx`）**
  - 多行自适应、`Enter` 发送、`Shift+Enter` 换行。
  - @ 提示基于输入文本，不持久化 mentions 字段（如需可扩展）。
  - 发送调用 `POST /messages`，成功后 `SEND_MESSAGE`；有返回用户时 `SET_USERS`。
  - Typing 上报：输入时 `POST /typing { isTyping: true/false }`，同时本地 `SET_TYPING`。
- **展示（`MessageList` / `MessageBubble`）**
  - 按顺序渲染消息，处理回复引用、Reaction 聚合、悬浮操作。
- **LLM 模拟（`useLLM.ts`）**
  - 仅在前端执行：若新消息来自非 `llm1`，40% 概率添加 Reaction；命中 `@GPT-4`/`gpt` 时 2 秒后派发一条来自 `llm1` 的回复。

---

## 4) 组件职责速览

- `AuthScreen.tsx`：登录/注册表单，调用 `/auth/register`、`/auth/login`，处理错误提示。
- `Layout.tsx`：整体布局，移动端顶部菜单控制 `Sidebar`。
- `Sidebar.tsx`：频道列表、成员列表（状态点、BOT 标签）、当前用户卡片，支持移动端遮罩。
- `MessageList.tsx`：消息列表、自动滚动、typing 提示。
- `MessageBubble.tsx`：单条气泡（头像、昵称、时间、回复、Reaction、hover 操作）。
- `MessageInput.tsx`：多行输入、发送、回复条、@ 提示、typing 上报。
- `useLLM.ts`：模拟 LLM 反应与自动回复。
- `ChatContext.tsx`：全局 reducer（HYDRATE、auth 状态、消息/用户/typing/回复/Reaction）。

---

## 5) 后端说明（`server/server.js`）

- **技术**：Express + lowdb(JSONFile)；bcryptjs（密码哈希）、jsonwebtoken（JWT）、cookie-parser、cors。
- **存储**：默认写入 `server/data.json`；启动时确保存在默认 LLM 用户 `llm1`。
- **会话**：JWT，httpOnly cookie；也可通过 Authorization Bearer 传递。
- **CORS**：允许列表来自 `CLIENT_ORIGIN`（逗号分隔），默认 `http://localhost:5173`。
- **环境变量**
  - `PORT`（默认 4000）
  - `CLIENT_ORIGIN`（允许的前端源，逗号分隔）
  - `JWT_SECRET`（生产务必修改）
  - `DB_PATH`（默认 `server/data.json`）
- **主要端点**
  - `POST /auth/register`、`POST /auth/login`、`POST /auth/logout`、`GET /auth/me`
  - `GET /messages?limit=100&before=timestamp`（按时间排序取最近消息）
  - `POST /messages`（`content`，可选 `replyToId`）
  - `GET /users`
  - `GET /typing`、`POST /typing`（`isTyping`，服务端带 TTL 清理）

---

## 6) 本地运行与脚本

1) 安装依赖：`npm install`  
2) 启动后端：`npm run server`（可配环境变量见上）  
3) 启动前端：`npm run dev`；如后端地址变化，设置 `VITE_API_URL`。  
4) 其他脚本：`npm run build`、`npm run lint`、`npm run preview`。  

数据存储位于 `server/data.json`。删除该文件可重置（会重新写入默认 llm1）。生产部署时请使用持久化存储并配置强随机 `JWT_SECRET`。

---

## 7) 扩展建议

- 将 `useLLM` 改为真实 LLM 推理（可在后端暴露 /llm 端点，前端调用后插入消息；或直接由后端推送）。
- 用 WebSocket/SSE 取代轮询，以减少延迟与请求量。
- 完善 @ 提醒：解析内容写入 `mentions`，并在服务端下发通知。
- 增加频道/房间模型：在后端区分 channelId，并在前端 Sidebar 切换频道时过滤消息。
- 强化生产配置：HTTPS、secure sameSite cookie、速率限制、输入校验、日志与监控。
