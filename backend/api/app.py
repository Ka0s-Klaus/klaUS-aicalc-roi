"""FastAPI application entrypoint.

Run with: uvicorn backend.api.app:app --reload
"""

from fastapi import FastAPI

from backend.api.routes import analyze, catalog, health

app = FastAPI(
    title="klaUS-aicalc-roi API",
    version="0.1.0",
    description="TCO Calculator for AI Infrastructure Decisions — local vs cloud vs hybrid",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.include_router(health.router)
app.include_router(catalog.router)
app.include_router(analyze.router)
