"""
Code Tracer — FastAPI Application Factory

Assembles the app from modular routers and middleware.
Backward compatible: `uvicorn server:app` still works via the server.py shim.
"""

import logging
import os
import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware

from config import get_settings

_settings = get_settings()

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
)
logger = logging.getLogger(__name__)

# Security Safeguard: Prevent insecure local fallback in production
if _settings.environment == "production" and not _settings.sandbox_enabled:
    logger.critical(
        "SECURITY FATAL: Refusing to start in 'production' environment "
        "with SANDBOX_ENABLED=false. This permits Remote Code Execution."
    )
    sys.exit(1)


# ── MongoDB (optional) ──
db = None
_mongo_client = None

if _settings.mongo_url:
    from motor.motor_asyncio import AsyncIOMotorClient
    _mongo_client = AsyncIOMotorClient(_settings.mongo_url)
    db = _mongo_client[_settings.db_name]


@asynccontextmanager
async def lifespan(application: FastAPI):
    """App startup/shutdown lifecycle."""
    logger.info(
        f"Code Tracer starting | sandbox={_settings.sandbox_enabled} "
        f"env={_settings.environment} max_concurrent={_settings.max_concurrent}"
    )
    yield
    # Shutdown
    if _mongo_client:
        _mongo_client.close()
        logger.info("MongoDB connection closed")


def create_app() -> FastAPI:
    """Build and configure the FastAPI application."""
    application = FastAPI(lifespan=lifespan)

    # ── Register routers ──
    from routes import health_router, run_router, ai_router

    # Health check at root level
    @application.get("/health")
    def health():
        return {
            "status": "ok",
            "sandbox_enabled": _settings.sandbox_enabled,
            "environment": _settings.environment,
        }

    # API routes under /api prefix
    from fastapi import APIRouter
    api_router = APIRouter(prefix="/api")
    api_router.include_router(health_router)
    api_router.include_router(run_router)
    api_router.include_router(ai_router)
    application.include_router(api_router)

    # ── CORS ──
    application.add_middleware(
        CORSMiddleware,
        allow_credentials=True,
        allow_origins=_settings.cors_origins,
        allow_origin_regex=r"https://.*\.vercel\.app",
        allow_methods=["*"],
        allow_headers=["*"],
    )

    return application


# Module-level app instance for `uvicorn app:app`
app = create_app()
