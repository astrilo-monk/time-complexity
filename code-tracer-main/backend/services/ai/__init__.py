"""
AI Services — Groq-powered learning assistant for Code Tracer.

Modules:
    provider  — OpenAI-compatible Groq client
    prompts   — reusable system/user prompt templates
    summary   — trace compression before AI calls
    explain   — code explanation generation
    complexity— time complexity analysis
    chat      — interactive Q&A chatbot
"""

from .provider import ask_ai, is_ai_available   # noqa: F401
from .summary import build_trace_summary         # noqa: F401
from .explain import explain_code                 # noqa: F401
from .complexity import explain_complexity        # noqa: F401
from .chat import answer_question                 # noqa: F401
from .line_explain import explain_line             # noqa: F401
