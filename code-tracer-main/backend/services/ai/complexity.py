import json
import re
from typing import Any, Dict, Optional

from .provider import ask_ai
from .prompts import complexity_system_prompt, complexity_user_prompt


def _extract_json(text: str) -> Optional[Dict[str, Any]]:
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    match = re.search(r"\{.*\}", text, re.DOTALL)
    if not match:
        return None
    try:
        return json.loads(match.group(0))
    except json.JSONDecodeError:
        return None


def _fallback_response() -> Dict[str, Any]:
    return {
        "estimated_complexity": "O(?)",
        "confidence": 0.0,
        "reasoning": "Insufficient data to estimate complexity. This is only an inferred guess.",
        "dominant_operations": [],
        "possible_optimizations": [],
    }


def _normalize_section(section: Any) -> Dict[str, Any]:
    if not isinstance(section, dict):
        return _fallback_response()

    return {
        "estimated_complexity": section.get("estimated_complexity", "O(?)"),
        "confidence": float(section.get("confidence", 0.0)),
        "reasoning": section.get("reasoning", ""),
        "dominant_operations": section.get("dominant_operations", []),
        "possible_optimizations": section.get("possible_optimizations", []),
    }


async def explain_complexity(
    code: str,
    language: str,
    trace_summary: Optional[Dict[str, Any]],
) -> Dict[str, Any]:
    messages = [
        {"role": "system", "content": complexity_system_prompt()},
        {
            "role": "user",
            "content": complexity_user_prompt(code, language, trace_summary),
        },
    ]
    response, _usage = await ask_ai(messages, temperature=0.2, max_tokens=600)
    parsed = _extract_json(response)
    if not isinstance(parsed, dict):
        fallback = _fallback_response()
        return {"time": fallback, "space": fallback}

    if "time" in parsed or "space" in parsed:
        return {
            "time": _normalize_section(parsed.get("time")),
            "space": _normalize_section(parsed.get("space")),
        }

    # Backward compatibility with older single-block responses
    return {
        "time": _normalize_section(parsed),
        "space": _fallback_response(),
    }
