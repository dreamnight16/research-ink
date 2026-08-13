from dataclasses import dataclass
from enum import StrEnum

import httpx


class Provider(StrEnum):
    OLLAMA = "ollama"
    CLAUDE = "claude"
    DEEPSEEK = "deepseek"
    OPENAI = "openai"


@dataclass
class LLMRouter:
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "qwen3:14b"
    cloud_provider: str = ""
    cloud_api_key: str = ""
    cloud_model: str = ""
    _has_cloud: bool = False

    # 允许的 Ollama URL 模式（防 SSRF）
    _ALLOWED_OLLAMA_PATTERNS = [
        "http://localhost:", "http://127.0.0.1:",
        "https://localhost:", "https://127.0.0.1:",
    ]

    def __post_init__(self):
        # 验证 Ollama URL 不指向外部（防 SSRF）
        url_lower = self.ollama_base_url.lower()
        if not any(url_lower.startswith(p) for p in self._ALLOWED_OLLAMA_PATTERNS):
            raise ValueError(
                f"ollama_base_url ({self.ollama_base_url}) is not a local address. "
                f"External URLs are blocked to prevent SSRF attacks."
            )
        self._has_cloud = bool(self.cloud_provider and self.cloud_api_key)
        self._http_client: httpx.AsyncClient | None = None

    def _get_client(self) -> httpx.AsyncClient:
        if self._http_client is None:
            self._http_client = httpx.AsyncClient()
        return self._http_client

    async def close(self) -> None:
        if self._http_client is not None:
            await self._http_client.aclose()
            self._http_client = None

    def select(
        self,
        classification: str,
        cloud_approved: bool = False,
    ) -> Provider:
        if classification == "secret":
            return Provider.OLLAMA
        if not self._has_cloud:
            return Provider.OLLAMA
        if classification == "public":
            return self._provider_for(self.cloud_provider)
        if classification == "cautious" and cloud_approved:
            return self._provider_for(self.cloud_provider)
        return Provider.OLLAMA

    def _provider_for(self, name: str) -> Provider:
        try:
            return Provider(name.lower())
        except ValueError:
            return Provider.OLLAMA

    async def chat(
        self,
        provider: Provider,
        messages: list[dict[str, str]],
        retries: int = 1,
    ) -> str:
        import asyncio
        import logging
        logger = logging.getLogger(__name__)
        last_error: Exception | None = None
        for attempt in range(retries + 1):
            try:
                if provider == Provider.OLLAMA:
                    return await self._ollama_chat(messages)
                if provider == Provider.CLAUDE:
                    return await self._claude_chat(messages)
                if provider == Provider.OPENAI:
                    return await self._openai_chat(messages)
                if provider == Provider.DEEPSEEK:
                    return await self._deepseek_chat(messages)
                raise ValueError(f"Unknown provider: {provider}")
            except Exception as e:
                last_error = e
                if attempt < retries:
                    logger.warning(
                        "LLM call failed (attempt %d/%d): %s",
                        attempt + 1, retries + 1, e,
                    )
                    await asyncio.sleep(2 ** attempt)
                else:
                    logger.error("LLM call failed after %d attempts: %s", retries + 1, e)
        raise last_error  # type: ignore[misc]

    async def _ollama_chat(self, messages: list[dict[str, str]]) -> str:
        client = self._get_client()
        resp = await client.post(
            f"{self.ollama_base_url}/api/chat",
            json={"model": self.ollama_model, "messages": messages, "stream": False},
            timeout=120.0,
        )
        resp.raise_for_status()
        return str(resp.json()["message"]["content"])

    async def _claude_chat(self, messages: list[dict[str, str]]) -> str:
        system = ""
        user_messages = []
        for m in messages:
            if m["role"] == "system":
                system = m["content"]
            else:
                user_messages.append(m)

        client = self._get_client()
        resp = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": self.cloud_api_key,
                "anthropic-version": "anthropic-2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": self.cloud_model,
                "max_tokens": 4096,
                "system": system,
                "messages": user_messages,
            },
            timeout=120.0,
        )
        resp.raise_for_status()
        data = resp.json()
        return str(data["content"][0]["text"])

    async def _openai_chat(self, messages: list[dict[str, str]]) -> str:
        client = self._get_client()
        resp = await client.post(
            "https://api.openai.com/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {self.cloud_api_key}",
                "Content-Type": "application/json",
            },
            json={"model": self.cloud_model, "messages": messages},
            timeout=120.0,
        )
        resp.raise_for_status()
        return str(resp.json()["choices"][0]["message"]["content"])

    async def _deepseek_chat(self, messages: list[dict[str, str]]) -> str:
        client = self._get_client()
        resp = await client.post(
            "https://api.deepseek.com/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {self.cloud_api_key}",
                "Content-Type": "application/json",
            },
            json={"model": self.cloud_model, "messages": messages},
            timeout=120.0,
        )
        resp.raise_for_status()
        return str(resp.json()["choices"][0]["message"]["content"])
