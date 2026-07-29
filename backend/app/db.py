"""MongoDB access.

Uses PyMongo's native async client (`AsyncMongoClient`). Motor reached
end-of-life in May 2026, so it is deliberately not used here.

The database handle is provided through a FastAPI dependency so tests can swap
in a double via `app.dependency_overrides`.
"""

from __future__ import annotations

import logging
from typing import Annotated, Any

from fastapi import Depends
from pymongo import AsyncMongoClient
from pymongo.asynchronous.database import AsyncDatabase
from pymongo.errors import ServerSelectionTimeoutError

from .config import Settings, get_settings

log = logging.getLogger(__name__)

CASES = "cases"
ROUTING_FLOWS = "routing_flows"
SKILLS = "skills"
ACTIVITY = "activity"

_client: AsyncMongoClient[dict[str, Any]] | None = None


async def connect(settings: Settings) -> AsyncDatabase[dict[str, Any]]:
    """Open the client and make sure the indexes exist. Called from lifespan."""
    global _client
    _client = AsyncMongoClient(
        settings.mongodb_url,
        tz_aware=True,
        # Fail startup in seconds rather than the 30s default, and say why.
        serverSelectionTimeoutMS=settings.mongodb_timeout_ms,
    )
    database = _client[settings.mongodb_db]
    try:
        await ensure_indexes(database, settings)
    except ServerSelectionTimeoutError as exc:
        await disconnect()
        raise RuntimeError(
            f"Cannot reach MongoDB at {settings.mongodb_url!r}. "
            "Start a MongoDB server or point MONGODB_URL at one."
        ) from exc
    log.info("Connected to MongoDB database %r", settings.mongodb_db)
    return database


async def disconnect() -> None:
    global _client
    if _client is not None:
        await _client.close()
        _client = None


async def ensure_indexes(database: AsyncDatabase[dict[str, Any]], settings: Settings) -> None:
    # `id` is the business key the UI uses (QC-2606), not Mongo's _id.
    await database[CASES].create_index("id", unique=True)
    await database[CASES].create_index("type")
    await database[ROUTING_FLOWS].create_index("name", unique=True)
    await database[SKILLS].create_index("key", unique=True)
    # Feed is always read newest-first.
    await database[ACTIVITY].create_index([("at", -1)])

    # Retention is opt-in: without it the feed grows without bound, but turning
    # it on deletes history, so it only happens when explicitly configured.
    if settings.activity_retention_days > 0:
        await database[ACTIVITY].create_index(
            "at",
            name="activity_ttl",
            expireAfterSeconds=settings.activity_retention_days * 86_400,
        )
        log.info("Activity feed retention: %d days", settings.activity_retention_days)


def get_database() -> AsyncDatabase[dict[str, Any]]:
    """FastAPI dependency returning the connected database."""
    if _client is None:  # pragma: no cover - lifespan always connects first
        raise RuntimeError("MongoDB is not connected; the app lifespan did not run")
    return _client[get_settings().mongodb_db]


Database = Annotated[AsyncDatabase[dict[str, Any]], Depends(get_database)]
