"""
Docker sandbox execution — runs user code inside an isolated container.
"""

import asyncio
import json
import logging
import os
import tempfile
import time
from typing import Optional

from config import get_settings
from .base import (
    TraceResult,
    get_source_filename,
    truncate_output,
    canceled_result,
    error_result,
)
from services.run_manager import sanitize_run_id

logger = logging.getLogger(__name__)
_settings = get_settings()


async def run_in_sandbox(
    code: str,
    language: str,
    *,
    run_id: str,
    container_name: str,
    cancel_flag: Optional[asyncio.Event] = None,
) -> TraceResult:
    """Execute code inside a Docker sandbox container with full isolation."""
    source_file = get_source_filename(code, language)
    request_id = sanitize_run_id(run_id)[:12]
    cancel_flag = cancel_flag or asyncio.Event()

    with tempfile.TemporaryDirectory() as tmpdir:
        # Write source code
        src_path = os.path.join(tmpdir, source_file)
        with open(src_path, "w") as f:
            f.write(code)

        # Build hardened docker command
        docker_cmd = [
            "docker", "run",
            "--rm",
            "--name", container_name,

            # ── Network isolation ──
            "--network", "none",

            # ── Resource limits ──
            "--memory", _settings.docker_memory,
            "--memory-swap", _settings.docker_memory,
            "--cpus", _settings.docker_cpus,
            "--pids-limit", _settings.docker_pids_limit,

            # ── Filesystem isolation ──
            "--read-only",
            "--tmpfs", "/tmp:size=32m,noexec,nosuid,nodev",

            # ── Privilege restriction ──
            "--security-opt", "no-new-privileges",
            "--cap-drop", "ALL",
            "--cap-add", "SYS_PTRACE",

            # ── Container timeout ──
            "--stop-timeout", "3",

            # ── Mount user code ──
            "-v", f"{tmpdir}:/workspace:rw",

            # ── Image + args ──
            _settings.sandbox_image,
            language,
            source_file,
        ]

        # Add seccomp profile if available
        if os.path.exists(_settings.seccomp_profile):
            img_idx = docker_cmd.index(_settings.sandbox_image)
            docker_cmd.insert(img_idx, f"seccomp={_settings.seccomp_profile}")
            docker_cmd.insert(img_idx, "--security-opt")

        logger.info(
            f"[{request_id}] sandbox.start | lang={language} "
            f"code_bytes={len(code)} container={container_name}"
        )
        start = time.time()

        try:
            if cancel_flag.is_set():
                return canceled_result()

            proc = await asyncio.wait_for(
                asyncio.create_subprocess_exec(
                    *docker_cmd,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                ),
                timeout=5,
            )

            stdout_raw, stderr_raw = await asyncio.wait_for(
                proc.communicate(),
                timeout=_settings.container_timeout,
            )

        except asyncio.CancelledError:
            try:
                await asyncio.create_subprocess_exec(
                    "docker", "kill", container_name,
                    stdout=asyncio.subprocess.DEVNULL,
                    stderr=asyncio.subprocess.DEVNULL,
                )
            except Exception:
                pass
            raise

        except asyncio.TimeoutError:
            await asyncio.create_subprocess_exec(
                "docker", "kill", container_name,
                stdout=asyncio.subprocess.DEVNULL,
                stderr=asyncio.subprocess.DEVNULL,
            )
            elapsed = time.time() - start
            logger.warning(
                f"[{request_id}] sandbox.timeout | elapsed={elapsed:.1f}s "
                f"container={container_name}"
            )
            if cancel_flag.is_set():
                return canceled_result()
            return error_result(
                "Trace timed out (code may contain infinite loops or be too complex)."
            )

        except FileNotFoundError:
            logger.error(f"[{request_id}] sandbox.error | Docker CLI not found on PATH")
            return error_result("Docker is not available on this server.")

        elapsed = time.time() - start

        stdout_text = truncate_output(stdout_raw, _settings.max_output_bytes)
        stderr_text = truncate_output(stderr_raw, 5000)

        logger.info(
            f"[{request_id}] sandbox.done | elapsed={elapsed:.1f}s "
            f"exit_code={proc.returncode} stdout_bytes={len(stdout_raw)} "
            f"stderr_bytes={len(stderr_raw)}"
        )

        if cancel_flag.is_set():
            return canceled_result()

        if not stdout_text.strip():
            logger.error(f"[{request_id}] sandbox.empty_output | stderr={stderr_text[:300]}")
            if cancel_flag.is_set():
                return canceled_result()
            return error_result(f"Sandbox produced no output. {stderr_text[:200]}")

        try:
            result = json.loads(stdout_text)
        except json.JSONDecodeError:
            logger.error(f"[{request_id}] sandbox.bad_json | raw={stdout_text[:300]}")
            if cancel_flag.is_set():
                return canceled_result()
            return error_result("Sandbox returned invalid output.")

        return result
