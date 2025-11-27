# Active LLM Group Chat - Developer Notes

This document focuses on architecture, data contracts, and recommended workflows for extending the project. Use it as the companion reference to the public README.

---

## 1. Project layout & key dependencies
- `src/`: React + TypeScript + Vite frontend
  - `api/`: API client wrappers (see `src/api/client.ts`); keep HTTP+JSON details here, not inside components.
  - `components/`: UI building blocks.
    - `MessageBubble/`: Decomposed message components (`MessageContent`, `ReactionList`, etc.).
    - `ErrorBoundary.tsx`: React error boundary for catching UI crashes.
    - `AuthScreen`, `Sidebar`, `MessageList`, `MessageInput`, `Layout`, etc.
  - `context/ChatContext.tsx`: global reducer + provider, owns cross-cutting chat state.
  - `hooks/`:
    - `useNetworkStatus.ts`: monitors online/offline state.
    - `useDevicePerformance.ts`: detects device capability for animations.
  - `types/`: shared TS models (`User`, `Message`, `Agent`, etc.) that mirror backend payloads.
- `server/`: Express + lowdb backend
  - `server.js`: API entry point, routes, and lowdb wiring.
  - `data.json`: default persisted data (users/messages/typing/agents); safe to delete in local dev to reset.
- `agents/`: Python-based LLM agent service
  - `agent_service.py`: polls messages, detects @mentions, generates LLM responses.
  - `query.py`: LLM client for your model backend.
  - `requirements.txt`: Python dependencies.
- Scripts: `npm run dev`, `npm run server`, `npm run build`, `npm run preview`, `npm run lint`
- Major deps: React 18, TypeScript, Vite, framer-motion, lucide-react, clsx, Express, lowdb, bcryptjs, jsonwebtoken, cookie-parser, cors, **react-virtuoso**, **react-markdown**, **react-hot-toast**, **dayjs**

---

## 2. State model (`src/types/chat.ts`)
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

## 3. Frontend workflow
- **Auth & bootstrap (`src/App.tsx`)**
  - call `/auth/me` when mounting; if successful, fetch `/users` + `/messages` and dispatch `HYDRATE`
  - failure drops the app into `AuthScreen`
- **Polling**
  - messages: fetch `/messages` every ~4s, merge+dedupe into state, backfill newly discovered users
  - typing: poll `/typing` every ~2.5s and update `typingUsers`
- **Sending input (`MessageInput.tsx`)**
  - textarea autogrows, `Enter` sends, `Shift+Enter` inserts newline
  - lightweight mention suggestions are computed from the current input (not persisted)
  - `POST /messages` on submit, then dispatch `SEND_MESSAGE`; API response may include updated users -> `SET_USERS`
  - typing indicator uses `POST /typing { isTyping: true/false }` + local `SET_TYPING`
- **Rendering (`MessageList` / `MessageBubble`)**
  - **Virtualized list** (`react-virtuoso`) handles large message histories efficiently.
  - sequential render with grouped timestamps, reply previews, reaction aggregations, and hover actions
- **Agent responses**
  - The Python agent service (`agents/agent_service.py`) polls for @mentions
  - Responses appear via the `/agents/:agentId/messages` API
  - Frontend auto-refreshes messages via polling to show agent replies

---

## 4. Component responsibilities
- `AuthScreen.tsx`: login/register forms, calls `/auth/register` + `/auth/login`, handles error states
- `Layout.tsx`: overall chrome, mobile top bar toggles the sidebar overlay, **offline banner**
- `Sidebar.tsx`: channel placeholders, current user card, member list with presence dots + BOT labels
- `MessageList.tsx`: **virtualized** scroll container, auto-scroll to latest message, typing indicator row
- `MessageBubble/`: Directory containing composed message parts:
  - `index.tsx`: Main container
  - `MessageContent.tsx`: Renders markdown text
  - `ReactionList.tsx`: Displays reactions
  - `ActionButtons.tsx`: Hover actions (reply, react, delete)
- `MessageInput.tsx`: multiline composer with reply pill, attachment buttons placeholder, typing dispatch
- `ErrorBoundary.tsx`: Catches render errors and displays a fallback UI
- `ChatContext.tsx`: reducer + context wiring; actions include `HYDRATE`, `SET_AUTH_STATUS`, `SET_USERS`, `SET_MESSAGES`, `SEND_MESSAGE`, `DELETE_MESSAGE`, `DELETE_MESSAGES`, `SET_REPLY`, `SET_TYPING`, `UPDATE_REACTIONS`

---

## 5. Backend overview (`server/server.js`)
- **Stack**: Express + lowdb (JSONFile adapter), bcryptjs for password hashing, jsonwebtoken, cookie-parser, cors
- **Storage**: defaults to `server/data.json`; ensures default `llm1` bot exists at startup
- **Session**: JWT stored as httpOnly cookie (Authorization Bearer is also accepted)
- **CORS**: allowlist defined by `CLIENT_ORIGIN` (comma separated), default `http://localhost:5173`
- **Env vars**
  - `PORT` (default 4000)
  - `CLIENT_ORIGIN`
  - `JWT_SECRET`
  - `DB_PATH`
- **Routes**
  - Auth: `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`
  - Messages: `GET /messages`, `POST /messages`, `DELETE /messages/:id` (cascade deletes replies)
  - Users: `GET /users`
  - Typing: `GET /typing`, `POST /typing`
  - Agents: `GET /agents`, `POST /agents/configs`, `PATCH /agents/configs/:id`, `DELETE /agents/configs/:id`
  - Agent API (token auth): `POST /agents/:agentId/messages`, `POST /agents/:agentId/heartbeat`

---

## 6. Agent Service (`agents/`)

Python service that bridges the chat backend to your LLM:

```bash
cd agents && pip install -r requirements.txt
python agent_service.py --email root@example.com --password 1234567890
```

**Key files:**
- `agent_service.py`: Main service loop
- `query.py`: LLM client (configure `BASE_URL` for your model)
- `requirements.txt`: `openai`, `requests`

**Flow:**
1. Login to chat backend (JWT)
2. Start heartbeat thread (every 5s)
3. Poll `/messages` (every 3s)
4. Detect @mentions via `mentions` field or `@AgentName` in content
5. Build context: recent 10 messages with `<Name: User>: content` format
6. Call LLM, strip `<think>` tags and special tokens
7. Send reply via `/agents/:agentId/messages`

**Configuration (top of `agent_service.py`):**
| Variable | Default | Description |
|----------|---------|-------------|
| `API_BASE` | `http://localhost:4000` | Chat backend |
| `AGENT_TOKEN` | `dev-agent-token` | Must match `AGENT_API_TOKEN` env var |
| `AGENT_ID` | `helper-agent-1` | Agent config ID |
| `AGENT_USER_ID` | `llm1` | User ID for the agent |
| `POLL_INTERVAL` | `3` | Seconds between polls |

---

## 7. Local scripts & tips
1. `npm install`
2. `npm run server` (honor env vars above)
3. `npm run dev` (set `VITE_API_URL` when pointing to a remote API)
4. `cd agents && pip install -r requirements.txt && python agent_service.py`
5. `npm run build`, `npm run preview`, `npm run lint` as needed

Data is persisted in `server/data.json`. Delete the file to reset (it will be regenerated with the default users/bot). For production deployments switch to a real database and configure a strong `JWT_SECRET`.

---

## 8. Extension ideas
- Replace polling with WebSocket/SSE to cut latency and request volume
- Implement streaming LLM responses (show typing indicator as agent generates)
- Add multiple agents with different system prompts/personalities
- Add channels/rooms: attach `channelId` to messages and filter lists based on the active channel
- Harden production posture: HTTPS, secure sameSite cookies, rate limiting, input validation, audit logging, monitoring
