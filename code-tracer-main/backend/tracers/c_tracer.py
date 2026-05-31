"""
Local C tracing using GDB/MI (pygdbmi).
"""

import logging
import os
import shutil
import subprocess
import tempfile
import threading
import time
from typing import Optional

from config import get_settings
from .base import (
    TraceResult,
    get_source_filename,
    detect_input_functions,
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


def quick_heap_read(gdbmi, var_name, address, depth=0, visited=None):
    """Quickly read a heap node — limited depth."""
    if visited is None:
        visited = set()
    if depth > 3 or address in visited or address == "0x0":
        return []
    visited.add(address)

    items = []
    try:
        tag = f"h{var_name.replace('->', '_').replace('*', '')}_{depth}"
        resp = gdbmi.write(f"-var-create {tag} * *{var_name}", timeout_sec=2)

        node_type = ""
        num_children = 0
        for r in resp:
            if r.get("type") == "result" and r.get("message") == "done":
                p = r.get("payload", {})
                node_type = p.get("type", "")
                num_children = int(p.get("numchild", "0"))

        node = {"address": address, "type": node_type, "var_name": var_name, "fields": [], "pointer_to": None}

        if num_children > 0:
            ch_resp = gdbmi.write(f"-var-list-children {tag}", timeout_sec=2)
            for cr in ch_resp:
                if cr.get("type") == "result" and cr.get("message") == "done":
                    for child in cr.get("payload", {}).get("children", []):
                        cd = child.get("child", child) if isinstance(child, dict) else child
                        fname = cd.get("exp", "")
                        fval = cd.get("value", "")
                        ftype = cd.get("type", "")
                        node["fields"].append({"name": fname, "value": fval, "type": ftype})
                        if "*" in ftype and fval.startswith("0x") and fval != "0x0":
                            node["pointer_to"] = fval
                            sub = quick_heap_read(gdbmi, f"{var_name}->{fname}", fval, depth + 1, visited)
                            items.extend(sub)

        items.insert(0, node)
        gdbmi.write(f"-var-delete {tag}", timeout_sec=1)
    except Exception:
        pass

    return items


def trace_c_local(
    code: str,
    inputs: list,
    cancel_flag: Optional[threading.Event] = None,
) -> TraceResult:
    """Trace C code locally using GDB/MI (pygdbmi)."""
    cancel_flag = cancel_flag or threading.Event()
    inputs = inputs or []

    if cancel_flag.is_set():
        return canceled_result()

    # Detect which source lines need runtime input
    input_info = detect_input_functions(code, "c")
    input_line_numbers = input_info['input_lines']
    logger.info(f"input_detection | has_input={input_info['has_input']} input_lines={input_line_numbers}")

    with tempfile.TemporaryDirectory() as tmpdir:
        source_file = get_source_filename(code, "c")
        src_path = os.path.join(tmpdir, source_file)
        with open(src_path, "w") as f:
            f.write(code)

        bin_name = "program.exe" if os.name == "nt" else "program"
        bin_path = os.path.join(tmpdir, bin_name)

        # Create a helper file that forces unbuffered stdout
        unbuf_path = os.path.join(tmpdir, "_unbuf.c")
        with open(unbuf_path, "w") as uf:
            uf.write('#include <stdio.h>\n'
                     '__attribute__((constructor)) void _force_unbuf(void) {\n'
                     '    setvbuf(stdout, NULL, _IONBF, 0);\n'
                     '    setvbuf(stderr, NULL, _IONBF, 0);\n'
                     '}\n')

        r = subprocess.run(
            ["gcc", "-g", "-O0", "-o", bin_path, unbuf_path, src_path],
            capture_output=True, text=True, timeout=15,
        )
        if r.returncode != 0:
            # Fallback without unbuf helper
            r = subprocess.run(
                ["gcc", "-g", "-O0", "-o", bin_path, src_path],
                capture_output=True, text=True, timeout=15,
            )
        if r.returncode != 0:
            return compilation_error_result(r.stderr)

        if cancel_flag.is_set():
            return canceled_result()

        # Use pygdbmi for local C tracing
        try:
            from pygdbmi.gdbcontroller import GdbController
            gdb_path = shutil.which("gdb") or shutil.which("gdb.exe")
            if not gdb_path:
                return error_result("gdb not found on PATH")

            gdbmi = GdbController(command=[gdb_path, "--nx", "--quiet", "--interpreter=mi3", bin_path])
            source_lines = code.split("\n")
            steps = []
            stdout_buffer = ""
            input_call_count = 0

            def _is_exit(responses):
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

            def _grab_stdout(responses):
                return "".join(
                    r.get("payload", "") for r in responses
                    if (r.get("type"), r.get("message")) in (
                        ("target", "target-stream-output"),
                        ("console", "console-stream-output"),
                    )
                )

            # Set breakpoints on source lines
            for i, lt in enumerate(source_lines, 1):
                s = lt.strip()
                if s and not s.startswith("//") and not s.startswith("#") and s not in ("{", "}", "};", ""):
                    try:
                        gdbmi.write(f"-break-insert program.c:{i}", timeout_sec=1)
                    except Exception:
                        pass

            # Set up stdin redirect if inputs provided
            if inputs:
                input_file_path = os.path.join(tmpdir, '_stdin_input.txt')
                with open(input_file_path, 'w') as inf:
                    inf.write('\n'.join(inputs) + '\n')
                gdb_input_path = input_file_path.replace('\\', '/')
                try:
                    gdbmi.write(f'-interpreter-exec console "set args < {gdb_input_path}"', timeout_sec=2)
                    logger.info(f"gdb.stdin_redirect | file={gdb_input_path} inputs={len(inputs)}")
                except Exception as e:
                    logger.warning(f"gdb.stdin_redirect_failed | {e}")

            resps = gdbmi.write("-exec-run", timeout_sec=5)
            stdout_buffer += _grab_stdout(resps)
            if _is_exit(resps):
                gdbmi.exit()
                return {
                    "steps": [], "final_output": stdout_buffer, "error": None,
                    "compilation_error": None, "status": "completed",
                }

            t0 = time.time()
            for _ in range(250):
                if cancel_flag.is_set():
                    try:
                        gdbmi.exit()
                    except Exception:
                        pass
                    return {
                        "steps": steps, "final_output": stdout_buffer, "error": None,
                        "compilation_error": None, "status": "canceled",
                    }
                if time.time() - t0 > 115:
                    break
                try:
                    frame_resps = gdbmi.write("-stack-info-frame", timeout_sec=2)
                    stdout_buffer += _grab_stdout(frame_resps)
                    for r in frame_resps:
                        if r.get("type") == "result" and r.get("message") == "done":
                            fr = r.get("payload", {}).get("frame", {})
                            line = int(fr.get("line", 0))
                            func = fr.get("func", "??")
                            fil = fr.get("file", "")
                            break
                    else:
                        break
                except Exception:
                    break
                if line == 0:
                    break
                if fil and "program.c" not in fil:
                    resps = gdbmi.write("-exec-continue", timeout_sec=3)
                    stdout_buffer += _grab_stdout(resps)
                    if _is_exit(resps):
                        break
                    continue

                variables = []
                try:
                    var_resps = gdbmi.write("-stack-list-variables --all-values", timeout_sec=2)
                    stdout_buffer += _grab_stdout(var_resps)
                    for r in var_resps:
                        if r.get("type") == "result" and r.get("message") == "done":
                            for v in r.get("payload", {}).get("variables", []):
                                variables.append({"name": v.get("name", ""), "value": v.get("value", ""), "type": "auto"})
                except Exception:
                    pass

                stack_frames = []
                try:
                    stack_resps = gdbmi.write("-stack-list-frames", timeout_sec=2)
                    stdout_buffer += _grab_stdout(stack_resps)
                    for r in stack_resps:
                        if r.get("type") == "result" and r.get("message") == "done":
                            for sf in r.get("payload", {}).get("stack", []):
                                fd = sf.get("frame", sf) if isinstance(sf, dict) else sf
                                stack_frames.append({"level": fd.get("level", "0"), "func": fd.get("func", "??"),
                                                     "line": int(fd.get("line", 0)), "file": fd.get("file", "")})
                except Exception:
                    pass

                steps.append({"step": len(steps), "line": line, "func": func,
                              "variables": variables, "stack_frames": stack_frames,
                              "heap": [], "stdout": stdout_buffer})

                # ── Input line detection ──
                if line in input_line_numbers:
                    input_call_count += 1
                    logger.info(f"input.detected | line={line} call={input_call_count} available={len(inputs)}")
                    if input_call_count > len(inputs):
                        logger.info(f"input.paused | waiting for input #{input_call_count}")
                        try:
                            gdbmi.exit()
                        except Exception:
                            pass

                        return {
                            "steps": steps,
                            "final_output": stdout_buffer,
                            "error": None,
                            "compilation_error": None,
                            "status": "waiting_for_input",
                            "stdout_at_pause": stdout_buffer,
                        }

                # Continue to next breakpoint
                try:
                    resps = gdbmi.write("-exec-continue", timeout_sec=3)
                    stdout_buffer += _grab_stdout(resps)
                    if _is_exit(resps):
                        break
                except Exception:
                    if input_info['has_input'] and input_call_count <= len(inputs):
                        logger.info(f"input.timeout_fallback | possible undetected input")
                        try:
                            gdbmi.exit()
                        except Exception:
                            pass
                        return {
                            "steps": steps,
                            "final_output": stdout_buffer,
                            "error": None,
                            "compilation_error": None,
                            "status": "waiting_for_input",
                            "stdout_at_pause": stdout_buffer,
                        }
                    break

            try:
                gdbmi.exit()
            except Exception:
                pass
            if not stdout_buffer.strip():
                stdin_data = '\n'.join(inputs) + '\n' if inputs else None
                stdout_buffer = _run_program_output([bin_path], stdin_data=stdin_data)
            return {"steps": steps, "final_output": stdout_buffer, "error": None,
                    "compilation_error": None, "status": "completed"}
        except ImportError:
            return error_result("pygdbmi not installed (pip install pygdbmi)")
        except Exception as e:
            return error_result(str(e))
