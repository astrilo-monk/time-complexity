import re
from collections import Counter, defaultdict
from typing import Any, Dict, List, Tuple


def _detect_backedges(steps: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    backedges = []
    prev_line = None
    prev_func = None
    for step in steps:
        line = step.get("line")
        func = step.get("func")
        if not isinstance(line, int) or line <= 0:
            prev_line = line
            prev_func = func
            continue
        if prev_line and prev_func == func and line < prev_line:
            backedges.append({"from": prev_line, "to": line, "func": func})
        prev_line = line
        prev_func = func
    return backedges


def _estimate_loop_depth(backedges: List[Dict[str, Any]]) -> int:
    ranges: List[Tuple[int, int]] = []
    for edge in backedges:
        start = edge["to"]
        end = edge["from"]
        if start < end:
            ranges.append((start, end))

    ranges.sort(key=lambda r: (r[0], -(r[1] - r[0])))
    max_depth = 0
    stack: List[Tuple[int, int]] = []
    for start, end in ranges:
        while stack and start > stack[-1][1]:
            stack.pop()
        stack.append((start, end))
        max_depth = max(max_depth, len(stack))
    return max_depth


def _extract_loop_lines(source_lines: List[str]) -> List[int]:
    loop_lines = []
    for i, line in enumerate(source_lines, 1):
        text = line.strip()
        if re.search(r"\b(for|while)\b", text) or text.startswith("do"):
            loop_lines.append(i)
    return loop_lines


def build_trace_summary(steps: List[Dict[str, Any]], code: str) -> Dict[str, Any]:
    source_lines = code.splitlines()
    total_steps = len(steps)
    line_counts = Counter()
    func_counts = Counter()
    func_order: List[str] = []
    max_stack_depth = 0
    recursion_funcs = Counter()

    variable_changes: Dict[str, Dict[str, Any]] = {}
    last_values: Dict[str, str] = {}

    for step in steps:
        line = step.get("line")
        func = step.get("func")
        if isinstance(line, int) and line > 0:
            line_counts[line] += 1
        if func:
            func_counts[func] += 1
            if func not in func_order:
                func_order.append(func)

        stack_frames = step.get("stack_frames", []) or []
        max_stack_depth = max(max_stack_depth, max(len(stack_frames) - 1, 0))
        frame_funcs = [frame.get("func") for frame in stack_frames if frame.get("func")]
        for name in set(frame_funcs):
            if frame_funcs.count(name) > 1:
                recursion_funcs[name] += 1

        for var in step.get("variables", []) or []:
            name = var.get("name")
            value = var.get("value")
            if not name:
                continue
            if name not in variable_changes:
                variable_changes[name] = {
                    "name": name,
                    "changes": 0,
                    "first_value": value,
                    "last_value": value,
                }
                last_values[name] = value
                continue
            if value != last_values.get(name):
                variable_changes[name]["changes"] += 1
                variable_changes[name]["last_value"] = value
                last_values[name] = value

    backedges = _detect_backedges(steps)
    loop_depth = _estimate_loop_depth(backedges)
    loop_lines = _extract_loop_lines(source_lines)

    repeated_lines = [line for line, count in line_counts.items() if count > 1]
    hot_lines = [
        {
            "line": line,
            "count": count,
            "text": (source_lines[line - 1].strip() if 0 < line <= len(source_lines) else ""),
        }
        for line, count in line_counts.most_common(6)
    ]

    loop_iteration_counts = {
        str(line): line_counts.get(line, 0)
        for line in loop_lines
        if line_counts.get(line, 0) > 0
    }

    var_evolution = sorted(
        variable_changes.values(),
        key=lambda item: item["changes"],
        reverse=True,
    )[:6]

    return {
        "total_steps": total_steps,
        "unique_lines": len(line_counts),
        "hot_lines": hot_lines,
        "repeated_lines": sorted(repeated_lines),
        "loop_depth": loop_depth,
        "nested_loops": loop_depth >= 2,
        "max_loop_iterations": max(loop_iteration_counts.values(), default=0),
        "loop_iteration_counts": loop_iteration_counts,
        "functions_called": func_order[:8],
        "function_call_counts": dict(func_counts.most_common(8)),
        "recursion_depth": max_stack_depth,
        "recursive_functions": [name for name, count in recursion_funcs.items() if count > 0],
        "variable_evolution": var_evolution,
    }
