# AI Services — Code Tracer

This folder implements an AI integration layer for Code Tracer. It provides a modular, provider-agnostic client and service modules for explanation, complexity estimation, and chat.

Files
- `provider.py` — reusable AI client that supports Groq or OpenRouter (OpenAI-compatible) and exposes `ask_ai()` and `stream_ai_response()`.
- `prompts.py` — central prompt engineering helpers and system/user prompt templates.
- `summary.py` — compresses a full trace into a concise `trace_summary` object sent to the AI (loop depth, repeated lines, hot lines, variable evolution, recursion depth, etc.).
- `explain.py` — high-level wrapper to request code explanations from the AI.
- `complexity.py` — wrapper that asks the AI to output a JSON complexity estimate and parses it safely.
- `chat.py` — chat wrapper that supports lightweight chat history and includes `step_context` for targeted questions.

Environment variables
- `AI_PROVIDER` (optional) — preferred provider: `groq` or `openrouter`. If omitted, selection follows which API key is present.
- `GROQ_API_KEY` — API key for Groq (if using Groq).
- `GROQ_BASE_URL` (optional) — overrides Groq base URL.
- `GROQ_MODEL` (optional) — model id to call on Groq.
- `OPENROUTER_API_KEY` — API key for OpenRouter (if using OpenRouter).
- `OPENROUTER_BASE_URL` (optional) — overrides OpenRouter base URL.
- `OPENROUTER_MODEL` (optional) — model id to call on OpenRouter.

Design notes & constraints
- Prompts are intentionally conservative: AI must use language like "likely", "inferred", "estimated" for complexity.
- Trace payloads are summarized by `summary.build_trace_summary()` to avoid sending huge raw traces.
- The provider client limits prompt size and truncates long content.
- The complexity endpoint expects the model to return JSON; we robustly extract JSON and fall back to a safe default if parsing fails.
- No local models; the provider calls external APIs. Keys are read from environment variables, never hardcoded.

API endpoints
- `POST /api/ai/explain` — request a textual explanation (overview, step, optimization). Accepts `code`, `language`, `trace_summary`, `focus`, `step_context`.
- `POST /api/ai/complexity` — request a JSON complexity estimate. Accepts `code`, `language`, `trace_summary`.
- `POST /api/ai/chat` — chat endpoint. Accepts `code`, `language`, `trace_summary`, `question`, optional `chat_history` and `step_context`.

Security & costs
- Beware of prompt/usage costs. The client sets `max_tokens` and truncates prompts to reasonable lengths.
- Rate-limit access to AI endpoints if deploying publicly (not included here).

Quick testing (local)
1. Ensure backend virtualenv is active and `requirements.txt` includes `httpx`.
2. Set one of the API keys in `.env` (example below).
3. Run backend: `uvicorn server:app --reload --port 8000`.
4. Use `curl` or the frontend to call `/api/ai/explain`, `/api/ai/complexity`, `/api/ai/chat`.

Example `.env` (local dev)

GROQ_API_KEY=your_groq_key_here
# or
OPENROUTER_API_KEY=your_openrouter_key_here

# Optional provider override
AI_PROVIDER=openrouter


If you want me to, I can:
- Add server-side request rate-limiting for AI endpoints.
- Add logging/per-request tracing of token usage.
- Add streaming support to the frontend (SSE/WebSocket) for partial AI responses.
