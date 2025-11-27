# -*- coding: utf-8 -*-
from openai import OpenAI
from typing import Optional

# Default configuration for parallax provider
DEFAULT_BASE_URL = "https://pxh2f5j83cope2-3005.proxy.runpod.net/v1"
DEFAULT_MODEL = "default"
DEFAULT_API_KEY = "not-needed"

# Global client instance (will be initialized on first use or via configure)
_client: Optional[OpenAI] = None
_current_config = {
    "base_url": DEFAULT_BASE_URL,
    "api_key": DEFAULT_API_KEY,
}


def configure(base_url: str = None, api_key: str = None):
    """Configure the LLM client with custom endpoint"""
    global _client, _current_config

    if base_url:
        _current_config["base_url"] = base_url
    if api_key:
        _current_config["api_key"] = api_key

    _client = OpenAI(
        base_url=_current_config["base_url"],
        api_key=_current_config["api_key"],
    )
    return _client


def get_client() -> OpenAI:
    """Get or create the OpenAI client"""
    global _client
    if _client is None:
        _client = OpenAI(
            base_url=_current_config["base_url"],
            api_key=_current_config["api_key"],
        )
    return _client


def chat(message: str, model: str = DEFAULT_MODEL, max_tokens: int = 1024) -> str:
    """Send a message and get response"""
    client = get_client()
    response = client.chat.completions.create(
        model=model,
        max_tokens=max_tokens,
        messages=[{"role": "user", "content": message}],
    )
    return response.choices[0].message.content


def chat_with_history(
    messages: list,
    model: str = DEFAULT_MODEL,
    max_tokens: int = 1024,
    temperature: float = 0.6,
) -> str:
    """Chat with message history"""
    client = get_client()
    response = client.chat.completions.create(
        model=model,
        max_tokens=max_tokens,
        temperature=temperature,
        messages=messages,
    )
    return response.choices[0].message.content


if __name__ == "__main__":
    result = chat("1+1=?")
    print(result)