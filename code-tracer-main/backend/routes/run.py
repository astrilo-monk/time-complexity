"""
Code execution endpoints — run and cancel traces.
"""

import asyncio
import logging
import uuid

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from config import get_settings
from models.requests import RunCodeRequest, CancelRunRequest
from middleware.rate_limit import is_rate_limited
from services.run_manager import (
    register_run,
    unregister_run,
    cancel_run as do_cancel_run,
    get_semaphore,
)

logger = logging.getLogger(__name__)
router = APIRouter()
_settings = get_settings()


@router.post("/cancel")
async def cancel_run(request: CancelRunRequest):
    """Best-effort cancellation of an in-flight /run call."""
    run_id = (request.run_id or "").strip()
    if not run_id:
        return JSONResponse(status_code=400, content={"ok": False, "error": "Missing run_id"})

    container_name = await do_cancel_run(run_id)

    # Kill sandbox container if applicable
    if container_name:
        try:
            await asyncio.create_subprocess_exec(
                "docker", "kill", container_name,
                stdout=asyncio.subprocess.DEVNULL,
                stderr=asyncio.subprocess.DEVNULL,
            )
        except Exception:
            pass

    return {"ok": True}


@router.post("/run")
async def run_code(request: RunCodeRequest, req: Request):
    """Compile and trace C, Java, or Python code inside a Docker sandbox."""
    client_ip = req.client.host if req.client else "unknown"

    # Rate limiting
    if is_rate_limited(client_ip):
        logger.warning(f"rate_limited | ip={client_ip}")
        return JSONResponse(
            status_code=429,
            content={"error": "Too many requests. Please wait and try again.", "steps": [], "compilation_error": None},
        )

    code = request.code.strip()
    language = (request.language or "c").strip().lower()
    inputs = request.inputs or []
    run_id = (request.run_id or uuid.uuid4().hex).strip() or uuid.uuid4().hex

    if not code:
        return {"error": "No code provided", "steps": [], "compilation_error": None}
    if len(code) > _settings.max_code_size:
        return {"error": f"Code too large ({len(code)} chars, max {_settings.max_code_size})", "steps": [], "compilation_error": None}
    if language not in ("c", "java", "python"):
        return {"error": f"Unsupported language: {language}. Supported: c, java, python", "steps": [], "compilation_error": None}

    logger.info(f"run.request | lang={language} code_bytes={len(code)} inputs={len(inputs)} ip={client_ip}")

    semaphore = get_semaphore()

    if _settings.sandbox_enabled:
        # Concurrency control — reject if all slots are taken
        if semaphore.locked():
            active = _settings.max_concurrent - semaphore._value
            logger.warning(f"concurrency.full | active={active} max={_settings.max_concurrent} ip={client_ip}")
            return JSONResponse(
                status_code=503,
                content={
                    "error": f"Server busy — {_settings.max_concurrent} traces running. Try again in a few seconds.",
                    "steps": [], "compilation_error": None,
                },
            )

        handle = await register_run(run_id, "sandbox")
        try:
            async with semaphore:
                if handle.cancel_flag.is_set():
                    result = {"steps": [], "final_output": "", "error": None, "compilation_error": None, "status": "canceled"}
                else:
                    from tracers.sandbox import run_in_sandbox
                    result = await run_in_sandbox(
                        code,
                        language,
                        run_id=run_id,
                        container_name=handle.container_name,
                        cancel_flag=handle.cancel_flag,
                    )
        finally:
            await unregister_run(run_id, handle)
    else:
        handle = await register_run(run_id, "local")
        try:
            result = await _run_local(code, language, inputs, handle.local_cancel_flag)
        finally:
            await unregister_run(run_id, handle)

    steps = result.get("steps", [])
    status = result.get("status", "completed")
    logger.info(f"run.complete | steps={len(steps)} status={status} error={'yes' if result.get('error') else 'no'}")

    return {
        "run_id": run_id,
        "error": result.get("error"),
        "steps": steps,
        "final_output": result.get("final_output", ""),
        "compilation_error": result.get("compilation_error"),
        "status": status,
        "stdout_at_pause": result.get("stdout_at_pause", ""),
    }


async def _run_local(code: str, language: str, inputs: list, cancel_flag) -> dict:
    """Route to the correct local tracer in a worker thread."""
    import asyncio
    import threading

    if language == "c":
        from tracers.c_tracer import trace_c_local
        return await asyncio.to_thread(trace_c_local, code, inputs, cancel_flag)
    elif language == "java":
        from tracers.java_tracer import trace_java_local
        return await asyncio.to_thread(trace_java_local, code, inputs, cancel_flag)
    elif language == "python":
        from tracers.python_tracer import trace_python_local
        return await asyncio.to_thread(trace_python_local, code, inputs, cancel_flag)
    else:
        return {"steps": [], "final_output": "", "error": f"Unsupported language: {language}",
                "compilation_error": None, "status": "error"}
