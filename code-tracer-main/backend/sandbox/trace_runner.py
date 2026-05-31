#!/usr/bin/env python3
"""
trace_runner.py — Runs inside the sandbox container.

Reads a source file from /workspace, compiles it, traces execution with
GDB (C) or JDB (Java), and prints a JSON result to stdout.

Safety limits enforced inside the container:
  - MAX_OUTPUT_BYTES: stdout/JSON output capped at 100 KB
  - MAX_STEPS: trace limited to 250 breakpoint hits
  - TIME_LIMIT: hard 20s wall-clock limit on tracing
  - DISK_LIMIT: abort if /workspace exceeds 32 MB

Usage:
    python3 trace_runner.py <language> <source_filename>
"""

import json
import os
import re
import resource
import subprocess
import sys
import time
from typing import Optional

from pygdbmi.gdbcontroller import GdbController

MAX_STEPS = 250
MAX_OUTPUT_BYTES = 100_000   # 100 KB max JSON output
DISK_LIMIT_BYTES = 32_000_000  # 32 MB max disk usage in /workspace
TIME_LIMIT = 115              # seconds for tracing phase
WORKSPACE = "/workspace"


# =============================================================================
#  Utilities
# =============================================================================

def emit(result: dict):
    """Print JSON result to stdout and exit. Truncates if over limit."""
    raw = json.dumps(result, default=str)
    if len(raw) > MAX_OUTPUT_BYTES:
        # Truncate steps to fit within budget
        result["steps"] = result.get("steps", [])[:50]
        result["error"] = (result.get("error") or "") + " [output truncated — too large]"
        raw = json.dumps(result, default=str)
        if len(raw) > MAX_OUTPUT_BYTES:
            raw = json.dumps({
                "steps": [], "final_output": "",
                "error": "Output exceeded 100KB limit.",
                "compilation_error": None,
            })
    print(raw)
    sys.exit(0)


def check_disk_usage():
    """Abort if /workspace disk usage exceeds limit."""
    total = 0
    for dirpath, _dirnames, filenames in os.walk(WORKSPACE):
        for f in filenames:
            try:
                total += os.path.getsize(os.path.join(dirpath, f))
            except OSError:
                pass
        if total > DISK_LIMIT_BYTES:
            emit({
                "steps": [], "final_output": "",
                "error": "Disk usage limit exceeded inside sandbox.",
                "compilation_error": None,
            })


def set_resource_limits():
    """Set per-process resource limits (Linux only)."""
    try:
        # Max 128 MB virtual memory per process
        resource.setrlimit(resource.RLIMIT_AS, (128 * 1024 * 1024, 128 * 1024 * 1024))
        # Max 64 MB file size
        resource.setrlimit(resource.RLIMIT_FSIZE, (64 * 1024 * 1024, 64 * 1024 * 1024))
        # Max 30s CPU time
        resource.setrlimit(resource.RLIMIT_CPU, (30, 30))
    except (ValueError, OSError):
        pass  # not available on all platforms


def infer_type(value: str) -> str:
    if not value:
        return "unknown"
    if value.startswith("0x"):
        return "pointer"
    if value.startswith("{"):
        return "struct"
    if value.startswith('"') or value.startswith("'"):
        return "char"
    try:
        int(value)
        return "int"
    except ValueError:
        pass
    try:
        float(value)
        return "float"
    except ValueError:
        pass
    return "auto"


def _truncate_text(text: str, limit: int = MAX_OUTPUT_BYTES) -> str:
    if not text:
        return ""
    if len(text) > limit:
        return text[:limit] + "\n[stdout truncated]"
    return text


def _run_program_output(cmd: list, timeout_sec: int = 4) -> str:
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout_sec)
    except subprocess.TimeoutExpired:
        return ""
    out = proc.stdout or ""
    err = proc.stderr or ""
    if err.strip():
        out = out.rstrip()
        out = f"{out}\n{err}" if out else err
    return _truncate_text(out)


# =============================================================================
#  C: compile + trace
# =============================================================================

def compile_c(source_file: str) -> Optional[str]:
    src = os.path.join(WORKSPACE, source_file)
    bin_path = os.path.join(WORKSPACE, "program")
    result = subprocess.run(
        ["gcc", "-g", "-O0", "-o", bin_path, src],
        capture_output=True, text=True, timeout=15,
    )
    if result.returncode != 0:
        return result.stderr[:5000]
    check_disk_usage()
    return None


def trace_c(source_file: str, code: str) -> dict:
    bin_path = os.path.join(WORKSPACE, "program")
    steps = []
    stdout_buffer = ""
    source_lines = code.split("\n")

    try:
        gdbmi = GdbController(command=["gdb", "--nx", "--quiet", "--interpreter=mi3", bin_path])
    except Exception:
        try:
            gdbmi = GdbController(command=["gdb", "--nx", "--quiet", "--interpreter=mi2", bin_path])
        except Exception as e:
            return {"steps": [], "final_output": "", "error": f"Failed to start GDB: {e}", "compilation_error": None}

    def is_exit(responses):
        for r in responses:
            msg = r.get("message", "")
            if r.get("type") == "notify" and "exited" in msg:
                return True
            if r.get("type") == "result" and msg == "error":
                return True
            p = r.get("payload", {})
            if isinstance(p, dict) and p.get("reason", "").startswith("exited"):
                return True
        return False

    def grab_stdout(responses):
        return "".join(
            r.get("payload", "") for r in responses
            if (r.get("type"), r.get("message")) in (
                ("target", "target-stream-output"),
                ("console", "console-stream-output"),
            )
        )

    def frame_info():
        try:
            for r in gdbmi.write("-stack-info-frame", timeout_sec=2):
                if r.get("type") == "result" and r.get("message") == "done":
                    f = r.get("payload", {}).get("frame", {})
                    return int(f.get("line", 0)), f.get("func", "??"), f.get("file", "")
        except Exception:
            pass
        return 0, "??", ""

    def full_stack():
        frames = []
        try:
            for r in gdbmi.write("-stack-list-frames", timeout_sec=2):
                if r.get("type") == "result" and r.get("message") == "done":
                    for fr in r.get("payload", {}).get("stack", []):
                        fd = fr.get("frame", fr) if isinstance(fr, dict) else fr
                        frames.append({
                            "level": fd.get("level", "0"),
                            "func": fd.get("func", "??"),
                            "line": int(fd.get("line", 0)),
                            "file": fd.get("file", ""),
                        })
        except Exception:
            pass
        return frames

    def local_vars():
        variables = []
        try:
            for r in gdbmi.write("-stack-list-variables --all-values", timeout_sec=2):
                if r.get("type") == "result" and r.get("message") == "done":
                    for v in r.get("payload", {}).get("variables", []):
                        nm = v.get("name", "")
                        val = v.get("value", "")
                        variables.append({
                            "name": nm, "value": val,
                            "type": "pointer" if (val and val.startswith("0x")) else infer_type(val),
                        })
        except Exception:
            pass
        return variables

    try:
        for i, line_text in enumerate(source_lines, 1):
            stripped = line_text.strip()
            if stripped and not stripped.startswith("//") and not stripped.startswith("#") and stripped not in ("{", "}", "};", ""):
                try:
                    gdbmi.write(f"-break-insert {source_file}:{i}", timeout_sec=1)
                except Exception:
                    pass

        resps = gdbmi.write("-exec-run", timeout_sec=5)
        if is_exit(resps):
            return {"steps": steps, "final_output": stdout_buffer, "error": None, "compilation_error": None}

        start_time = time.time()

        for _ in range(MAX_STEPS):
            if time.time() - start_time > TIME_LIMIT:
                break

            # Cap stdout buffer size
            if len(stdout_buffer) > MAX_OUTPUT_BYTES:
                stdout_buffer = stdout_buffer[:MAX_OUTPUT_BYTES] + "\n[stdout truncated]"
                break

            line, func, file = frame_info()
            if line == 0:
                break

            if file and source_file not in file:
                resps = gdbmi.write("-exec-continue", timeout_sec=3)
                stdout_buffer += grab_stdout(resps)
                if is_exit(resps):
                    break
                continue

            stack = full_stack()
            variables = local_vars()

            heap = []
            for v in variables:
                if v["type"] == "pointer" and v["value"] not in ("0x0", ""):
                    heap.append({
                        "address": v["value"], "type": "allocated",
                        "var_name": v["name"],
                        "fields": [{"name": v["name"], "value": v["value"], "type": "pointer"}],
                        "pointer_to": None,
                    })

            steps.append({
                "step": len(steps), "line": line, "func": func,
                "variables": variables, "stack_frames": stack,
                "heap": heap, "stdout": stdout_buffer,
            })

            resps = gdbmi.write("-exec-continue", timeout_sec=3)
            stdout_buffer += grab_stdout(resps)
            if is_exit(resps):
                break

        if not stdout_buffer.strip():
            stdout_buffer = _run_program_output([bin_path])
        return {"steps": steps, "final_output": stdout_buffer, "error": None, "compilation_error": None}
    except Exception as e:
        return {"steps": steps, "final_output": stdout_buffer, "error": str(e), "compilation_error": None}
    finally:
        try:
            gdbmi.exit()
        except Exception:
            pass


# =============================================================================
#  Java: compile + trace
# =============================================================================

def detect_java_main_class(code: str) -> Optional[str]:
    public_match = re.search(r"public\s+class\s+([A-Za-z_][A-Za-z0-9_]*)", code)
    if public_match:
        return public_match.group(1)
    class_match = re.search(r"class\s+([A-Za-z_][A-Za-z0-9_]*)", code)
    if class_match:
        return class_match.group(1)
    return None


def compile_java(source_file: str, code: str) -> tuple:
    if not re.search(r"public\s+static\s+void\s+main\s*\(", code):
        return None, "Java tracing requires: public static void main(String[] args)"
    main_class = detect_java_main_class(code)
    if not main_class:
        return None, "Could not detect a Java class name."
    src_path = os.path.join(WORKSPACE, source_file)
    result = subprocess.run(
        ["javac", "-g", src_path],
        capture_output=True, text=True, timeout=15,
    )
    if result.returncode != 0:
        return None, (result.stderr or result.stdout)[:5000]
    check_disk_usage()
    return main_class, None


def trace_java(main_class: str, source_file: str, code: str) -> dict:
    try:
        # Run the JDI agent. We assume JavaTracer.class is in /opt
        proc = subprocess.run(
            ["java", "-Xmx96m", "-Xms16m", "-XX:+UseSerialGC", "-cp", f"/opt:{WORKSPACE}", "JavaTracer", main_class, source_file],
            capture_output=True, text=True, timeout=22,
        )
    except subprocess.TimeoutExpired:
        return {"steps": [], "final_output": "", "error": "Java trace timed out.", "compilation_error": None}
    except Exception as e:
        return {"steps": [], "final_output": "", "error": f"JavaTracer failed: {e}", "compilation_error": None}

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

    if not steps and stderr and ("Exception" in stderr or "Error" in stderr):
        return {"steps": [], "final_output": "", "error": stderr[:1000], "compilation_error": None}

    # Extract program output from stderr (target JVM output goes there via
    # JavaTracer's redirectErrorStream). Only spawn a separate JVM if we got
    # zero output — avoids a costly ~3-5s JVM startup on constrained hardware.
    final_output = ""
    program_lines = [l for l in stderr.splitlines()
                     if not l.startswith("Target VM:") and not l.startswith("Frame error:")]
    if program_lines:
        final_output = "\n".join(program_lines)
    if not final_output.strip() and steps:
        # Fallback: run the program once more to capture stdout
        final_output = _run_program_output(["java", "-Xmx64m", "-XX:+UseSerialGC", "-cp", WORKSPACE, main_class])

    return {"steps": steps, "final_output": _truncate_text(final_output), "error": None, "compilation_error": None}


# =============================================================================
#  Python: trace (no compilation needed)
# =============================================================================

def trace_python(source_file: str, code: str) -> dict:
    """Trace Python code using sys.settrace."""
    import io as _io

    MAX_VAR_REPR = 200
    source_basename = source_file

    # Compile first to catch syntax errors
    try:
        compiled = compile(code, source_basename, "exec")
    except SyntaxError as e:
        return {
            "steps": [], "final_output": "", "error": None,
            "compilation_error": f"{source_basename}:{e.lineno}:0: error: {e.msg}",
        }

    def safe_repr(val):
        try:
            r = repr(val)
            return r[:MAX_VAR_REPR] + "..." if len(r) > MAX_VAR_REPR else r
        except Exception:
            return "<error>"

    EXCLUDED_VARS = {
        "__builtins__", "__name__", "__doc__", "__file__",
        "__loader__", "__spec__", "__cached__", "__package__",
    }

    captured_stdout = _io.StringIO()
    original_stdout = sys.stdout
    sys.stdout = captured_stdout

    steps = []
    step_count = [0]

    def trace_func(frame, event, arg):
        if step_count[0] >= MAX_STEPS:
            return None
        if frame.f_code.co_filename != source_basename:
            return trace_func
        if event == "line":
            line_no = frame.f_lineno
            func_name = frame.f_code.co_name
            if func_name == "<module>":
                func_name = "main"

            variables = []
            for name, val in frame.f_locals.items():
                if name.startswith("_") or name in EXCLUDED_VARS:
                    continue
                variables.append({
                    "name": name,
                    "value": safe_repr(val),
                    "type": infer_type(safe_repr(val)),
                })

            stack_frames = []
            f = frame
            level = 0
            while f is not None:
                if f.f_code.co_filename == source_basename:
                    fn = f.f_code.co_name
                    if fn == "<module>":
                        fn = "main"
                    stack_frames.append({
                        "level": str(level), "func": fn,
                        "line": f.f_lineno, "file": source_basename,
                    })
                    level += 1
                f = f.f_back

            steps.append({
                "step": step_count[0], "line": line_no, "func": func_name,
                "variables": variables, "stack_frames": stack_frames,
                "heap": [], "stdout": captured_stdout.getvalue(),
            })
            step_count[0] += 1
        return trace_func

    exec_globals = {"__name__": "__main__", "__builtins__": __builtins__}
    error_msg = None

    try:
        sys.settrace(trace_func)
        exec(compiled, exec_globals)
    except SystemExit:
        pass
    except Exception as e:
        error_msg = f"{type(e).__name__}: {e}"
    finally:
        sys.settrace(None)
        sys.stdout = original_stdout

    final_output = captured_stdout.getvalue()
    return {
        "steps": steps, "final_output": final_output,
        "error": error_msg, "compilation_error": None,
    }


# =============================================================================
#  Main
# =============================================================================

def main():
    if len(sys.argv) < 3:
        emit({"steps": [], "final_output": "", "error": "Usage: trace_runner.py <language> <file>", "compilation_error": None})

    set_resource_limits()

    language = sys.argv[1].strip().lower()
    source_file = sys.argv[2].strip()
    src_path = os.path.join(WORKSPACE, source_file)

    if not os.path.exists(src_path):
        emit({"steps": [], "final_output": "", "error": f"Source file not found: {source_file}", "compilation_error": None})

    with open(src_path, "r") as f:
        code = f.read()

    if language == "c":
        err = compile_c(source_file)
        if err:
            emit({"steps": [], "final_output": "", "error": None, "compilation_error": err})
        emit(trace_c(source_file, code))
    elif language == "java":
        mc, err = compile_java(source_file, code)
        if err:
            emit({"steps": [], "final_output": "", "error": None, "compilation_error": err})
        emit(trace_java(mc, source_file, code))
    elif language == "python":
        emit(trace_python(source_file, code))
    else:
        emit({"steps": [], "final_output": "", "error": f"Unsupported language: {language}", "compilation_error": None})


if __name__ == "__main__":
    main()
