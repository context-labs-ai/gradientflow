# Active LLM Group Chat

A React + Vite group chat showcase with an Express + lowdb backend. It ships a lightweight auth flow, persistent messages and member lists, plus a triggerable LLM bot that can react or reply on its own. The layout mirrors Telegram/Discord, so it doubles as a starting template for internal prototypes, demos, and “LLM in chat” experiments.


> The project includes a **Python-based Agent Service** (`agents/`) that connects to real LLM backends. Messages, users, and typing states are stored by the local API inside `server/data.json`.

---

## Feature Highlights
- Accounts & sessions: email registration/login with JWT (httpOnly cookie + Bearer fallback), `/auth/me` refresh, DiceBear avatars.
- Message UX: text bubbles with **Markdown support**, reply preview, @ mentions, aggregated reactions, and hover actions that feel close to a modern IM client.
- Typing + polling: typing indicators are reported via `/typing`, messages are polled through `/messages` to keep everyone in sync.
- Members & sidebar: placeholder channels + member list (presence dots, BOT badge) with a mobile-friendly collapsible sidebar.
- **Real LLM Agent**: Python-based agent service (`agents/`) that polls for @mentions and responds using your LLM backend. Supports heartbeat monitoring, cascade message deletion, and customizable prompts.
- Persistence: users, messages, and typing states live in `server/data.json`; deleting the file resets the sandbox (the default LLM user is re-created on boot).
- Dev experience: single repo, separate dev servers for frontend/backend, TypeScript types shared between UI and API payloads.
- Performance & Reliability: **virtualized message list** for handling large histories, **error boundary** protection, and network status monitoring.

---

## Quick Start

### Requirements
- Node.js 18+ (18/20 recommended)
- npm or a compatible package manager

### Local workflow
1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the API (defaults to `http://localhost:4000`, storing data under `server/data.json`):
   ```bash
   npm run server
   ```
   Optional environment variables:
   - `PORT`: API port, default `4000`
   - `CLIENT_ORIGIN`: comma separated origins allowed to hit the API
   - `JWT_SECRET`: JWT signing secret (change it for any non-local use!)
   - `DB_PATH`: lowdb JSON storage path, default `server/data.json`
3. Start the frontend (points to the local API unless overridden) and open `http://localhost:5173`:
   ```bash
   npm run dev
   # point to a remote API if needed
   VITE_API_URL="http://localhost:4000" npm run dev
   ```

Suggested flow: register or log in -> send a few messages (try **Markdown**!), add reactions, quote reply -> type `@GPT-4` or include `gpt` to trigger the bot -> shrink the window/mobile to test the responsive sidebar toggle.

---

## Frontend Overview
- `ChatContext`: reducer that owns `authStatus`, `currentUser`, `users`, `messages`, `typingUsers`, and `replyingTo`.
- `App.tsx`: entry point; validates `/auth/me`, hydrates `/users` + `/messages`, and starts message/typing polling.
- `MessageInput.tsx`: multiline editor with @ suggestions, reply ribbon, typing reports, and `POST /messages` submission.
- `MessageList` / `MessageBubble`: renders messages (virtualized), reply previews, reactions, and their hover interactions.
- `Sidebar` / `Layout`: channel + member list plus the responsive mobile drawer shell.

### Tech stack (frontend)
- React 18 + TypeScript + Vite
- Styling via utility classes + small custom components (no heavy UI framework)
- `framer-motion` for subtle animations, `lucide-react` for icons, `clsx` for conditional classNames
- `react-hot-toast` for notifications, `react-markdown` for rich text, `react-virtuoso` for virtualization, `dayjs` for dates

---

## Backend API (TL;DR)
- Auth: `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`
- Messages: `GET /messages`, `POST /messages`, `DELETE /messages/:id` (cascade deletes replies)
- Users: `GET /users`
- Typing: `GET /typing`, `POST /typing`
- Agents: `GET /agents`, `POST /agents/configs`, `PATCH /agents/configs/:id`, `DELETE /agents/configs/:id`
- Agent API: `POST /agents/:agentId/messages` (send as agent), `POST /agents/:agentId/heartbeat`

### Tech stack (backend)
- Express, lowdb (JSON file storage)
- `bcryptjs` for password hashing
- `jsonwebtoken` for JWT issuance/verification
- `cookie-parser` and `cors` for auth cookies + CORS handling

---

## Agent Service (`agents/`)

A Python service that connects your LLM to the chat:

```bash
cd agents
pip install -r requirements.txt
python agent_service.py
```

Features:
- **@mention detection**: Responds when users mention `@GPT-4` or agent name
- **Heartbeat**: Signals online status to the backend
- **Context building**: Sends recent chat history to LLM with speaker labels
- **Response filtering**: Strips `<think>` tags and special tokens from LLM output
- **Cascade delete**: Deleting a user message also removes the agent's reply

See [`agents/README.md`](agents/README.md) for detailed configuration.

---

## Data & Reset
- Default storage: `server/data.json`
- Reset: stop the API, delete the file, restart to re-seed the default members/LLM bot
- Production tips: move to a proper database, rotate `JWT_SECRET`, add HTTPS, rate limits, validation, logging, and monitoring

---

## When To Use It
- Need a "works out of the box" chat demo with login, persistence, and an LLM bot
- Want an end-to-end React + TS + Vite + Express + lowdb scaffold to plug into a real backend/model
- Demoing UX flows, running workshops, or providing an interactive artifact for product discussions

---

## Possible Extensions
- Replace polling with WebSocket/SSE transport for lower latency
- Add multi-channel / DM models (filter by `channelId`)
- Implement streaming responses from LLM (show typing as agent generates)
- Add multiple agents with different personalities/capabilities
- Harden prod readiness: HTTPS, secure sameSite cookies, rate limits, schema validation, logging, alerting
