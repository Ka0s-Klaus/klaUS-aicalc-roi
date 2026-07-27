FROM python:3.12-slim

WORKDIR /app

# Deps layer — only rebuilds when dep versions change
RUN pip install --no-cache-dir \
    "fastapi>=0.115.0" \
    "uvicorn[standard]>=0.30.0" \
    "pydantic>=2.9.0" \
    "httpx>=0.27.0"

# Application code — backend only (no tests, no frontend)
COPY backend/ ./backend/

EXPOSE 8000

# Railway injects $PORT; fallback to 8000 for other platforms
CMD ["sh", "-c", "uvicorn backend.api.app:app --host 0.0.0.0 --port ${PORT:-8000}"]
