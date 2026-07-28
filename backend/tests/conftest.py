from __future__ import annotations

from typing import AsyncIterator

import pytest
from httpx import ASGITransport, AsyncClient

from app.config import Settings, get_settings
from app.db import get_database
from app.main import app
from app.seed import seed_if_empty

from .fake_mongo import FakeDatabase


@pytest.fixture
def settings() -> Settings:
    """Development settings with the Keycloak bypass on."""
    return Settings(
        auth_bypass=True,
        environment="development",
        keycloak_issuer="https://kc.test/realms/lvs",
        keycloak_client_id="lvs-web",
        mongodb_url="mongodb://unused",
        seed_on_startup=False,
    )


@pytest.fixture
def database() -> FakeDatabase:
    return FakeDatabase()


@pytest.fixture
async def seeded(database: FakeDatabase) -> FakeDatabase:
    await seed_if_empty(database)  # type: ignore[arg-type]
    return database


@pytest.fixture
async def client(settings: Settings, database: FakeDatabase) -> AsyncIterator[AsyncClient]:
    """HTTP client bound to the app, with the DB and settings swapped out.

    ASGITransport does not run the lifespan, so no MongoDB connection is made.
    """
    app.dependency_overrides[get_settings] = lambda: settings
    app.dependency_overrides[get_database] = lambda: database
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()
