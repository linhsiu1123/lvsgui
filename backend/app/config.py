"""Backend settings, read from the environment (and `backend/.env`).

Mirrors the Next.js frontend's configuration so both halves of the stack agree
on the Keycloak realm and on the development auth bypass.
"""

from __future__ import annotations

import logging
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict

log = logging.getLogger(__name__)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # ── MongoDB ──
    mongodb_url: str = "mongodb://localhost:27017"
    mongodb_db: str = "lvsqc"
    # How long to wait for a reachable server before failing startup.
    mongodb_timeout_ms: int = 5000

    # ── Keycloak / OIDC ──
    # Issuer, e.g. https://keycloak.example.com/realms/lvs
    keycloak_issuer: str = ""
    # The frontend's client id. Keycloak stamps it into the token's `azp`.
    keycloak_client_id: str = "lvs-web"
    # Expected `aud`. Keycloak commonly issues `account` rather than the client
    # id, so audience checking is opt-in: leave empty and `azp` is checked.
    keycloak_audience: str = ""
    # Clock skew tolerated when validating exp/nbf, in seconds.
    jwt_leeway_seconds: int = 30

    # ── Development escape hatch ──
    # Mirrors AUTH_BYPASS in the Next.js app: skip token validation entirely so
    # the stack runs with no Keycloak realm. Refused outside development.
    auth_bypass: bool = False
    environment: str = "development"

    # ── Behaviour ──
    # Insert the demo fixtures when the collections are empty.
    seed_on_startup: bool = True
    # Days to keep activity-feed entries. 0 keeps them forever; any positive
    # value installs a TTL index so MongoDB expires them. Opt-in, because
    # turning it on starts deleting data.
    activity_retention_days: int = 0
    # Origins allowed to call this API directly (the Next.js proxy is server-
    # side and needs none of these; useful when hitting the API from a browser).
    cors_origins: list[str] = []

    @property
    def is_production(self) -> bool:
        return self.environment.lower() == "production"

    def bypass_enabled(self) -> bool:
        """True when token validation should be skipped. Never in production."""
        if not self.auth_bypass:
            return False
        if self.is_production:
            log.error(
                "AUTH_BYPASS=true was set in a production environment and has been IGNORED. "
                "Keycloak token validation remains enforced."
            )
            return False
        return True

    def oidc_configured(self) -> bool:
        return bool(self.keycloak_issuer)

    @property
    def jwks_url(self) -> str:
        return f"{self.keycloak_issuer.rstrip('/')}/protocol/openid-connect/certs"


@lru_cache
def get_settings() -> Settings:
    return Settings()
