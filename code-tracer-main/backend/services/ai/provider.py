"""
Groq AI Provider — OpenAI-compatible client with multi-key rotation.

Uses the official OpenAI SDK pointed at Groq's endpoint.
Supports multiple API keys (GROQ_API_KEY_1 … GROQ_API_KEY_5) with automatic
round-robin fallback when a key hits its rate limit.
Falls back gracefully when no keys are configured.
"""

import logging
import os
import re as _re
import time
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)


# ── Sanitize error messages — never leak API keys to the client ────────
_KEY_PATTERNS = [
    _re.compile(r"gsk_[A-Za-z0-9]{20,}"),           # Groq API keys
    _re.compile(r"sk-[A-Za-z0-9]{20,}"),             # OpenAI-style keys
    _re.compile(r"sk-or-v1-[A-Za-z0-9]{20,}"),       # OpenRouter keys
    _re.compile(r"key[=:]\s*['\"]?[A-Za-z0-9_\-]{20,}['\"]?", _re.IGNORECASE),
]


def _sanitize_error(msg: str) -> str:
    """Strip API keys and other secrets from an error string."""
    sanitized = str(msg)
    for pat in _KEY_PATTERNS:
        sanitized = pat.sub("[REDACTED]", sanitized)
    return sanitized


# ── Multi-key management ──────────────────────────────────────────────
_MODEL = os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile")

# Cooldown period (seconds) before retrying a rate-limited key
_KEY_COOLDOWN_SECONDS = 60


class _KeyPool:
    """
    Manages a pool of Groq API keys with automatic rotation.

    Keys are loaded from environment variables:
      GROQ_API_KEY_1, GROQ_API_KEY_2, … GROQ_API_KEY_5

    If none of those are set, falls back to the single GROQ_API_KEY variable
    for backward compatibility.

    When a key hits a rate limit, it's marked with a cooldown timestamp
    and the next available key is used instead.
    """

    def __init__(self):
        self._keys: List[str] = []
        self._clients: Dict[int, Any] = {}  # index -> AsyncOpenAI client
        self._cooldowns: Dict[int, float] = {}  # index -> timestamp when usable again
        self._current_index: int = 0
        self._initialized: bool = False

    def _load_keys(self):
        """Load API keys from environment variables."""
        if self._initialized:
            return

        self._initialized = True

        # Try numbered keys first: GROQ_API_KEY_1 … GROQ_API_KEY_5
        for i in range(1, 6):
            key = os.environ.get(f"GROQ_API_KEY_{i}", "").strip()
            if key:
                self._keys.append(key)

        # Fallback to single GROQ_API_KEY for backward compatibility
        if not self._keys:
            single_key = os.environ.get("GROQ_API_KEY", "").strip()
            if single_key:
                self._keys.append(single_key)

        if self._keys:
            logger.info(f"Groq key pool initialized with {len(self._keys)} key(s)")
        else:
            logger.warning("No Groq API keys found — AI features will be disabled")

    def _create_client(self, index: int):
        """Create an AsyncOpenAI client for the key at the given index."""
        if index in self._clients:
            return self._clients[index]

        try:
            from openai import AsyncOpenAI

            base_url = os.environ.get("GROQ_BASE_URL", "https://api.groq.com/openai/v1")
            client = AsyncOpenAI(
                api_key=self._keys[index],
                base_url=base_url,
            )
            self._clients[index] = client
            logger.info(f"Groq client created for key #{index + 1} (model={_MODEL})")
            return client
        except ImportError:
            logger.error("openai package not installed — run: pip install openai")
            return None
        except Exception as exc:
            logger.error(f"Failed to create Groq client for key #{index + 1}: {exc}")
            return None

    def mark_rate_limited(self, index: int):
        """Mark a key as rate-limited with a cooldown period."""
        until = time.time() + _KEY_COOLDOWN_SECONDS
        self._cooldowns[index] = until
        logger.warning(
            f"Key #{index + 1} rate-limited — cooling down for {_KEY_COOLDOWN_SECONDS}s"
        )

    def _is_available(self, index: int) -> bool:
        """Check if a key has cleared its cooldown."""
        cooldown_until = self._cooldowns.get(index, 0)
        return time.time() >= cooldown_until

    def get_client(self) -> Optional[Tuple[Any, int]]:
        """
        Get the next available client, skipping rate-limited keys.

        Returns:
            (client, key_index) or None if no keys are available.
        """
        self._load_keys()

        if not self._keys:
            return None

        n = len(self._keys)
        # Try each key starting from the current index
        for attempt in range(n):
            idx = (self._current_index + attempt) % n
            if self._is_available(idx):
                client = self._create_client(idx)
                if client is not None:
                    self._current_index = idx
                    return client, idx

        # All keys are on cooldown — find the one that clears soonest
        soonest_idx = min(self._cooldowns, key=self._cooldowns.get)
        remaining = self._cooldowns[soonest_idx] - time.time()
        logger.warning(
            f"All {n} keys are rate-limited. "
            f"Key #{soonest_idx + 1} clears in {remaining:.0f}s"
        )
        return None

    @property
    def key_count(self) -> int:
        self._load_keys()
        return len(self._keys)

    @property
    def has_keys(self) -> bool:
        self._load_keys()
        return len(self._keys) > 0


# Global key pool instance
_pool = _KeyPool()


def is_ai_available() -> bool:
    """Check if the AI provider is configured and usable."""
    return _pool.has_keys


async def ask_ai(
    messages: List[Dict[str, str]],
    temperature: float = 0.3,
    max_tokens: int = 700,
    model: Optional[str] = None,
) -> Tuple[str, Dict[str, Any]]:
    """
    Send a chat completion request to Groq with automatic key rotation.

    If the current key hits a rate limit, the request is retried with the
    next available key in the pool.

    Returns:
        (response_text, usage_dict)

    Raises:
        RuntimeError if the AI provider is unavailable or all keys are exhausted.
    """
    if not _pool.has_keys:
        raise RuntimeError(
            "AI provider is not available (no GROQ_API_KEY or GROQ_API_KEY_1..5 configured)"
        )

    chosen_model = model or _MODEL
    last_error = None

    # Try up to key_count times (once per available key)
    for _attempt in range(_pool.key_count):
        result = _pool.get_client()
        if result is None:
            break

        client, key_idx = result

        try:
            response = await client.chat.completions.create(
                model=chosen_model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
            )

            text = response.choices[0].message.content or ""
            usage = {}
            if response.usage:
                usage = {
                    "prompt_tokens": response.usage.prompt_tokens,
                    "completion_tokens": response.usage.completion_tokens,
                    "total_tokens": response.usage.total_tokens,
                }

            logger.info(
                f"ai.response | key=#{key_idx + 1} model={chosen_model} "
                f"tokens={usage.get('total_tokens', '?')} "
                f"response_len={len(text)}"
            )
            return text, usage

        except Exception as exc:
            safe_msg = _sanitize_error(str(exc))
            exc_lower = safe_msg.lower()

            is_rate_limit = any(
                kw in exc_lower
                for kw in ("rate_limit", "rate limit", "quota", "429", "insufficient_quota")
            )

            if is_rate_limit and _pool.key_count > 1:
                # Mark this key as rate-limited and try the next one
                _pool.mark_rate_limited(key_idx)
                _pool._current_index = (key_idx + 1) % _pool.key_count
                last_error = exc
                logger.info(
                    f"ai.rate_limit | key=#{key_idx + 1} — rotating to next key"
                )
                continue

            # Non-rate-limit error or single key — raise immediately
            logger.error(f"ai.error | key=#{key_idx + 1} model={chosen_model} error={safe_msg}")

            if is_rate_limit:
                raise RuntimeError(
                    "AI rate limit reached — please wait a moment and try again."
                ) from exc

            raise RuntimeError(f"AI request failed: {safe_msg}") from exc

    # All keys exhausted
    raise RuntimeError(
        "AI rate limit reached on all keys — please wait a moment and try again."
    ) from last_error
