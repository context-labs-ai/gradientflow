# Agent Service

Python-based agent service that connects to the chat backend and responds to @ mentions.

## Architecture

```
                      poll messages
                  ←
  Chat Backend                             Agent Service
  (Express.js)   →                         (Python)
  localhost:4000      send replies
       ↑                                         ↓
       |                                         |
       └── fetch agent config ──────────────────→|
                                                 ↓
                                            LLM Backend
                                            (parallax/openai)
```

## Files

| File | Description |
|------|-------------|
| `agent_service.py` | Main agent service - polls messages, detects @mentions, generates replies |
| `query.py` | LLM client - handles communication with your model backend (supports dynamic configuration) |
| `requirements.txt` | Python dependencies |

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Configure agent in the frontend (Agent 配置中心):
   - Set Provider to `parallax` (or other)
   - Set Endpoint URL in "Endpoint / MCP URL" field
   - Set model name, temperature, max tokens
   - Set system prompt

3. Ensure the chat backend is running:
```bash
# In project root
npm run server
```

## Usage

Start the agent service:
```bash
python agent_service.py
```

With specific agent ID:
```bash
python agent_service.py --agent-id helper-agent-1
```

With custom credentials:
```bash
python agent_service.py --email user@example.com --password yourpassword --agent-id my-agent
```

## Configuration

### Frontend Configuration (Recommended)

Configure your agent via the web UI (Agent 配置中心). The agent service will automatically fetch:

| Setting | Description |
|---------|-------------|
| System Prompt | The system message sent to the LLM |
| Provider | `parallax`, `openai`, `azure`, `anthropic`, `custom` |
| Model Name | Model identifier (e.g., `default`, `gpt-4o-mini`) |
| Temperature | Response randomness (0.0 - 2.0) |
| Max Tokens | Maximum response length |
| Endpoint | LLM API endpoint URL (for parallax provider) |
| API Key Alias | Optional API key identifier |

### Environment Variables (agent_service.py)

| Variable | Default | Description |
|----------|---------|-------------|
| `API_BASE` | `http://localhost:4000` | Chat backend URL |
| `AGENT_TOKEN` | `dev-agent-token` | Agent API authentication token |
| `AGENT_ID` | `helper-agent-1` | Agent ID (must exist in backend) |
| `AGENT_USER_ID` | `llm1` | User ID associated with the agent |
| `POLL_INTERVAL` | `3` | Seconds between message polls |
| `HEARTBEAT_INTERVAL` | `5` | Seconds between heartbeat signals |

## How It Works

1. **Login**: Authenticates with the chat backend to get JWT token
2. **Fetch Config**: Retrieves agent configuration from `/agents` API
3. **Configure LLM**: If provider is `parallax`, configures LLM client with endpoint URL
4. **Heartbeat**: Sends periodic heartbeat to signal the service is online
5. **Poll**: Fetches new messages every `POLL_INTERVAL` seconds
6. **Detect @**: Checks if messages mention this agent (via `mentions` field or `@AgentName` in content)
7. **Build Context**: Collects recent messages as conversation context
8. **Generate Reply**: Sends context to LLM with configured parameters
9. **Send**: Posts reply via `/agents/:agentId/messages` API

## Message Format

### Input to LLM

```python
[
    {"role": "system", "content": "You are a helpful AI assistant..."},  # From config
    {"role": "user", "content": "<Name: Alice>: Hello everyone"},
    {"role": "user", "content": "<Name: Bob>: The weather is nice"},
    {"role": "assistant", "content": "Yes, perfect for a walk!"},
    {"role": "user", "content": "<Name: Yuzhi> [asking you]: What is 1+1?"},
]
```

### Response Processing

The service automatically strips special tags from LLM responses:
- `<think>...</think>` - Thinking/reasoning blocks
- `<|channel|>analysis<|message|>...<|end|>` - Analysis channels
- Extracts content from `<|channel|>final<|message|>...` if present

## Logging

The service logs detailed information including full prompts and responses:

```
[Agent] 启动服务...
[Agent] API: http://localhost:4000
[Agent] Agent ID: helper-agent-1
[Agent] 已配置 parallax provider: https://your-endpoint/v1
[Agent] 已加载配置:
  - 名称: AI助手
  - Provider: parallax
  - Model: default
  - System Prompt: You are a helpful AI assistant...
----------------------------------------
[Agent] 收到 @ 消息: who are you...

[Agent] ===== 发送给模型的提示词 =====
[Agent] Model: default, Temp: 0.6, MaxTokens: 1024
[0] system:
    You are a helpful AI assistant...
[1] user:
    <Name: Yuzhi> [asking you]: who are you
[Agent] ===== 提示词结束 =====

[Agent] ===== 原始响应 =====
<think>The user is asking...</think>
Hi! I'm your friendly AI assistant.
[Agent] ===== 原始响应结束 =====

[Agent] 过滤后: Hi! I'm your friendly AI assistant....
[Agent] 消息已发送: Hi! I'm your friendly AI assistant....
```

## Parallax Provider

The `parallax` provider is designed for custom OpenAI-compatible LLM endpoints:

1. In frontend, select Provider: `parallax`
2. Set Endpoint URL: `https://your-llm-endpoint/v1`
3. Model name defaults to `default` (can be customized)
4. API key is optional (defaults to `not-needed`)

The agent service will automatically configure the LLM client with these settings.

## Extending

### Multiple Agents

Run multiple instances with different agent IDs:

```bash
# Terminal 1
python agent_service.py --agent-id agent-1

# Terminal 2
python agent_service.py --agent-id agent-2
```

Each agent will fetch its own configuration from the backend.

### Context Window Size

Change the number of recent messages included in `build_context()`:

```python
# In build_context()
recent = messages[-20:]  # Last 20 messages instead of 10
```

### Custom LLM Configuration

For programmatic configuration, use `query.py`:

```python
from query import configure, chat_with_history

# Configure endpoint
configure(base_url="https://your-endpoint/v1", api_key="your-key")

# Use the client
response = chat_with_history(messages, model="your-model", temperature=0.7)
```