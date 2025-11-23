# Active LLM Group Chat

一个基于 React + Vite 的群聊 Demo，配套 Express + lowdb 轻后端，支持注册/登录、持久化消息与成员列表，并内置可“主动观察 + 触发”的 LLM 模拟逻辑。UI 贴近 Discord / Telegram，可作为自研产品的起步模板。

> 现有 LLM 行为仍在前端模拟（`useLLM`）；消息、成员、typing 状态由本地 API 服务持久化到 `server/data.json`，可随时替换为真实后端/大模型。

---

## 功能概览

- 账号与会话：邮箱注册/登录，JWT（httpOnly cookie 或 Bearer）维持会话，`/auth/me` 自动续期；头像使用 DiceBear。
- 消息体验：文本气泡、回复（Reply）、@ 提示、Reaction 聚合计数、悬停操作浮层。
- Typing 与轮询：输入时上报 `/typing`，消息定时轮询 `/messages`，实时拉齐最新状态。
- 成员与侧边栏：频道列表 + 成员列表（在线状态点、BOT 标签），移动端可折叠侧边栏。
- LLM 模拟：用户 `llm1`（GPT-4）在前端模拟 —— 40% 概率自动 Reaction；检测到 `@GPT-4`/`gpt` 时 2 秒后自动回复并引用触发消息。
- 持久化：用户、消息、typing 状态存储于 `server/data.json`；删除该文件可重置数据（启动时会重新写入默认 LLM 用户）。

---

## 快速开始

### 环境要求
- Node.js 18+（推荐 18/20）
- npm 或兼容包管理器

### 启动步骤
1) 安装依赖  
```bash
npm install
```
2) 启动后端 API（默认 `http://localhost:4000`，数据写入 `server/data.json`）  
```bash
npm run server
```
可选环境变量：`PORT`、`CLIENT_ORIGIN`（允许的前端地址，逗号分隔）、`JWT_SECRET`、`DB_PATH`。  
3) 启动前端（默认指向本机后端）  
```bash
npm run dev
# 如果后端不在本机或端口不同：
VITE_API_URL="http://localhost:4000" npm run dev
```

打开开发端口（默认 5173）体验：
1. 注册或登录；  
2. 发送消息、添加 Reaction、回复指定消息；  
3. 输入 `@GPT-4` 或含 `gpt` 关键词，观察模拟 LLM 的自动回复；  
4. 在移动端/窄屏下用顶部菜单控制侧边栏。  

---

## 核心实现（前端）

- 状态管理：`src/context/ChatContext.tsx` 用 reducer 管理 `authStatus`、`currentUser`、`users`、`messages`、`typingUsers`、`replyingTo`。
- 启动流程：`src/App.tsx` 通过 `/auth/me` 校验会话，拉取 `/users` 与 `/messages` 完成 HYDRATE，并轮询消息与 typing。
- 输入与发送：`src/components/MessageInput.tsx` 处理多行输入、@ 提示、回复、typing 上报，发送消息调用 `/messages` 再追加到本地。
- 展示与交互：`MessageList`/`MessageBubble` 渲染消息、回复、Reaction；`Sidebar` 显示频道与成员；`Layout` 处理移动端侧边栏；`AuthScreen` 负责注册/登录表单。
- LLM 模拟：`src/hooks/useLLM.ts` 基于最新消息在前端随机 Reaction 和自动回复，可替换为真实推理结果。

---

## 后端 API（简述）

- Auth：`POST /auth/register`、`POST /auth/login`、`POST /auth/logout`、`GET /auth/me`
- Messages：`GET /messages?limit=100&before=timestamp`、`POST /messages`（`content`，可选 `replyToId`）
- Users：`GET /users`
- Typing：`GET /typing`、`POST /typing`（`isTyping`）

---

## 适用场景

- 想“一键跑通”带登录、持久化的群聊 + 模拟 LLM Demo。
- 需要 React + TS + Vite + Express + lowdb 的全栈脚手架，后续替换为真实后端/LLM。
- 产品/交互讨论的可点击原型，或接入真实服务前的前端演示环境。
