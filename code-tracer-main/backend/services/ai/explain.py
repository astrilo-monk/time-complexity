"""
AI Code Explanation — generate beginner-friendly code explanations.
"""

from typing import Any, Dict, Optional

from .provider import ask_ai
from .prompts import explain_system_prompt, explain_user_prompt


async def explain_code(
    code: str,
    language: str,
    trace_summary: Optional[Dict[str, Any]],
) -> str:
    """
    Generate a beginner-friendly explanation of the code.

    Returns the explanation text.
    """
    messages = [
        {"role": "system", "content": explain_system_prompt()},
        {
            "role": "user",
            "content": explain_user_prompt(code, language, trace_summary),
        },
    ]
    response, _usage = await ask_ai(messages, temperature=0.3, max_tokens=600)
    return response
