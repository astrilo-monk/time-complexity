"""
Shared types and utilities for all tracers.
"""

import re
from typing import Any, Dict, List, Optional, TypedDict


class TraceResult(TypedDict, total=False):
    steps: List[Dict[str, Any]]
    final_output: str
    error: Optional[str]
    compilation_error: Optional[str]
    status: str
    stdout_at_pause: str


def get_source_filename(code: str, language: str) -> str:
    """Determine the source filename based on language and code content."""
    if language == "java":
        m = re.search(r"public\s+class\s+([A-Za-z_][A-Za-z0-9_]*)", code)
        if m:
            return f"{m.group(1)}.java"
        m = re.search(r"class\s+([A-Za-z_][A-Za-z0-9_]*)", code)
        if m:
            return f"{m.group(1)}.java"
        return "Main.java"
    if language == "python":
        return "program.py"
    return "program.c"


def detect_java_main_class(code: str) -> Optional[str]:
    """Best-effort detection of the class that defines main()."""
    class_pattern = re.compile(r"(?:public\s+)?class\s+([A-Za-z_][A-Za-z0-9_]*)\b")
    main_pattern = re.compile(r"public\s+static\s+void\s+main\s*\(")

    classes = []
    for match in class_pattern.finditer(code):
        class_name = match.group(1)
        open_brace = code.find("{", match.end())
        if open_brace == -1:
            continue

        depth = 0
        close_brace = None
        for idx in range(open_brace, len(code)):
            ch = code[idx]
            if ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0:
                    close_brace = idx
                    break

        if close_brace is None:
            continue

        body = code[open_brace + 1:close_brace]
        classes.append((class_name, body, match.group(0)))

    for class_name, body, _decl in classes:
        if main_pattern.search(body):
            return class_name

    for class_name, _body, decl in classes:
        if decl.strip().startswith("public class"):
            return class_name

    if classes:
        return classes[0][0]

    return None


def detect_input_functions(code: str, language: str) -> dict:
    """Detect input function calls and return which source lines need runtime input."""
    input_lines = set()
    lines = code.split('\n')
    if language == 'c':
        pat = re.compile(r'\b(scanf|gets|fgets|getchar|getline)\s*\(')
        for i, line_text in enumerate(lines, 1):
            if pat.search(line_text):
                input_lines.add(i)
    elif language == 'java':
        pat = re.compile(r'\.(nextLine|nextInt|nextDouble|nextFloat|next|nextLong|nextBoolean|nextShort|nextByte|readLine)\s*\(')
        for i, line_text in enumerate(lines, 1):
            if pat.search(line_text):
                input_lines.add(i)
    elif language == 'python':
        pat = re.compile(r'\binput\s*\(')
        for i, line_text in enumerate(lines, 1):
            if pat.search(line_text):
                input_lines.add(i)
    return {'has_input': len(input_lines) > 0, 'input_lines': input_lines}


def infer_type(value: str) -> str:
    """Simple heuristic to infer Java variable types from JDB output."""
    if value in ("true", "false"):
        return "boolean"
    try:
        int(value)
        return "int"
    except ValueError:
        pass
    try:
        float(value)
        return "double"
    except ValueError:
        pass
    if value.startswith('"') and value.endswith('"'):
        return "String"
    return "Object"


def truncate_output(data: bytes, limit: int) -> str:
    """Decode and truncate bytes to limit."""
    text = data.decode("utf-8", errors="replace")
    if len(text) > limit:
        return text[:limit] + "\n[truncated]"
    return text


def error_result(error: str) -> TraceResult:
    """Build a standard error TraceResult."""
    return {
        "steps": [],
        "final_output": "",
        "error": error,
        "compilation_error": None,
        "status": "error",
    }


def canceled_result() -> TraceResult:
    """Build a standard canceled TraceResult."""
    return {
        "steps": [],
        "final_output": "",
        "error": None,
        "compilation_error": None,
        "status": "canceled",
    }


def compilation_error_result(error: str) -> TraceResult:
    """Build a standard compilation error TraceResult."""
    return {
        "steps": [],
        "final_output": "",
        "error": None,
        "compilation_error": error,
        "status": "error",
    }
