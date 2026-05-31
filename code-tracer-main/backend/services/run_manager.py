"""
Active run tracking, concurrency control, and cancellation.
"""

import asyncio
import re
import time
import threading
import uuid
from dataclasses import dataclass, field
from typing import Dict, Optional

from config import get_settings

_settings = get_settings()


@dataclass
class ActiveRun:
    run_id: str
    mode: str  # 'sandbox' | 'local'
    container_name: Optional[str] = None
    cancel_flag: asyncio.Event = field(default_factory=asyncio.Event)
    local_cancel_flag: threading.Event = field(default_factory=threading.Event)
    created_at: float = field(default_factory=time.time)


# ── Global state ──
_active_runs: Dict[str, ActiveRun] = {}
_active_runs_lock = asyncio.Lock()
_container_semaphore = asyncio.Semaphore(_settings.max_concurrent)


def sanitize_run_id(run_id: str) -> str:
    """Docker container name constraints: keep only [a-zA-Z0-9_-]."""
    token = re.sub(r"[^A-Za-z0-9_-]", "", run_id or "")
    return token[:24] or uuid.uuid4().hex[:24]


def container_name_for_run(run_id: str) -> str:
    return f"ct-sandbox-{sanitize_run_id(run_id).lower()}"


async def register_run(run_id: str, mode: str) -> ActiveRun:
    """Register a new active run and return its handle."""
    container_name = container_name_for_run(run_id) if mode == "sandbox" else None
    handle = ActiveRun(run_id=run_id, mode=mode, container_name=container_name)
    async with _active_runs_lock:
        _active_runs[run_id] = handle
    return handle


async def unregister_run(run_id: str, handle: ActiveRun):
    """Remove a run from the active registry."""
    async with _active_runs_lock:
        if _active_runs.get(run_id) is handle:
            _active_runs.pop(run_id, None)


async def cancel_run(run_id: str) -> Optional[str]:
    """Cancel an active run. Returns the container name if applicable."""
    async with _active_runs_lock:
        handle = _active_runs.get(run_id)
        if handle:
            handle.cancel_flag.set()
            handle.local_cancel_flag.set()
            return handle.container_name
    return None


def get_semaphore() -> asyncio.Semaphore:
    return _container_semaphore
