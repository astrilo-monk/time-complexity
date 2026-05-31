"""
Tracer registry — routes language to the correct tracer implementation.
"""

from .sandbox import run_in_sandbox
from .c_tracer import trace_c_local
from .java_tracer import trace_java_local
from .python_tracer import trace_python_local

__all__ = [
    "run_in_sandbox",
    "trace_c_local",
    "trace_java_local",
    "trace_python_local",
]
