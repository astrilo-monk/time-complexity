"""
AI Feature endpoints — chat, complexity, explain, summarize, explain-line.
"""

import logging
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from models.requests import (
    AiChatRequest,
    AiComplexityRequest,
    AiExplainRequest,
    AiLineExplainRequest,
    TraceSummaryRequest,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/ai")


@router.post("/chat")
async def ai_chat(request: AiChatRequest, req: Request):
    """AI chatbot — answer questions about the code."""
    try:
        from services.ai import answer_question, is_ai_available

        if not is_ai_available():
            return JSONResponse(
                status_code=503,
                content={"answer": "AI service is not configured. Set GROQ_API_KEY on the server."},
            )

        answer = await answer_question(
            code=request.code,
            language=request.language,
            trace_summary=request.trace_summary,
            question=request.question,
            step_context=request.step_context,
            history=request.chat_history,
        )
        return {"answer": answer}

    except Exception as exc:
        from services.ai.provider import _sanitize_error
        safe = _sanitize_error(str(exc))
        logger.error(f"ai.chat.error | {safe}")
        return JSONResponse(
            status_code=500,
            content={"answer": f"AI error: {safe}"},
        )


@router.post("/complexity")
async def ai_complexity(request: AiComplexityRequest, req: Request):
    """AI time + space complexity analysis."""
    try:
        from services.ai import explain_complexity, is_ai_available

        if not is_ai_available():
            fallback = {
                "estimated_complexity": "O(?)",
                "confidence": 0.0,
                "reasoning": "AI service not configured.",
                "dominant_operations": [],
                "possible_optimizations": [],
            }
            return JSONResponse(
                status_code=503,
                content={
                    "time": fallback,
                    "space": fallback,
                },
            )

        result = await explain_complexity(
            code=request.code,
            language=request.language,
            trace_summary=request.trace_summary,
        )
        return result

    except Exception as exc:
        from services.ai.provider import _sanitize_error
        safe = _sanitize_error(str(exc))
        logger.error(f"ai.complexity.error | {safe}")
        fallback = {
            "estimated_complexity": "O(?)",
            "confidence": 0.0,
            "reasoning": f"AI error: {safe}",
            "dominant_operations": [],
            "possible_optimizations": [],
        }
        return JSONResponse(
            status_code=500,
            content={
                "time": fallback,
                "space": fallback,
            },
        )


@router.post("/explain")
async def ai_explain(request: AiExplainRequest, req: Request):
    """AI code explanation."""
    try:
        from services.ai import explain_code, is_ai_available

        if not is_ai_available():
            return JSONResponse(
                status_code=503,
                content={"explanation": "AI service not configured. Set GROQ_API_KEY."},
            )

        explanation = await explain_code(
            code=request.code,
            language=request.language,
            trace_summary=request.trace_summary,
        )
        return {"explanation": explanation}

    except Exception as exc:
        from services.ai.provider import _sanitize_error
        safe = _sanitize_error(str(exc))
        logger.error(f"ai.explain.error | {safe}")
        return JSONResponse(
            status_code=500,
            content={"explanation": f"AI error: {safe}"},
        )


@router.post("/summarize")
async def ai_summarize(request: TraceSummaryRequest, req: Request):
    """Build a compressed trace summary for AI consumption."""
    try:
        from services.ai import build_trace_summary

        summary = build_trace_summary(request.steps, request.code)
        return {"trace_summary": summary}

    except Exception as exc:
        logger.error(f"ai.summarize.error | {exc}")
        return JSONResponse(
            status_code=500,
            content={"trace_summary": None, "error": str(exc)},
        )


@router.post("/explain-line")
async def ai_explain_line(request: AiLineExplainRequest, req: Request):
    """AI line-level explanation — explain what happens at a specific line during execution."""
    try:
        from services.ai import explain_line, is_ai_available

        if not is_ai_available():
            return JSONResponse(
                status_code=503,
                content={"explanation": "AI service not configured. Set GROQ_API_KEY."},
            )

        explanation = await explain_line(
            code=request.code,
            language=request.language,
            line_number=request.line_number,
            line_text=request.line_text,
            func_name=request.func_name,
            variables=request.variables,
            stack_depth=request.stack_depth,
            prev_line=request.prev_line,
            prev_func=request.prev_func,
        )
        return {"explanation": explanation}

    except Exception as exc:
        from services.ai.provider import _sanitize_error
        safe = _sanitize_error(str(exc))
        logger.error(f"ai.explain_line.error | {safe}")
        return JSONResponse(
            status_code=500,
            content={"explanation": f"AI error: {safe}"},
        )
