"""
Centralized configuration for Code Tracer backend.

All environment-based settings in one place. Loaded once at startup.
"""

import os
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')


@dataclass(frozen=True)
class Settings:
    # ── Paths ──
    root_dir: Path = ROOT_DIR

    # ── Code limits ──
    max_code_size: int = 50_000
    max_output_bytes: int = 100_000
    max_steps: int = 500_000

    # ── Docker sandbox ──
    sandbox_enabled: bool = False
    sandbox_image: str = "code-tracer-sandbox"
    container_timeout: int = 120
    docker_memory: str = "256m"
    docker_cpus: str = "0.5"
    docker_pids_limit: str = "50"
    max_concurrent: int = 3
    seccomp_profile: str = ""

    # ── Rate limiting ──
    rate_limit: int = 10
    rate_window: int = 60

    # ── MongoDB (optional) ──
    mongo_url: str = ""
    db_name: str = "ctrace"

    # ── CORS ──
    cors_origins: list = field(default_factory=list)

    # ── Environment ──
    environment: str = "development"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Load settings from environment variables. Cached singleton."""
    cors_env = os.environ.get('CORS_ORIGINS', '').strip()
    cors_origins = [o.strip() for o in cors_env.split(',') if o.strip()] if cors_env else []
    cors_origins += ["http://localhost:3000", "http://127.0.0.1:3000"]

    seccomp_default = str(ROOT_DIR / "sandbox" / "seccomp-profile.json")

    return Settings(
        max_code_size=int(os.environ.get("MAX_CODE_SIZE", "50000")),
        max_output_bytes=int(os.environ.get("MAX_OUTPUT_BYTES", "100000")),
        max_steps=int(os.environ.get("MAX_STEPS", "500000")),
        sandbox_enabled=os.environ.get("SANDBOX_ENABLED", "false").lower() == "true",
        sandbox_image=os.environ.get("SANDBOX_IMAGE", "code-tracer-sandbox"),
        container_timeout=int(os.environ.get("CONTAINER_TIMEOUT", "120")),
        docker_memory=os.environ.get("DOCKER_MEMORY", "256m"),
        docker_cpus=os.environ.get("DOCKER_CPUS", "0.5"),
        docker_pids_limit=os.environ.get("DOCKER_PIDS_LIMIT", "50"),
        max_concurrent=int(os.environ.get("MAX_CONCURRENT", "3")),
        seccomp_profile=os.environ.get("SECCOMP_PROFILE", seccomp_default),
        rate_limit=int(os.environ.get("RATE_LIMIT", "10")),
        rate_window=int(os.environ.get("RATE_WINDOW", "60")),
        mongo_url=os.environ.get("MONGO_URL", ""),
        db_name=os.environ.get("DB_NAME", "ctrace"),
        cors_origins=cors_origins,
        environment=os.environ.get("ENVIRONMENT", "development").lower(),
    )
