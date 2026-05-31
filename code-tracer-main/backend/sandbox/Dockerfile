# =============================================================================
# Code Tracer — Sandbox Container (hardened)
# =============================================================================

FROM python:3.12-slim

# Install tracing toolchains
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    gdb \
    g++ \
    default-jdk \
    && rm -rf /var/lib/apt/lists/*

# Install pygdbmi
RUN pip install --no-cache-dir pygdbmi==0.11.0.0

# Create non-root user
RUN groupadd -r sandbox && useradd -r -g sandbox -d /home/sandbox -s /usr/sbin/nologin sandbox \
    && mkdir -p /home/sandbox && chown sandbox:sandbox /home/sandbox

# Create workspace owned by sandbox user
RUN mkdir -p /workspace && chown sandbox:sandbox /workspace

# Copy trace runner (read-only)
COPY trace_runner.py /opt/trace_runner.py
RUN chmod 444 /opt/trace_runner.py

# Copy and compile JavaTracer
COPY JavaTracer.java /opt/JavaTracer.java
RUN javac -g /opt/JavaTracer.java && chmod 444 /opt/JavaTracer.class

# Copy seccomp profile into image for reference (used at runtime via host mount)
COPY seccomp-profile.json /opt/seccomp-profile.json

WORKDIR /workspace
USER sandbox

ENTRYPOINT ["python3", "/opt/trace_runner.py"]
