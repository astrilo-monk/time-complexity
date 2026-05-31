"""
Code Tracer — Backward-compatible entry point.

This is a thin shim that imports the FastAPI app from the modular app factory.
Preserves the `uvicorn server:app` startup command.

For the full application, see app.py.
"""

from app import app  # noqa: F401
