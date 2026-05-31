"""
Local Python tracing using sys.settrace via a helper script.
"""

import json
import logging
import os
import shutil
import subprocess
import tempfile
import threading
from typing import Optional

from config import get_settings
from .base import (
    TraceResult,
    get_source_filename,
    canceled_result,
    error_result,
    compilation_error_result,
)

logger = logging.getLogger(__name__)
_settings = get_settings()

# The embedded Python tracer script
_PYTHON_TRACER_SCRIPT = r'''
import sys
import json
import os
import io
import traceback
import copy

MAX_STEPS = 500000
MAX_VAR_REPR = 200

def safe_repr(val):
    """Safely get a string representation of a value."""
    try:
        r = repr(val)
        if len(r) > MAX_VAR_REPR:
            return r[:MAX_VAR_REPR] + "..."
        return r
    except Exception:
        return "<error>"

def infer_type(val):
    """Infer a simple type name for a Python value."""
    t = type(val).__name__
    type_map = {
        "int": "int", "float": "float", "str": "str",
        "bool": "bool", "list": "list", "dict": "dict",
        "tuple": "tuple", "set": "set", "NoneType": "None",
    }
    return type_map.get(t, t)

def main():
    if len(sys.argv) < 2:
        json.dump({"steps": [], "final_output": "", "error": "No source file provided",
                   "compilation_error": None, "status": "error"}, sys.stdout)
        return

    source_path = sys.argv[1]
    if not os.path.exists(source_path):
        json.dump({"steps": [], "final_output": "", "error": f"File not found: {source_path}",
                   "compilation_error": None, "status": "error"}, sys.stdout)
        return

    with open(source_path, "r", encoding="utf-8") as f:
        code = f.read()

    source_basename = os.path.basename(source_path)

    try:
        compiled = compile(code, source_basename, "exec")
    except SyntaxError as e:
        json.dump({"steps": [], "final_output": "", "error": None,
                   "compilation_error": f"{source_basename}:{e.lineno}:0: error: {e.msg}",
                   "status": "error"}, sys.stdout)
        return

    captured_stdout = io.StringIO()
    original_stdout = sys.stdout
    sys.stdout = captured_stdout

    steps = []
    step_count = [0]

    source_lines = code.split("\n")

    EXCLUDED_VARS = {
        "__builtins__", "__name__", "__doc__", "__file__",
        "__loader__", "__spec__", "__cached__", "__package__",
    }

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
            local_vars = frame.f_locals
            for name, val in local_vars.items():
                if name.startswith("_") or name in EXCLUDED_VARS:
                    continue
                variables.append({
                    "name": name,
                    "value": safe_repr(val),
                    "type": infer_type(val),
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
                        "level": str(level),
                        "func": fn,
                        "line": f.f_lineno,
                        "file": source_basename,
                    })
                    level += 1
                f = f.f_back

            stdout_so_far = captured_stdout.getvalue()

            steps.append({
                "step": step_count[0],
                "line": line_no,
                "func": func_name,
                "variables": variables,
                "stack_frames": stack_frames,
                "heap": [],
                "stdout": stdout_so_far,
            })
            step_count[0] += 1

        return trace_func

    exec_globals = {"__name__": "__main__", "__builtins__": __builtins__}
    error_msg = None
    compilation_error = None
    status = "completed"

    try:
        sys.settrace(trace_func)
        exec(compiled, exec_globals)
    except SystemExit:
        pass
    except Exception as e:
        error_msg = f"{type(e).__name__}: {e}"
        status = "error"
    finally:
        sys.settrace(None)
        sys.stdout = original_stdout

    final_output = captured_stdout.getvalue()

    result = {
        "steps": steps,
        "final_output": final_output,
        "error": error_msg,
        "compilation_error": compilation_error,
        "status": status,
    }

    json.dump(result, sys.stdout, default=str)

if __name__ == "__main__":
    main()
'''


def trace_python_local(
    code: str,
    inputs: list,
    cancel_flag: Optional[threading.Event] = None,
) -> TraceResult:
    """Trace Python code locally using sys.settrace via a subprocess."""
    cancel_flag = cancel_flag or threading.Event()

    python_path = shutil.which("python") or shutil.which("python3") or shutil.which("python.exe")
    if not python_path:
        return error_result("Python not found on PATH")

    if cancel_flag.is_set():
        return canceled_result()

    with tempfile.TemporaryDirectory() as tmpdir:
        source_file = get_source_filename(code, "python")
        src_path = os.path.join(tmpdir, source_file)
        with open(src_path, "w") as f:
            f.write(code)

        # Write the tracer helper script
        tracer_script = os.path.join(tmpdir, "_python_tracer.py")
        with open(tracer_script, "w") as tf:
            tf.write(_PYTHON_TRACER_SCRIPT)

        # Prepare stdin data for input() calls
        stdin_data = '\n'.join(inputs) + '\n' if inputs else None

        try:
            r = subprocess.run(
                [python_path, tracer_script, src_path],
                capture_output=True, text=True, timeout=30,
                input=stdin_data,
                cwd=tmpdir,
            )
        except subprocess.TimeoutExpired:
            return error_result(
                "Python trace timed out (code may contain infinite loops)."
            )

        if cancel_flag.is_set():
            return canceled_result()

        stderr_text = (r.stderr or "").strip()
        stdout_text = (r.stdout or "").strip()

        # Check for syntax errors
        if r.returncode != 0 and not stdout_text:
            return compilation_error_result(
                stderr_text or "Python execution failed."
            )

        # Parse JSON result from tracer
        try:
            result = json.loads(stdout_text)
        except json.JSONDecodeError:
            return compilation_error_result(
                stderr_text or stdout_text or "Python tracer returned invalid output."
            )

        return result
