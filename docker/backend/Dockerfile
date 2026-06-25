# ─────────────────────────────────────────────────────────────
# Stage 1 — dependency builder
# ─────────────────────────────────────────────────────────────
FROM python:3.12.3-slim AS builder

WORKDIR /build

# Install build tools, then clean up in same layer
RUN apt-get update \
    && apt-get install -y --no-install-recommends gcc \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# ─────────────────────────────────────────────────────────────
# Stage 2 — runtime (lean, no build tools)
# ─────────────────────────────────────────────────────────────
FROM python:3.12.3-slim AS runtime

# Install curl for HEALTHCHECK only
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

# Non-root user
RUN groupadd -r appgroup \
    && useradd -r -g appgroup -d /app -s /sbin/nologin appuser

WORKDIR /app

# Copy installed packages from builder stage
COPY --from=builder /install /usr/local

# Copy application source (only what the API server needs)
COPY api/      ./api/
COPY config/   ./config/
COPY findings/ ./findings/
COPY exports/  ./exports/
COPY risk/     ./risk/
COPY rules/    ./rules/
COPY utils/    ./utils/

# Pre-create runtime directories; bind mounts will overlay these
RUN mkdir -p data/exports data/raw snapshots media/uploads \
    && chown -R appuser:appgroup /app

USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1

CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000"]
