from typing import Any, Dict, Iterable, List, Optional

from .provider import ask_ai
from .prompts import chat_system_prompt, chat_user_prompt


def _normalize_history(history: Optional[Iterable[Dict[str, Any]]]) -> List[Dict[str, str]]:
    if not history:
        return []
    normalized = []
    for message in history:
        role = message.get("role") or "user"
        content = message.get("content") or ""
        if role not in ("user", "assistant"):
            role = "user"
        normalized.append({"role": role, "content": content})
    return normalized[-8:]


async def answer_question(
    code: str,
    language: str,
    trace_summary: Optional[Dict[str, Any]],
    question: str,
    step_context: Optional[Dict[str, Any]] = None,
    history: Optional[Iterable[Dict[str, Any]]] = None,
) -> str:
    messages = [
        {"role": "system", "content": chat_system_prompt()},
    ]

    messages.extend(_normalize_history(history))
    messages.append({
        "role": "user",
        "content": chat_user_prompt(code, language, trace_summary, question, step_context),
    })

    response, _usage = await ask_ai(messages, temperature=0.3, max_tokens=700)
    return response
