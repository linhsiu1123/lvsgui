"""Keycloak OIDC bearer-token validation.

`lib/backend.ts` in the Next.js app forwards the user's Keycloak access token on
every proxied call. This module is the other end of that: it verifies the token's
signature against the realm's JWKS, checks the issuer and expiry, and turns the
claims into a `Principal` the routers can attribute actions to.

Signing keys are fetched from the realm's JWKS endpoint and cached by PyJWT's
`PyJWKClient`, which also re-fetches when it meets an unknown `kid` (key rotation).
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from functools import lru_cache
from typing import Annotated, Any

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .config import Settings, get_settings

log = logging.getLogger(__name__)

# auto_error=False so a missing header produces our own 401 shape rather than
# FastAPI's, keeping every error body consistent for the Next.js proxy.
bearer_scheme = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class Principal:
    """The authenticated caller."""

    subject: str
    username: str
    email: str | None = None
    roles: frozenset[str] = frozenset()

    @property
    def display_name(self) -> str:
        return self.username or self.email or self.subject


DEBUG_PRINCIPAL = Principal(
    subject="auth-bypass",
    username="Debug User",
    email="debug@localhost",
    roles=frozenset({"approver", "admin"}),
)


def _unauthorized(detail: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail={"error": "not_authenticated", "detail": detail},
        headers={"WWW-Authenticate": "Bearer"},
    )


@lru_cache
def _jwk_client(jwks_url: str) -> jwt.PyJWKClient:
    # Cached per URL: the client keeps its own key cache between requests.
    return jwt.PyJWKClient(jwks_url, cache_keys=True)


def _extract_roles(claims: dict[str, Any], client_id: str) -> frozenset[str]:
    """Collect realm roles and this client's roles into one flat set."""
    realm = claims.get("realm_access", {}).get("roles", []) or []
    resource = claims.get("resource_access", {}).get(client_id, {}).get("roles", []) or []
    return frozenset({*realm, *resource})


def decode_token(token: str, settings: Settings) -> dict[str, Any]:
    """Verify a Keycloak access token and return its claims.

    Raises HTTPException(401) on any validation failure.
    """
    if not settings.oidc_configured():
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "error": "oidc_not_configured",
                "detail": "KEYCLOAK_ISSUER is not set. Set AUTH_BYPASS=true to run without Keycloak.",
            },
        )

    try:
        signing_key = _jwk_client(settings.jwks_url).get_signing_key_from_jwt(token)
    except jwt.PyJWKClientError as exc:
        log.warning("Could not resolve a signing key for the presented token: %s", exc)
        raise _unauthorized("token signing key could not be resolved") from exc

    audience = settings.keycloak_audience or None
    try:
        claims: dict[str, Any] = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256", "RS512", "ES256"],
            issuer=settings.keycloak_issuer,
            audience=audience,
            leeway=settings.jwt_leeway_seconds,
            options={
                "require": ["exp", "iss", "sub"],
                "verify_aud": audience is not None,
            },
        )
    except jwt.ExpiredSignatureError as exc:
        raise _unauthorized("token has expired") from exc
    except jwt.InvalidIssuerError as exc:
        raise _unauthorized("token was issued by an unexpected issuer") from exc
    except jwt.InvalidAudienceError as exc:
        raise _unauthorized("token audience does not match") from exc
    except jwt.InvalidTokenError as exc:
        raise _unauthorized(f"token is not valid: {exc}") from exc

    # Keycloak puts the requesting client in `azp`. When audience checking is
    # off this is the only thing tying the token to our client, so verify it.
    if audience is None:
        azp = claims.get("azp")
        if azp and azp != settings.keycloak_client_id:
            raise _unauthorized(f"token was issued to another client ({azp})")

    return claims


def principal_from_claims(claims: dict[str, Any], settings: Settings) -> Principal:
    return Principal(
        subject=claims["sub"],
        username=claims.get("preferred_username") or claims.get("name") or claims["sub"],
        email=claims.get("email"),
        roles=_extract_roles(claims, settings.keycloak_client_id),
    )


async def current_principal(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> Principal:
    """FastAPI dependency: the authenticated caller, or 401."""
    if settings.bypass_enabled():
        return DEBUG_PRINCIPAL

    if credentials is None or not credentials.credentials:
        raise _unauthorized("missing bearer token")

    return principal_from_claims(decode_token(credentials.credentials, settings), settings)


CurrentPrincipal = Annotated[Principal, Depends(current_principal)]
