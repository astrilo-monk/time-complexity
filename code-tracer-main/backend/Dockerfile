FROM python:3.12-slim

# Install system dependencies: gcc, gdb, JDK
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    gdb \
    g++ \
    default-jdk \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy requirements first for layer caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code (modular structure)
COPY config.py .
COPY app.py .
COPY server.py .
COPY models/ ./models/
COPY routes/ ./routes/
COPY tracers/ ./tracers/
COPY middleware/ ./middleware/
COPY services/ ./services/
COPY sandbox/ ./sandbox/

# Pre-compile JavaTracer so we don't waste 2s per request on JDI fallback
RUN javac -g -d /app/sandbox /app/sandbox/JavaTracer.java || true

# Expose port (Render sets PORT env var)
EXPOSE 8000

# Run with dynamic port from Render
CMD uvicorn server:app --host 0.0.0.0 --port ${PORT:-8000}
