"""
Wine Cellar SPC Dashboard — FastAPI backend.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import db
from config import settings
from routers.readings import router as readings_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await db.init_pool()
    yield
    # Shutdown
    await db.close_pool()


app = FastAPI(
    title="Wine Cellar SPC Dashboard",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(readings_router)


@app.get("/api/health")
async def health():
    """Health check — also verifies DB connectivity."""
    try:
        row = await db.get_pool().fetchval("SELECT 1")
        return {"status": "ok", "db": "connected"}
    except Exception as e:
        return {"status": "degraded", "db": str(e)}
