"""
In-memory per-IP rate limiting.

Pluggable backend: currently dict-based, can be swapped to Redis.
"""

import time
from config import get_settings

_settings = get_settings()
_rate_store: dict = {}


def is_rate_limited(ip: str) -> bool:
    """Check if an IP has exceeded the rate limit within the current window."""
    now = time.time()
    timestamps = _rate_store.get(ip, [])
    timestamps = [t for t in timestamps if now - t < _settings.rate_window]
    if len(timestamps) >= _settings.rate_limit:
        _rate_store[ip] = timestamps
        return True
    timestamps.append(now)
    _rate_store[ip] = timestamps
    return False
