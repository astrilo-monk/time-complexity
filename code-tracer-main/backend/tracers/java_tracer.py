"""
Local Java tracing — instrumented fast path + JDI/JDB fallback.
"""

import json
import logging
import os
import queue
import re
import shutil
import subprocess
import tempfile
import threading
import time
from pathlib import Path
from typing import Optional

from config import get_settings
from .base import (
    TraceResult,
    get_source_filename,
    detect_java_main_class,
    detect_input_functions,
    infer_type,
    canceled_result,
    error_result,
    compilation_error_result,
)

logger = logging.getLogger(__name__)
_settings = get_settings()


def _run_program_output(cmd: list, timeout_sec: int = 4, stdin_data: str = None) -> str:
    """Run a compiled program and capture its output."""
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout_sec,
                              input=stdin_data)
    except subprocess.TimeoutExpired:
        return ""
    out = proc.stdout or ""
    err = proc.stderr or ""
    if err.strip():
        out = out.rstrip()
        out = f"{out}\n{err}" if out else err
    if len(out) > _settings.max_output_bytes:
        return out[:_settings.max_output_bytes] + "\n[stdout truncated]"
    return out


def run_jdb_trace(
    classpath: str,
    main_class: str,
    source_file: str,
    input_line_numbers: set = None,
    inputs: list = None,
    cancel_flag: Optional[threading.Event] = None,
):
    """Best-effort Java tracing using jdb with monitor commands.

    On Linux OpenJDK, jdb's 'run' command is async — it doesn't block
    stdin processing while the JVM starts.  If we pipe all commands at
    once (subprocess.run), the where/locals/cont commands execute before
    any breakpoint is hit and fail with "Nothing suspended".

    Fix: use jdb's 'monitor' command to auto-execute where/locals/cont
    at each breakpoint, and use Popen to keep stdin alive until the
    trace completes.
    """
    input_line_numbers = input_line_numbers or set()
    inputs = inputs or []
    input_call_count = 0
    jdb_path = shutil.which("jdb")
    if not jdb_path:
        return [], "jdb not found. Install a JDK and ensure jdb is on PATH.", "error", ""

    # Verify the .class file exists
    class_file = os.path.join(classpath, main_class + ".class")
    if not os.path.exists(class_file):
        logger.error(f"jdb.error | class file not found: {class_file}")
        return [], f"Compiled class file not found at {class_file}", "error", ""

    source_lines = []
    try:
        source_path = Path(classpath) / source_file
        source_lines = source_path.read_text(encoding="utf-8").splitlines()
    except Exception:
        source_lines = []

    breakpoint_lines = []
    for line_number, line_text in enumerate(source_lines, 1):
        stripped = line_text.strip()
        if not stripped:
            continue
        if stripped.startswith("//") or stripped.startswith("/*") or stripped.startswith("*"):
            continue
        if stripped in {"{", "}", "};"}:
            continue
        if stripped.startswith("import ") or stripped.startswith("package "):
            continue
        if any(keyword in stripped for keyword in (" class ", " interface ", " enum ")):
            continue
        is_executable = (
            stripped.endswith(";")
            or stripped.startswith("if ")
            or stripped.startswith("if(")
            or stripped.startswith("for ")
            or stripped.startswith("for(")
            or stripped.startswith("while ")
            or stripped.startswith("while(")
            or stripped.startswith("switch ")
            or stripped.startswith("switch(")
            or stripped.startswith("do")
            or stripped.startswith("return ")
            or stripped.startswith("throw ")
        )
        if not is_executable:
            continue
        breakpoint_lines.append(line_number)

    setup_cmds = []
    for line_number in breakpoint_lines:
        setup_cmds.append(f"stop at {main_class}:{line_number}")
    setup_cmds.append("run")

    logger.info(f"jdb.start | class={main_class} classpath={classpath} breakpoints={len(breakpoint_lines)}")

    try:
        proc = subprocess.Popen(
            [jdb_path, "-sourcepath", classpath, "-classpath", classpath, main_class],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
    except Exception as e:
        return [], f"Failed to start jdb: {str(e)}", "error", ""

    output_lines = []
    line_queue = queue.Queue()

    def _reader():
        try:
            for line in iter(proc.stdout.readline, ''):
                output_lines.append(line)
                line_queue.put(line)
        except Exception:
            pass
        line_queue.put(None)

    t_out = threading.Thread(target=_reader, daemon=True)
    t_out.start()

    def _read_until(pattern, timeout=15):
        collected = []
        deadline = time.time() + timeout
        while time.time() < deadline:
            if cancel_flag is not None and cancel_flag.is_set():
                return collected, False
            try:
                line = line_queue.get(timeout=0.5)
                if line is None:
                    break
                collected.append(line)
                if pattern.lower() in line.lower():
                    return collected, True
            except queue.Empty:
                continue
        return collected, False

    def _read_for(seconds=2.0):
        collected = []
        deadline = time.time() + seconds
        while time.time() < deadline:
            try:
                line = line_queue.get(timeout=0.2)
                if line is None:
                    break
                collected.append(line)
            except queue.Empty:
                if collected:
                    break
                continue
        return collected

    # Send breakpoints + run
    try:
        for cmd in setup_cmds:
            proc.stdin.write(cmd + "\n")
        proc.stdin.flush()
    except Exception as e:
        logger.error(f"jdb.stdin_error | {e}")

    steps = []
    breakpoint_re = re.compile(r'"?thread=main"?,\s+([^,]+),\s+line=(\d+)')
    frame_re = re.compile(r'\[(\d+)\]\s+([A-Za-z0-9_.$<>]+)\.([A-Za-z0-9_<>$]+)\s+\(([^:()]+):(\d+)\)')
    local_value_re = re.compile(r'^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)$')

    trace_start = time.time()
    canceled = False
    max_steps = _settings.max_steps
    while len(steps) < max_steps and (time.time() - trace_start) < 60:
        if cancel_flag is not None and cancel_flag.is_set():
            canceled = True
            break
        lines_read, found = _read_until("breakpoint hit:", timeout=15)

        if not found:
            break

        current_line = None
        for ln in lines_read[-3:]:
            m = breakpoint_re.search(ln)
            if m:
                current_line = int(m.group(2))
                break

        try:
            proc.stdin.write("where\n")
            proc.stdin.write("locals\n")
            proc.stdin.flush()
        except Exception:
            break

        state_lines = _read_for(seconds=1.0)

        stack_frames = []
        for sl in state_lines:
            fm = frame_re.search(sl.strip())
            if fm:
                stack_frames.append({
                    "level": fm.group(1),
                    "func": f"{fm.group(2)}.{fm.group(3)}",
                    "file": fm.group(4),
                    "line": int(fm.group(5)),
                })

        if not stack_frames:
            try:
                proc.stdin.write("cont\n")
                proc.stdin.flush()
            except Exception:
                break
            continue

        if current_line is None:
            current_line = stack_frames[0]["line"]

        variables = []
        for sl in state_lines:
            lm = local_value_re.match(sl.strip())
            if not lm:
                continue
            name = lm.group(1)
            if name in ("Method", "Local"):
                continue
            value = lm.group(2)
            variables.append({
                "name": name,
                "value": value,
                "type": infer_type(value),
            })

        steps.append({
            "step": len(steps),
            "line": current_line,
            "func": stack_frames[0]["func"],
            "variables": variables,
            "stack_frames": stack_frames,
            "heap": [],
            "stdout": "",
        })

        # ── Input line detection (Java) ──
        if current_line in input_line_numbers:
            input_call_count += 1
            logger.info(f"jdb.input.detected | line={current_line} call={input_call_count} available={len(inputs)}")
            if input_call_count > len(inputs):
                logger.info(f"jdb.input.paused | waiting for input #{input_call_count}")
                try:
                    proc.stdin.write("quit\n")
                    proc.stdin.flush()
                    proc.stdin.close()
                except Exception:
                    pass
                try:
                    proc.wait(timeout=3)
                except Exception:
                    proc.kill()
                    try:
                        proc.wait(timeout=2)
                    except Exception:
                        pass
                t_out.join(timeout=2)
                return steps, None, "waiting_for_input", ""

        try:
            proc.stdin.write("cont\n")
            proc.stdin.flush()
        except Exception:
            break

    # Clean up
    try:
        proc.stdin.write("quit\n")
        proc.stdin.flush()
        proc.stdin.close()
    except Exception:
        pass
    try:
        proc.wait(timeout=3)
    except Exception:
        proc.kill()
        try:
            proc.wait(timeout=2)
        except Exception:
            pass

    t_out.join(timeout=2)

    output = "".join(output_lines)
    logger.info(f"jdb.done | output_len={len(output)} steps={len(steps)}")

    if canceled:
        return steps, None, "canceled", ""

    if not steps:
        logger.error(f"jdb.no_steps | output_len={len(output)}")
        logger.error(f"jdb.no_steps.output | {output[:1500]}")
        has_bp = "breakpoint hit" in output.lower()
        tail = output[-800:].replace('\n', ' | ')
        return [], f"No Java steps collected (bp_found={has_bp}). Tail: {tail}", "error", ""

    return steps, None, "completed", ""


def trace_java_local(
    code: str,
    inputs: list,
    cancel_flag: Optional[threading.Event] = None,
) -> TraceResult:
    """Trace Java code locally — instrumented fast path with JDI/JDB fallback."""
    cancel_flag = cancel_flag or threading.Event()
    inputs = inputs or []

    if cancel_flag.is_set():
        return canceled_result()

    source_file = get_source_filename(code, "java")

    if not re.search(r"public\s+static\s+void\s+main\s*\(", code):
        return compilation_error_result(
            "Java tracing requires a main method: public static void main(String[] args)"
        )

    main_class = detect_java_main_class(code)
    if not main_class:
        return compilation_error_result(
            "Could not detect a Java class name. Define a class like: class Main { ... }"
        )

    javac_path = shutil.which("javac")
    if not javac_path:
        return error_result("javac not found on PATH")

    java_path = shutil.which("java") or shutil.which("java.exe")
    if not java_path:
        return error_result("java not found on PATH")

    if cancel_flag.is_set():
        return canceled_result()

    # Detect input lines for pause behavior
    input_info = detect_input_functions(code, "java")
    input_line_numbers = input_info['input_lines']

    with tempfile.TemporaryDirectory() as tmpdir:
        src_path = os.path.join(tmpdir, source_file)
        with open(src_path, "w") as f:
            f.write(code)

        # ── FAST PATH: Source-level instrumentation (single JVM) ──
        try:
            from services.java_instrumenter import instrument as instrument_java
            instrumented_code = instrument_java(code, source_file)
            logger.info(f"Java instrumentation: {'SUCCESS' if instrumented_code else 'returned None'}")
        except Exception as e:
            logger.warning(f"Java instrumentation import/call failed: {e}")
            instrumented_code = None

        if instrumented_code:
            try:
                inst_source = os.path.join(tmpdir, source_file)
                with open(inst_source, "w") as f:
                    f.write(instrumented_code)

                r = subprocess.run(
                    [javac_path, "-g", "-d", tmpdir, inst_source],
                    capture_output=True, text=True, timeout=15,
                )
                if r.returncode != 0:
                    logger.warning(f"Instrumented Java compilation failed, falling back to JDI: {r.stderr[:500]}")
                    instrumented_code = None
                else:
                    stdin_data = '\n'.join(inputs) + '\n' if inputs else None
                    try:
                        proc = subprocess.run(
                            [java_path, "-Xmx64m", "-Xms16m", "-XX:+UseSerialGC",
                             "-cp", tmpdir, main_class],
                            capture_output=True, text=True, timeout=30,
                            input=stdin_data,
                        )
                    except subprocess.TimeoutExpired:
                        return error_result("Java trace timed out.")

                    output = proc.stdout or ""
                    stderr = proc.stderr or ""

                    steps = []
                    final_output = ""
                    for out_line in output.splitlines():
                        out_line = out_line.strip()
                        if out_line.startswith("__CT_FINAL_OUTPUT__:"):
                            final_output = out_line[len("__CT_FINAL_OUTPUT__:"):]
                        elif out_line.startswith("{") and out_line.endswith("}"):
                            try:
                                steps.append(json.loads(out_line))
                            except Exception:
                                pass

                    trace_error = None
                    if not steps and stderr and ("Exception" in stderr or "Error" in stderr):
                        trace_error = stderr[:1000]

                    if steps or not trace_error:
                        return {"steps": steps, "final_output": final_output, "error": trace_error,
                                "compilation_error": None, "status": "completed",
                                "stdout_at_pause": ""}

                    logger.warning("Instrumented trace got 0 steps, falling back to JDI")
                    instrumented_code = None
            except Exception as e:
                logger.warning(f"Instrumented path failed: {e}, falling back to JDI")
                instrumented_code = None

        # ── FALLBACK: JDI tracing (2 JVMs) ──
        # Compile original (un-instrumented) user code
        with open(src_path, "w") as f:
            f.write(code)

        r = subprocess.run(
            [javac_path, "-g", "-d", tmpdir, src_path],
            capture_output=True, text=True, timeout=15,
        )
        if r.returncode != 0:
            return compilation_error_result(r.stderr or r.stdout)

        # Compile JavaTracer (use pre-compiled class if available)
        tracer_class = os.path.join(_settings.root_dir, "sandbox", "JavaTracer.class")
        if os.path.exists(tracer_class):
            shutil.copy(tracer_class, os.path.join(tmpdir, "JavaTracer.class"))
        else:
            tracer_src = os.path.join(_settings.root_dir, "sandbox", "JavaTracer.java")
            tracer_dest = os.path.join(tmpdir, "JavaTracer.java")
            shutil.copy(tracer_src, tracer_dest)
            r_tr = subprocess.run(
                [javac_path, "-g", "-d", tmpdir, tracer_dest],
                capture_output=True, text=True, timeout=15,
            )
            if r_tr.returncode != 0:
                return {
                    "steps": [], "final_output": "", "error": "Failed to compile JavaTracer",
                    "compilation_error": r_tr.stderr or r_tr.stdout, "status": "error",
                }

        if cancel_flag.is_set():
            return canceled_result()

        try:
            proc = subprocess.run(
                [java_path, "-Xmx96m", "-Xms16m", "-XX:+UseSerialGC",
                 "-cp", tmpdir, "JavaTracer", main_class, source_file],
                capture_output=True, text=True, timeout=30,
            )
        except subprocess.TimeoutExpired:
            return error_result("Java trace timed out.")
        except Exception as e:
            return error_result(f"JavaTracer failed: {e}")

        output = proc.stdout or ""
        stderr = proc.stderr or ""

        steps = []
        for line in output.splitlines():
            line = line.strip()
            if line.startswith("{") and line.endswith("}"):
                try:
                    steps.append(json.loads(line))
                except Exception:
                    pass

        trace_error = None
        if not steps and stderr and ("Exception" in stderr or "Error" in stderr):
            trace_error = stderr[:1000]

        final_output = ""
        program_lines = [l for l in output.splitlines()
                         if not l.strip().startswith("{") and not l.strip().startswith("__CT_")]
        if program_lines:
            final_output = "\n".join(program_lines)

        if steps:
            return {"steps": steps, "final_output": final_output, "error": trace_error,
                    "compilation_error": None, "status": "completed",
                    "stdout_at_pause": ""}

        # ── Last resort: jdb fallback ──
        logger.info("JDI tracer returned 0 steps, falling back to jdb")
        jdb_steps, jdb_error, jdb_status, jdb_stdout = run_jdb_trace(
            tmpdir, main_class, source_file,
            input_line_numbers=input_line_numbers,
            inputs=inputs,
            cancel_flag=cancel_flag,
        )

        if jdb_steps:
            if not final_output.strip():
                stdin_data = '\n'.join(inputs) + '\n' if inputs else None
                final_output = _run_program_output(
                    [java_path, "-cp", tmpdir, main_class],
                    stdin_data=stdin_data,
                )
            return {"steps": jdb_steps, "final_output": final_output, "error": jdb_error,
                    "compilation_error": None, "status": jdb_status,
                    "stdout_at_pause": jdb_stdout}

        # Nothing worked — return whatever error we have
        if not final_output.strip():
            stdin_data = '\n'.join(inputs) + '\n' if inputs else None
            final_output = _run_program_output(
                [java_path, "-cp", tmpdir, main_class],
                stdin_data=stdin_data,
            )
        return {"steps": [], "final_output": final_output,
                "error": trace_error or jdb_error or "No trace steps collected",
                "compilation_error": None, "status": "error",
                "stdout_at_pause": ""}
