"""
Pydantic request/response models for Code Tracer API.
"""

from pydantic import BaseModel, Field
from typing import Any, Dict, List, Optional

from config import get_settings

_settings = get_settings()


class RunCodeRequest(BaseModel):
    code: str = Field(..., max_length=_settings.max_code_size)
    language: str = "c"
    inputs: List[str] = []
    run_id: Optional[str] = None


class CancelRunRequest(BaseModel):
    run_id: str


class AiChatRequest(BaseModel):
    code: str = Field(..., max_length=_settings.max_code_size)
    language: str = "c"
    trace_summary: Optional[Dict[str, Any]] = None
    question: str = Field(..., max_length=2000)
    step_context: Optional[Dict[str, Any]] = None
    chat_history: Optional[List[Dict[str, str]]] = None


class AiComplexityRequest(BaseModel):
    code: str = Field(..., max_length=_settings.max_code_size)
    language: str = "c"
    trace_summary: Optional[Dict[str, Any]] = None


class AiExplainRequest(BaseModel):
    code: str = Field(..., max_length=_settings.max_code_size)
    language: str = "c"
    trace_summary: Optional[Dict[str, Any]] = None


class TraceSummaryRequest(BaseModel):
    code: str = Field(..., max_length=_settings.max_code_size)
    steps: List[Dict[str, Any]] = []


class AiLineExplainRequest(BaseModel):
    code: str = Field(..., max_length=_settings.max_code_size)
    language: str = "c"
    line_number: int
    line_text: str = Field(..., max_length=500)
    func_name: str = Field(..., max_length=200)
    variables: List[Dict[str, Any]] = []
    stack_depth: int = 0
    prev_line: Optional[int] = None
    prev_func: Optional[str] = None
