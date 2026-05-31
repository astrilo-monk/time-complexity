"""
AI Line Explanation — generate concise, beginner-friendly explanations
of what happens when a specific line of code executes.

Unlike the full code explainer, this targets a single line at a time
with the execution context (variable values, stack) to provide precise,
actionable understanding.
"""

from typing import Any, Dict, List, Optional

from .provider import ask_ai


def _line_explain_system_prompt() -> str:
    return (
        "You are a coding tutor explaining what happens at a specific line during execution. "
        "The student can see the code and current variable values.\n\n"
        "Rules:\n"
        "- Explain WHAT this line does in plain English (1-2 sentences)\n"
        "- Mention concrete variable values when relevant (e.g. 'sets sum to 8 because 5 + 3 = 8')\n"
        "- If it's a loop/condition, explain whether the condition is true or false and why\n"
        "- If it's a function call, explain what function is being called and with what arguments\n"
        "- If it's a return statement, explain what value is being returned and to where\n"
        "- Be concise: maximum 2 sentences\n"
        "- Do NOT use markdown formatting, just plain text\n"
        "- Do NOT repeat the code itself — the student can already see it\n"
        "- Speak directly to the student ('this line...', 'here, the program...')"
    )


def _line_explain_user_prompt(
    code: str,
    language: str,
    line_number: int,
    line_text: str,
    func_name: str,
    variables: List[Dict[str, Any]],
    stack_depth: int,
    prev_line: Optional[int],
    prev_func: Optional[str],
) -> str:
    var_str = ", ".join(
        f"{v['name']}={v['value']}" for v in variables[:10]
    ) if variables else "(none)"

    context_parts = [
        f"Language: {language}",
        f"\n--- Full Code ---\n{code[:3000]}",
        f"\n--- Current Execution Point ---",
        f"Line {line_number}: {line_text}",
        f"Inside function: {func_name}()",
        f"Stack depth: {stack_depth}",
        f"Current variables: {var_str}",
    ]

    if prev_line is not None:
        context_parts.append(f"Previous line was: {prev_line} (in {prev_func or func_name}())")

    context_parts.append(
        "\nExplain what happens when this line executes, using the actual variable values. "
        "Be concise (1-2 sentences max)."
    )

    return "\n".join(context_parts)


async def explain_line(
    code: str,
    language: str,
    line_number: int,
    line_text: str,
    func_name: str,
    variables: List[Dict[str, Any]],
    stack_depth: int = 0,
    prev_line: Optional[int] = None,
    prev_func: Optional[str] = None,
) -> str:
    """
    Generate a concise AI explanation of what happens at a specific line.

    Returns the explanation text (1-2 sentences).
    """
    messages = [
        {"role": "system", "content": _line_explain_system_prompt()},
        {
            "role": "user",
            "content": _line_explain_user_prompt(
                code, language, line_number, line_text,
                func_name, variables, stack_depth,
                prev_line, prev_func,
            ),
        },
    ]
    response, _usage = await ask_ai(messages, temperature=0.2, max_tokens=150)
    return response.strip()
