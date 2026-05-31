"""
Health check and root info endpoints.
"""

import os
from fastapi import APIRouter
from config import get_settings

router = APIRouter()
_settings = get_settings()


@router.get("/")
async def root():
    return {
        "message": "Code Tracer API is running",
        "sandbox": _settings.sandbox_enabled,
        "max_concurrent": _settings.max_concurrent,
    }
