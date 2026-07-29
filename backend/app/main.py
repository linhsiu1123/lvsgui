"""FastAPI application for the LVS QC document-approval backend.

Sits behind the Next.js console: every request arrives from `lib/backend.ts`
carrying the caller's Keycloak access token, which `security.py` validates.
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import AsyncIterator

from typing import Annotated

from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from . import db
from .config import Settings, get_settings
from .migrations import run_all as run_migrations
from .routers import activity, cases, routing_flows, skills
from .seed import seed_if_empty

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
log = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()

    if settings.bypass_enabled():
        log.warning("AUTH_BYPASS=true - Keycloak token validation is DISABLED. Development only.")
    elif not settings.oidc_configured():
        log.error(
            "KEYCLOAK_ISSUER is not set, so every request will be rejected. "
            "Configure the realm, or set AUTH_BYPASS=true to develop without Keycloak."
        )

    database = await db.connect(settings)
    if settings.seed_on_startup:
        await seed_if_empty(database)
    # After seeding, so a fresh database skips straight through.
    await run_migrations(database)
    try:
        yield
    finally:
        await db.disconnect()


app = FastAPI(
    title="LVS QC Approval API",
    version="0.1.0",
    description="Document approval, routing flows, agent skills and activity feed.",
    lifespan=lifespan,
)

_settings = get_settings()
if _settings.cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=_settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(_: Request, exc: Exception) -> JSONResponse:
    """Never leak a stack trace to the proxy; log it and return a flat shape."""
    log.exception("Unhandled error", exc_info=exc)
    return JSONResponse(status_code=500, content={"error": "internal_error"})


@app.get("/health", tags=["ops"])
async def health(settings: Annotated[Settings, Depends(get_settings)]) -> dict[str, object]:
    """Liveness probe. Deliberately unauthenticated."""
    return {
        "status": "ok",
        "authBypass": settings.bypass_enabled(),
        "oidcConfigured": settings.oidc_configured(),
    }


app.include_router(cases.router)
app.include_router(routing_flows.router)
app.include_router(skills.router)
app.include_router(activity.router)
