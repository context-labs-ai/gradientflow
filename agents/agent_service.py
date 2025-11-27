# -*- coding: utf-8 -*-
"""
Agent Service - 轮询消息并响应 @ 提及
"""
import re
import time
import threading
import requests
from typing import Optional
from query import chat_with_history, configure as configure_llm


def strip_special_tags(text: str) -> str:
    """提取最终回复，移除 thinking/analysis 部分"""
    if not text:
        return ""

    # 格式: <|channel|>analysis<|message|>...<|end|><|start|>assistant<|channel|>final<|message|>真正回答
    # 尝试提取 final 消息
    final_match = re.search(
        r"<\|channel\|>final<\|message\|>(.*?)(?:<\|end\|>|$)", text, flags=re.DOTALL
    )
    if final_match:
        text = final_match.group(1)

    # 移除 <think>...</think>
    text = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL)
    # 移除剩余的特殊标签
    text = re.sub(r"<\|[^>]+\|>", "", text)
    # 清理多余空行
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()

# 配置
API_BASE = "http://localhost:4000"
AGENT_TOKEN = "dev-agent-token"  # 与 server 的 AGENT_API_TOKEN 保持一致
AGENT_ID = "helper-agent-1"  # 默认 Agent ID
POLL_INTERVAL = 1  # 轮询间隔（秒）
HEARTBEAT_INTERVAL = 5  # 心跳间隔（秒）
CONVERSATION_ID = "global"

# Agent 的 User ID（从 data.json 获取）
AGENT_USER_ID = "llm1"


class AgentService:
    def __init__(
        self,
        api_base: str = API_BASE,
        agent_token: str = AGENT_TOKEN,
        agent_id: str = AGENT_ID,
        agent_user_id: str = AGENT_USER_ID,
    ):
        self.api_base = api_base
        self.agent_token = agent_token
        self.agent_id = agent_id
        self.agent_user_id = agent_user_id
        self.last_seen_timestamp = int(time.time() * 1000)
        self.processed_message_ids = set()
        # Agent 配置（从后端获取）
        self.agent_config = None

    def get_headers(self) -> dict:
        """获取 API 请求头"""
        return {
            "Content-Type": "application/json",
            "X-Agent-Token": self.agent_token,
        }

    def login(self, email: str, password: str) -> Optional[str]:
        """登录获取 JWT token"""
        try:
            resp = requests.post(
                f"{self.api_base}/auth/login",
                json={"email": email, "password": password},
                timeout=10,
            )
            if resp.status_code == 200:
                # 从 cookie 获取 token
                token = resp.cookies.get("token")
                if token:
                    self.jwt_token = token
                    print(f"[Agent] 登录成功")
                    return token
            print(f"[Agent] 登录失败: {resp.status_code}")
            return None
        except Exception as e:
            print(f"[Agent] 登录异常: {e}")
            return None

    def fetch_agent_config(self) -> Optional[dict]:
        """从后端获取 Agent 配置"""
        headers = {}
        if hasattr(self, "jwt_token") and self.jwt_token:
            headers["Authorization"] = f"Bearer {self.jwt_token}"

        try:
            resp = requests.get(
                f"{self.api_base}/agents",
                headers=headers,
                timeout=10,
            )
            if resp.status_code == 200:
                data = resp.json()
                agents = data.get("agents", [])
                # 找到当前 agent
                for agent in agents:
                    if agent.get("id") == self.agent_id:
                        self.agent_config = agent
                        # 如果是 parallax provider，配置 LLM client
                        model = agent.get("model", {})
                        runtime = agent.get("runtime", {})
                        if model.get("provider") == "parallax":
                            base_url = runtime.get("endpoint")
                            api_key = runtime.get("apiKeyAlias") or "not-needed"
                            if base_url:
                                configure_llm(base_url=base_url, api_key=api_key)
                                print(f"[Agent] 已配置 parallax provider: {base_url}")
                        return agent
                print(f"[Agent] 未找到 Agent 配置: {self.agent_id}")
                return None
            else:
                print(f"[Agent] 获取 Agent 配置失败: {resp.status_code}")
                return None
        except Exception as e:
            print(f"[Agent] 获取 Agent 配置异常: {e}")
            return None

    def fetch_messages(self, since: Optional[int] = None) -> list:
        """获取消息列表"""
        params = {"conversationId": CONVERSATION_ID}
        if since:
            params["since"] = since

        # 使用 JWT token 认证
        headers = {}
        if hasattr(self, "jwt_token") and self.jwt_token:
            headers["Authorization"] = f"Bearer {self.jwt_token}"

        try:
            resp = requests.get(
                f"{self.api_base}/messages",
                params=params,
                headers=headers,
                timeout=10,
            )
            if resp.status_code == 200:
                data = resp.json()
                return data.get("messages", []), data.get("users", [])
            elif resp.status_code == 401:
                print(f"[Agent] 未授权，请先登录")
                return [], []
            else:
                print(f"[Agent] 获取消息失败: {resp.status_code} - {resp.text}")
                return [], []
        except Exception as e:
            print(f"[Agent] 请求异常: {e}")
            return [], []

    def send_heartbeat(self) -> bool:
        """发送心跳信号"""
        try:
            resp = requests.post(
                f"{self.api_base}/agents/{self.agent_id}/heartbeat",
                headers=self.get_headers(),
                timeout=5,
            )
            return resp.status_code == 200
        except Exception:
            return False

    def _heartbeat_loop(self):
        """心跳线程"""
        while self._running:
            self.send_heartbeat()
            time.sleep(HEARTBEAT_INTERVAL)

    def send_message(self, content: str, reply_to_id: Optional[str] = None) -> bool:
        """通过 Agent API 发送消息"""
        payload = {
            "content": content,
            "conversationId": CONVERSATION_ID,
        }
        if reply_to_id:
            payload["replyToId"] = reply_to_id

        try:
            resp = requests.post(
                f"{self.api_base}/agents/{self.agent_id}/messages",
                json=payload,
                headers=self.get_headers(),
                timeout=30,
            )
            if resp.status_code == 200:
                print(f"[Agent] 消息已发送: {content[:50]}...")
                return True
            else:
                print(f"[Agent] 发送失败: {resp.status_code} - {resp.text}")
                return False
        except Exception as e:
            print(f"[Agent] 发送异常: {e}")
            return False

    def is_mentioned(self, message: dict, users: list) -> bool:
        """检查消息是否 @ 了本 Agent"""
        mentions = message.get("mentions", [])
        if self.agent_user_id in mentions:
            return True

        # 也检查消息内容中是否包含 @AgentName
        content = message.get("content", "")
        # 查找 agent 对应的用户名
        for user in users:
            if user.get("id") == self.agent_user_id:
                agent_name = user.get("name", "")
                if agent_name and f"@{agent_name}" in content:
                    return True
        return False

    def build_context(self, messages: list, users: list, current_msg: dict) -> list:
        """构建对话上下文"""
        # 获取最近的消息作为上下文
        context_messages = []

        # 用户 ID -> 名称映射
        user_map = {u["id"]: u.get("name", "User") for u in users}

        # 取最近 10 条消息作为上下文
        recent = messages[-10:] if len(messages) > 10 else messages

        # 找出当前触发消息的发送者
        trigger_sender_id = current_msg.get("senderId", "")
        trigger_sender_name = user_map.get(trigger_sender_id, "User")

        for msg in recent:
            sender_id = msg.get("senderId", "")
            sender_name = user_map.get(sender_id, "User")
            # 过滤历史消息中的特殊标签
            content = strip_special_tags(msg.get("content", ""))
            # 移除 @ 标签（已完成触发作用）
            content = re.sub(r"@[\w\-\.]+\s*", "", content).strip()

            if sender_id == self.agent_user_id:
                context_messages.append({"role": "assistant", "content": content})
            else:
                # 强调发送者身份，标记是否是当前提问者
                is_trigger = msg.get("id") == current_msg.get("id")
                if is_trigger:
                    # 当前提问的消息，强调这是需要回复的
                    formatted = f"<Name: {sender_name}> [asking you]: {content}"
                else:
                    formatted = f"<Name: {sender_name}>: {content}"
                context_messages.append({"role": "user", "content": formatted})

        return context_messages

    def generate_reply(self, context: list) -> str:
        """调用 LLM 生成回复"""
        # 从配置获取系统提示词，如果没有则使用默认值
        default_system_prompt = (
            "You are a helpful AI assistant in a group chat. "
            "Respond directly and concisely to the user's message. "
            "Do NOT include any prefix like '[GPT-4]:' or your name in responses. "
            "Be friendly and helpful. You may respond in the user's language."
        )
        config_system_prompt = (
            self.agent_config.get("systemPrompt") if self.agent_config else None
        )
        system_prompt = {
            "role": "system",
            "content": config_system_prompt or default_system_prompt,
        }
        messages = [system_prompt] + context

        # 从配置获取模型参数
        model_config = self.agent_config.get("model", {}) if self.agent_config else {}
        model_name = model_config.get("name", "default")
        temperature = model_config.get("temperature", 0.6)
        max_tokens = model_config.get("maxTokens", 1024)

        # 打印完整提示词
        print(f"\n[Agent] ===== 发送给模型的提示词 =====")
        print(f"[Agent] Model: {model_name}, Temp: {temperature}, MaxTokens: {max_tokens}")
        for i, msg in enumerate(messages):
            role = msg.get("role", "unknown")
            content = msg.get("content", "")
            print(f"[{i}] {role}:")
            print(f"    {content}")
        print(f"[Agent] ===== 提示词结束 =====\n")

        try:
            response = chat_with_history(
                messages,
                model=model_name,
                max_tokens=max_tokens,
                temperature=temperature,
            )
            # 打印原始响应
            print(f"\n[Agent] ===== 原始响应 =====")
            print(response)
            print(f"[Agent] ===== 原始响应结束 =====\n")
            # 移除特殊标签
            cleaned = strip_special_tags(response)
            print(f"[Agent] 过滤后: {cleaned[:100]}...")
            return cleaned
        except Exception as e:
            print(f"[Agent] LLM 调用失败: {e}")
            return f"抱歉，我遇到了一些问题：{str(e)}"

    def process_message(self, message: dict, messages: list, users: list):
        """处理单条消息"""
        msg_id = message.get("id")
        sender_id = message.get("senderId")

        # 跳过自己发的消息
        if sender_id == self.agent_user_id:
            return

        # 跳过已处理的消息
        if msg_id in self.processed_message_ids:
            return

        # 检查是否被 @
        if not self.is_mentioned(message, users):
            return

        print(f"[Agent] 收到 @ 消息: {message.get('content', '')[:50]}...")

        # 刷新配置（确保使用最新的系统提示词和模型参数）
        self.fetch_agent_config()

        # 构建上下文
        context = self.build_context(messages, users, message)

        # 生成回复
        reply = self.generate_reply(context)

        # 发送回复
        self.send_message(reply, reply_to_id=msg_id)

        # 标记为已处理
        self.processed_message_ids.add(msg_id)

    def run(self):
        """主循环"""
        print(f"[Agent] 启动服务...")
        print(f"[Agent] API: {self.api_base}")
        print(f"[Agent] Agent ID: {self.agent_id}")
        print(f"[Agent] 轮询间隔: {POLL_INTERVAL}s")
        print(f"[Agent] 心跳间隔: {HEARTBEAT_INTERVAL}s")
        print("-" * 40)

        # 启动心跳线程
        self._running = True
        self.send_heartbeat()  # 立即发送一次心跳
        heartbeat_thread = threading.Thread(target=self._heartbeat_loop, daemon=True)
        heartbeat_thread.start()
        print("[Agent] 心跳线程已启动")

        while True:
            try:
                messages, users = self.fetch_messages()

                if messages:
                    # 只处理新消息（时间戳大于上次检查的）
                    new_messages = [
                        m
                        for m in messages
                        if m.get("timestamp", 0) > self.last_seen_timestamp
                        and m.get("id") not in self.processed_message_ids
                    ]

                    for msg in new_messages:
                        self.process_message(msg, messages, users)

                    # 更新最后检查时间
                    if messages:
                        latest_ts = max(m.get("timestamp", 0) for m in messages)
                        self.last_seen_timestamp = max(
                            self.last_seen_timestamp, latest_ts
                        )

            except Exception as e:
                print(f"[Agent] 循环异常: {e}")

            time.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Agent Service")
    parser.add_argument("--email", default="root@example.com", help="登录邮箱")
    parser.add_argument("--password", default="1234567890", help="登录密码")
    parser.add_argument("--agent-id", default=AGENT_ID, help="Agent ID")
    args = parser.parse_args()

    service = AgentService(agent_id=args.agent_id)

    # 先登录获取 token
    if service.login(args.email, args.password):
        # 获取 Agent 配置
        config = service.fetch_agent_config()
        if config:
            print(f"[Agent] 已加载配置:")
            print(f"  - 名称: {config.get('name')}")
            print(f"  - Provider: {config.get('model', {}).get('provider')}")
            print(f"  - Model: {config.get('model', {}).get('name')}")
            print(f"  - System Prompt: {config.get('systemPrompt', '')[:50]}...")
        else:
            print("[Agent] 警告: 未能加载 Agent 配置，将使用默认设置")
        service.run()
    else:
        print("[Agent] 无法启动：登录失败")