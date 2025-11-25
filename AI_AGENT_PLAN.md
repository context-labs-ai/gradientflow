# OpenAI Group Chat - AI 智能体与大模型集成实施方案

> 目标：让 Agent 像“真实用户”一样在群里聊天（发消息、引用回复、点赞、总结等），同时把这些能力抽象成通用工具层，支持不同大模型与 Agent 框架（Function Calling、MCP 等）复用。

---

## 1. 总体目标与设计原则

- 在现有「多人群聊 + 机器人」架构基础上，引入真正的大模型（LLM）和统一的 `Agent` 框架。
- Agent 在房间中是“一级参与者”，拥有自己的身份、头像、角色，可以像人一样：
  - 主动 / 被动回答消息；
  - 引用某条消息进行回复；
  - 对消息进行点赞 / 反应；
  - 主动发起总结或提醒。
- 所有 LLM 调用与 Agent 行为尽量通过 **Chat Tool API** 完成，而不是直接写死在前后端逻辑中：
  - 便于未来更换大模型、接入多种 Agent 运行时；
  - 为 MCP / Function Calling 提供稳定的“聊天工具”集合。

---

## 2. 核心领域模型

### 2.1 消息（Message）

统一在前后端使用的逻辑结构：

- `Message`
  - `id: string`
  - `roomId: string`
  - `content: string`
  - `author: {`
    - `id: string`
    - `displayName: string`
    - `type: 'user' | 'agent' | 'system'`
    - `roles?: string[]`（如 `['admin']`, `['bot', 'helper']`）
  - `timestamp: number`
  - `replyToId?: string`（引用的目标消息 ID）
  - `reactions: {`
    - `userId: string`
    - `type: 'like' | string`
    - `isFromAgent?: boolean`
  - `metadata?: Record<string, unknown>`

要求：

- 所有返回给 Agent / LLM 的工具结果中都使用 `author` 对象，而不是仅 `authorId`，保证 Agent 能知道“谁说了什么、是人还是 Agent”。

### 2.2 参与者（Participant）

- `Participant`
  - `id: string`
  - `displayName: string`
  - `type: 'user' | 'agent' | 'system'`
  - `roles?: string[]`

Agent 本质上是 `type = 'agent'` 的参与者。

### 2.3 Agent 与触发器

- `Agent`
  - `id: string`
  - `name: string`
  - `avatarUrl?: string`
  - `systemPrompt: string`
  - `capabilities: {`
    - `answer_active: boolean`（主动回答）
    - `answer_passive: boolean`（被动回答）
    - `like: boolean`（点赞）
    - `summarize?: boolean`（对话总结）
    - `moderate?: boolean`（内容审查等）
    - `tools?: string[]`（可调用的工具名称）
  - `triggers: AgentTrigger[]`
  - `rateLimit?: { callsPerMinute: number; maxTokensPerCall: number }`

- `AgentTrigger`
  - `eventType: 'message_created' | 'summary_requested' | 'room_started' | ...`
  - `matchRules: {`
    - `keywords?: string[]`
    - `isQuestion?: boolean`
    - `minMessagesInRoom?: number`
    - `targetAgentId?: string`（用于命令 / @mention）
  - `mode: 'rule_only' | 'llm_classification'`

### 2.4 Agent 事件（AgentEvent）

- `AgentEvent`
  - `type: 'message_created' | 'reaction_added' | 'summary_requested' | ...`
  - `roomId: string`
  - `message?: Message`
  - `messageId?: string`
  - `actor: Participant`
  - `timestamp: number`
  - `conversationWindow?: Message[]`（最近 N 条消息）

消息保存成功后，由服务器统一调用：

- `AgentManager.onEvent({ type: 'message_created', roomId, message, actor, ... })`

---

## 3. 后端架构：LLM 封装与 AgentManager

### 3.1 LLM 客户端封装（llmClient）

新建 `server/llmClient.ts`：

- 提供统一接口：
  - `generateChatReply({ messages, systemPrompt, tools, temperature })`
  - `classifyMessage({ message, labels })`（判断是否需要回答 / 点赞）
  - `summarizeConversation({ messages, systemPrompt })`
- 支持：
  - 普通非流式返回（先实现）；
  - 预留流式（SSE / WebSocket）输出能力，未来支持前端打字机效果。
- API Key 与配置：
  - 使用 `.env` 管理，例如 `OPENAI_API_KEY`；
  - 所有调用都从服务器发出，前端不接触密钥。

### 3.2 AgentManager / Orchestrator

新建 `server/agents/AgentManager.ts`：

- 负责：
  - 管理 Agent 注册与加载（从配置文件 / 数据源）；
  - 提供 `getAgentById`, `listAgents`；
  - 提供 `onEvent(event: AgentEvent)` 主入口。
- `onEvent` 逻辑：
  - 根据 `event.type` 找到所有匹配 `triggers` 的 Agent；
  - 按规则 + 轻量 LLM 分类决定是否触发；
  - 构造好 LLM 输入（系统 prompt + 上下文 + 事件信息）；
  - 调用 `llmClient` 获取结果，解析为工具调用和最终回复（详见第 4 章）。
- 考虑简单任务队列：
  - 避免在 HTTP 请求中直接等待 LLM，使用队列 + worker 处理耗时任务；
  - 优先用简单 in-memory 队列，未来可替换为专业队列系统。

---

## 4. Chat Tool API：把“群聊操作”抽象成工具

> 这一层是整个设计的关键：所有 Agent 行为（发消息、引用、点赞、查历史、看参与者等）都通过工具完成，便于在 Function Calling 和 MCP 中统一复用。

### 4.1 工具元信息与调用模型

- `ToolDefinition`
  - `name: string`（如 `chat.send_message`）
  - `description: string`
  - `inputSchema: JSONSchema / zod`
  - `outputSchema?: JSONSchema / zod`
  - `scope: 'server' | 'client' | 'both'`（在服务器执行还是需要前端执行 UI 动作）

- `ToolInvocation`
  - `toolName: string`
  - `args: unknown`
  - `invokedByAgentId: string`
  - `roomId: string`

- `ToolResult`
  - `success: boolean`
  - `data?: unknown`
  - `error?: string`

- `ToolRegistry`（服务器侧）
  - `registerTool(def: ToolDefinition, impl: (args, ctx) => Promise<ToolResult>)`
  - `listTools(): ToolDefinition[]`
  - `invoke(toolName, args, ctx): Promise<ToolResult>`

基于 `ToolDefinition[]` 可以：

- 自动生成 OpenAI Function Calling 的 `tools` 配置；
- 自动生成 MCP 的 `tools` 描述；
- 提供内部 TypeScript 类型与前端工具调用适配。

### 4.2 核心 Chat 工具列表

**（1）发送消息与引用回复**

- `chat.send_message`
  - 入参：`{ roomId, content, replyToMessageId?: string }`
  - 行为：以当前 Agent 身份在房间发送一条消息；如果有 `replyToMessageId`，UI 显示为引用回复。
  - 返回：`Message`（包含 `author`, `replyToId`, `reactions` 等）。

- `chat.reply_to_message`
  - 入参：`{ roomId, targetMessageId, content }`
  - 行为：显式对某条消息进行引用回复（`replyToId = targetMessageId`）。
  - 返回：`Message`。

**（2）点赞 / Reaction**

- `chat.react_to_message`
  - 入参：`{ roomId, messageId, reactionType: 'like' | string }`
  - 行为：对指定消息添加 / 修改 Reaction；Agent 点赞使用这个工具。
  - 返回：更新后的 `Message.reactions` 或完整 `Message`。

**（3）历史与上下文**

- `chat.get_message_context`
  - 入参：`{ roomId, messageId, before: number, after: number }`
  - 返回：
    - `focus: Message`（目标消息）
    - `beforeMessages: Message[]`
    - `afterMessages: Message[]`
  - 用途：用户点“让 AI 针对这句回答”时，Agent 使用该工具获取上下文。

- `chat.get_recent_history`
  - 入参：`{ roomId, limit: number }`
  - 返回：最近 N 条 `Message[]`，包含作者、回复关系、reactions。

- `chat.get_long_context`
  - 入参：`{ roomId, maxTokensOrMessages?: number }`
  - 返回：
    - `shortTermMessages: Message[]`（最近一段完整消息）
    - `summaryBlocks: { summary: string; fromMessageId: string; toMessageId: string }[]`
    - `participantsSnapshot: Participant[]`
  - 用途：为 LLM 提供「长期摘要 + 短期上下文」的标准输入。

**（4）参与者与 Agent 身份**

- `chat.get_room_participants`
  - 入参：`{ roomId }`
  - 返回：`Participant[]`，包括真人与 Agent。

- `chat.get_agent_profile`
  - 入参：`{ agentId }`
  - 返回：Agent 的身份信息 / 描述（便于 LLM理解“我是谁、我在群中的角色是什么”）。

### 4.3 前端工具（UI / 数据）与 Agent 兼容

除了服务器侧的 Chat 工具，还可以将前端能力抽象为工具，方便 Agent 驱动 UI：

- UI 工具（`scope: 'client'`）：
  - `ui.highlight_message({ messageId })`：高亮某条消息；
  - `ui.scroll_to_message({ messageId })`：滚动到某条消息；
  - `ui.open_user_profile({ userId })`：打开用户详情侧栏；
  - `ui.show_tip({ type, text })`：显示小提示。

- 数据工具（前端发起 API，再更新 UI）：
  - `data.search_messages({ roomId, query })`；
  - `data.filter_messages({ roomId, filterType })`（如未读 / 被提及）。

前端维护自己的 `ToolRegistry`，监听从服务器下发的 `ToolInvocation`（如通过 SSE/WebSocket），执行对应 handler，并可将结果回传服务器，供 Agent 继续决策。

---

## 5. Agent 行为设计：主动 / 被动 / 点赞 / 引用

### 5.1 被动回答（用户主动触发）

触发方式：

- `/` 命令：
  - `/ai ...`、`/summary` 等，在 `MessageInput.tsx` 解析为 `command` 或 `targetAgentId`；
  - 服务器收到后，直接路由到对应 Agent，不再做是否触发的判定。

- `@` 提及 Agent：
  - 输入 `@` 弹出用户 + Agent 列表；
  - 发送时附带 `mentions` / `targetAgentId` 字段；
  - 服务器解析后构造 `AgentEvent` 交给对应 Agent。

- 消息上的“问 AI”按钮：
  - 在 `MessageContent.tsx` 的 hover 操作区提供按钮；
  - 点击后要么在输入框插入 `/ai` 命令 + 引用，要么直接调用服务器 API；
  - Agent 端通过 `chat.get_message_context` 拿到上下文，再调用 `chat.reply_to_message` 输出。

### 5.2 主动回答（Agent 自动插话）

逻辑：

- 每次 `message_created`：
  - 先用规则判断是否为潜在问题（疑问句、关键词、是否已被回复等）；
  - 如不确定，再调用 `classifyMessage` 做简单分类，得到 `should_answer` / `priority`。
- 满足条件且未超过节流：
  - Agent 使用 `chat.get_long_context` 或 `chat.get_recent_history` 获取上下文；
  - 调用 LLM 得到回答；
  - 通过 `chat.send_message` 发出回复。

节流策略：

- 针对同一房间 / 用户，在一定时间窗口内 Agent 只能主动插话有限次；
- 避免“刷屏型” AI 干扰正常聊天节奏。

### 5.3 主动点赞（Reaction）

- `CheerAgent` 或具备 `like` 能力的 Agent 监听 `message_created`：
  - 使用 `classifyMessage` 或启发式规则判断 `should_like`；
  - 满足条件时调用 `chat.react_to_message({ reactionType: 'like' })`。

- 前端在 `MessageContent.tsx`：
  - 展示所有 reactions；
  - 对 `isFromAgent === true` 的点赞使用特殊视觉效果（机器人 icon / tooltip）。

---

## 6. 长上下文与房间记忆

### 6.1 RoomMemory 结构

- `RoomMemory`
  - `roomId: string`
  - `shortTermMessages: Message[]`（最近 N 条消息的缓存）
  - `summaryBlocks: { summary: string; fromMessageId: string; toMessageId: string }[]`
  - `lastUpdatedAt: number`

### 6.2 相关工具与 Agent

- 工具：
  - `chat.get_long_context`（读）；
  - `chat.update_room_summary`（写，通常由 SummarizerAgent 调用）。

- SummarizerAgent：
  - 当对话长度过长 / 时间间隔达到阈值时，对最近一段消息做总结；
  - 调用 `chat.update_room_summary` 写入新的 summary block；
  - 也可以通过 `chat.send_message` 在房间里发布总结消息。

### 6.3 Agent 如何“知道谁说了什么”

- 约束：
  - 所有工具返回的 `Message` 中都携带完整 `author` 对象；
  - 长上下文工具返回时同时提供 `participantsSnapshot`（房间参与者列表）。

- Agent 在构造 LLM 输入时：
  - 可以将消息序列格式化为：
    - `[时间][作者名][类型 user/agent]: 内容`；
  - 或通过工具返回的结构进行更精细的提示（例如在 system prompt 中解释不同角色的含义）。

---

## 7. 多 Agent 框架与多模型兼容

### 7.1 工具层不变，运行时可插拔

- Chat 系统维护一套稳定的 Chat Tool API（本方案第 4 章）。
- 不同 Agent 运行时可以采用不同方式使用工具：
  - 内置 Agent：直接调用本进程内的 `ToolRegistry.invoke`；
  - 使用 Function Calling 的 Agent：通过 OpenAI tools 调用；
  - MCP Agent：通过 MCP 协议调用相同工具。

### 7.2 Function Calling 适配

- 将 `ToolDefinition[]` 转成 OpenAI `tools`：
  - `name` → function 名；
  - `description` → function 描述；
  - `inputSchema` → `parameters`。
- LLM 返回 `tool_calls` 后：
  - 由适配层解析成 `ToolInvocation`；
  - 调用 `ToolRegistry.invoke`；
  - 将 `ToolResult` 转成 `tool` 消息，再继续喂给 LLM，直到模型给出最终自然语言回复或结束。

### 7.3 MCP 适配

- 将同一批工具包装成 MCP server 的 `tools`：
  - 名称与 schema 一致；
  - 内部实现仍调用 `ToolRegistry`。
- 外部 Agent runtime：
  - 通过 MCP `tools/list` 获取可用工具；
  - 通过 MCP `tools/call` 调用，例如 `chat.send_message` / `chat.react_to_message` 等；
  - 由 Chat 系统负责在房间内展示这些行为。

### 7.4 Agent 注册与发现

- Chat 后端提供：
  - `GET /agents/tools`：返回全部 ToolDefinition 列表；
  - `POST /agents/register`：注册新 Agent（id、名称、可用工具、触发类型等）。
- `AgentManager`：
  - 只负责事件分发和 Agent 触发；
  - 至于 Agent 内部是 Function Calling 还是 MCP，不做硬编码。

---

## 8. 前端改造要点（ChatContext / MessageInput / MessageContent）

### 8.1 ChatContext：数据模型与事件流

- 扩展 `Message` 类型：
  - 支持 `author` 对象、`replyToId`、`reactions` 等；
  - 在消息流（SSE/WebSocket/轮询）中接收：
    - 新的 Agent 消息；
    - Reaction 事件。

- 将 Agent 视为参与者：
  - `participants` 列表中包含 `type = 'agent'` 的成员；
  - 头像与名称由后端配置。

### 8.2 MessageContent：显示 Agent 行为

- 根据 `message.author.type` 控制样式：
  - `user`：现有气泡样式；
  - `agent`：略微差异的背景颜色 + “AI” 角标 + 机器人头像；
  - `system`：系统提示的轻量样式。

- Reaction 展示：
  - 在消息底部显示点赞 / 其他表情；
  - 对 `isFromAgent` 的 Reaction 用特殊 icon 或 tooltip 标识。

- 消息级别操作：
  - 在 hover 区添加“问 AI”按钮；
  - 点击后触发对应 API 或自动填入 `/ai` 命令 + 引用。

### 8.3 MessageInput：命令与 @ 提及

- `/` 命令提示：
  - 输入 `/` 时弹出命令列表（`/ai`, `/summary`, `/debug` 等）；
  - 选择后填入输入框，并在发送 payload 中附上 `command`。

- `@` 提及：
  - 输入 `@` 时列出用户 + Agent；
  - `@AgentName` 时发送 payload 包含 `targetAgentId` / `mentions`。

---

## 9. 分阶段实施路线图

### Phase 1：基础 LLM 接入 + 被动回答

- 实现 `llmClient` 与一个简单 `HelperAgent`：
  - 支持 `/ai` 命令和 `@助手名`；
  - 不做主动插话和点赞。
- 实现最小版本 Chat Tool API：
  - `chat.send_message`、`chat.reply_to_message`、`chat.get_recent_history`。
- 前端：
  - 支持 Agent 消息的展示与基本命令触发。

### Phase 2：Agent 框架化 + 点赞 + 引用回复工具化

- 抽象 `AgentManager` 与完整 Chat Tool API：
  - 加入 `chat.react_to_message`、`chat.get_message_context`。
- 实现 `CheerAgent` 点赞逻辑；
- 打通「消息上点按钮 → Agent 引用回复」的完整链路。

### Phase 3：长上下文 / RoomMemory + 多运行时适配

- 实现 `RoomMemory`、`chat.get_long_context`、`chat.update_room_summary`；
- 引入 `SummarizerAgent`；
- 添加：
  - Function Calling 适配（根据 ToolDefinition 自动生成 tools）；
  - MCP 适配（将 Chat Tool API 作为 MCP tools 暴露）。

---

通过上述设计：

- 聊天业务（消息、引用、点赞、上下文）被清晰地抽象为一层 Chat Tool API；
- Agent 像人一样在群里聊天，但其行为本质是「调用工具」；
- 不同大模型和 Agent 框架只要能“发现工具并调用”，就可以接入并参与群聊，对未来扩展 MCP、多模型、多 Agent 运行时非常友好。

