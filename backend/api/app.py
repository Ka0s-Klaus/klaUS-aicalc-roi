"""FastAPI application entrypoint.

Run with: uvicorn backend.api.app:app --reload
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.api.routes import analyze, catalog, health

app = FastAPI(
    title="klaUS-aicalc-roi API",
    version="0.1.0",
    description="TCO Calculator for AI Infrastructure Decisions — local vs cloud vs hybrid",
    docs_url="/docs",
    redoc_url="/redoc",
)

# Fase 1: allow_origins=["*"] para desarrollo local y demos.
# Fase 2 (producción): restringir a [VERCEL_URL] via variable de entorno.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(catalog.router)
app.include_router(analyze.router)
