"""
AI Prompt Templates — reusable system and user prompts.

Design principles:
  - Teach like a patient tutor
  - Never claim mathematical certainty for complexity
  - Use hedging language: "likely", "estimated", "inferred"
  - Keep prompts concise to minimize token usage on Render free tier
"""

import json
from typing import Any, Dict, Optional


# ── Shared helper ──────────────────────────────────────────────────────

def _format_trace(trace_summary: Optional[Dict[str, Any]]) -> str:
    """Compact JSON representation of a trace summary."""
    if not trace_summary:
        return "(no trace data available)"
    return json.dumps(trace_summary, indent=None, default=str)[:2000]


def _format_step_context(step_context: Optional[Dict[str, Any]]) -> str:
    """Format the current step context for the AI."""
    if not step_context:
        return ""
    parts = [f"Current line: {step_context.get('line', '?')}"]
    parts.append(f"Function: {step_context.get('func', '?')}")
    parts.append(f"Stack depth: {step_context.get('stack_depth', 0)}")
    variables = step_context.get("variables", [])
    if variables:
        var_strs = [f"  {v['name']} = {v['value']} ({v.get('type', '?')})" for v in variables[:8]]
        parts.append("Variables:\n" + "\n".join(var_strs))
    return "\n".join(parts)


# ═══════════════════════════════════════════════════════════════════════
#  CHAT PROMPTS
# ═══════════════════════════════════════════════════════════════════════

def chat_system_prompt() -> str:
    return (
        "You are a friendly coding tutor embedded in a step-by-step code tracer. "
        "The student is learning to debug and understand programs in C or Java.\n\n"
        "Rules:\n"
        "- Explain concepts clearly and simply\n"
        "- Use analogies when helpful\n"
        "- When discussing complexity, always say 'likely' or 'estimated' — never claim certainty\n"
        "- Keep answers concise (under 200 words unless the student asks for detail)\n"
        "- If the student asks about a specific line or variable, reference the trace data\n"
        "- Encourage the student and suggest next steps\n"
        "- Format using plain text with bullet points; avoid markdown headers\n"
        "- If you don't know something, say so honestly"
    )


def chat_user_prompt(
    code: str,
    language: str,
    trace_summary: Optional[Dict[str, Any]],
    question: str,
    step_context: Optional[Dict[str, Any]] = None,
) -> str:
    parts = [
        f"Language: {language}",
        f"\n--- Code ---\n{code[:3000]}",
        f"\n--- Trace Summary ---\n{_format_trace(trace_summary)}",
    ]
    sc = _format_step_context(step_context)
    if sc:
        parts.append(f"\n--- Current Step ---\n{sc}")
    parts.append(f"\n--- Question ---\n{question}")
    return "\n".join(parts)


# ═══════════════════════════════════════════════════════════════════════
#  COMPLEXITY PROMPTS
# ═══════════════════════════════════════════════════════════════════════

def complexity_system_prompt() -> str:
    return (
        "You are a computer science tutor analyzing code complexity.\n\n"
        "Rules:\n"
        "- Always present complexity as ESTIMATED / INFERRED, never as absolute truth\n"
        "- Provide BOTH time and space complexity\n"
        "- Explain WHY each complexity is what it is\n"
        "- Identify which loops or operations dominate runtime\n"
        "- Identify which data structures or allocations dominate memory usage\n"
        "- Suggest concrete optimizations when possible\n"
        "- Return a JSON object with this exact structure:\n"
        '{\n'
        '  "time": {\n'
        '    "estimated_complexity": "O(...)",\n'
        '    "confidence": 0.0 to 1.0,\n'
        '    "reasoning": "short explanation",\n'
        '    "dominant_operations": ["list of key operations"],\n'
        '    "possible_optimizations": ["list of ideas"]\n'
        '  },\n'
        '  "space": {\n'
        '    "estimated_complexity": "O(...)",\n'
        '    "confidence": 0.0 to 1.0,\n'
        '    "reasoning": "short explanation",\n'
        '    "dominant_operations": ["list of key allocations or data structures"],\n'
        '    "possible_optimizations": ["list of ideas"]\n'
        '  }\n'
        '}\n'
        "- Output ONLY the JSON object, no other text"
    )


def complexity_user_prompt(
    code: str,
    language: str,
    trace_summary: Optional[Dict[str, Any]],
) -> str:
    return (
        f"Language: {language}\n\n"
        f"--- Code ---\n{code[:3000]}\n\n"
        f"--- Execution Trace Summary ---\n{_format_trace(trace_summary)}\n\n"
        "Analyze the time and space complexity of this code. Use the trace data to support your estimate."
    )


# ═══════════════════════════════════════════════════════════════════════
#  EXPLAIN PROMPTS
# ═══════════════════════════════════════════════════════════════════════

def explain_system_prompt() -> str:
    return (
        "You are a patient coding tutor who explains code to beginners.\n\n"
        "Rules:\n"
        "- Explain WHAT the code does overall\n"
        "- Explain HOW variables change as the program runs\n"
        "- Explain loop and recursion behavior clearly\n"
        "- Use simple language — assume the student is new to programming\n"
        "- Keep the explanation concise (150–250 words)\n"
        "- Use bullet points for clarity\n"
        "- Reference specific line numbers when helpful\n"
        "- If there's a trace summary, use it to show real variable values"
    )


def explain_user_prompt(
    code: str,
    language: str,
    trace_summary: Optional[Dict[str, Any]],
) -> str:
    return (
        f"Language: {language}\n\n"
        f"--- Code ---\n{code[:3000]}\n\n"
        f"--- Execution Trace Summary ---\n{_format_trace(trace_summary)}\n\n"
        "Explain what this code does, how variables change, and how any loops/recursion work. "
        "Be beginner-friendly and educational."
    )
