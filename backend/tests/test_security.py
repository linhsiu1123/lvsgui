"""Keycloak token validation.

Tokens are signed with a throwaway RSA key generated in-process and the JWKS
lookup is redirected at it, so the real `jwt.decode` path — signature, issuer,
expiry, audience, azp — is exercised end to end.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi import HTTPException

from app import security
from app.config import Settings

ISSUER = "https://kc.test/realms/lvs"

private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
public_key = private_key.public_key()


@pytest.fixture(autouse=True)
def stub_jwks(monkeypatch: pytest.MonkeyPatch) -> None:
    """Point signing-key resolution at our in-process public key."""

    class StubKey:
        key = public_key

    class StubClient:
        def get_signing_key_from_jwt(self, _token: str) -> StubKey:
            return StubKey()

    monkeypatch.setattr(security, "_jwk_client", lambda _url: StubClient())


@pytest.fixture
def settings() -> Settings:
    return Settings(keycloak_issuer=ISSUER, keycloak_client_id="lvs-web", auth_bypass=False)


def make_token(**overrides: Any) -> str:
    now = datetime.now(timezone.utc)
    claims: dict[str, Any] = {
        "sub": "user-uuid-1",
        "iss": ISSUER,
        "azp": "lvs-web",
        "preferred_username": "lin",
        "email": "lin@lvs.test",
        "exp": now + timedelta(minutes=5),
        "iat": now,
        "realm_access": {"roles": ["approver"]},
        "resource_access": {"lvs-web": {"roles": ["admin"]}},
    }
    claims.update(overrides)
    return jwt.encode(claims, private_key, algorithm="RS256")


class TestDecodeToken:
    def test_accepts_a_well_formed_token(self, settings: Settings) -> None:
        claims = security.decode_token(make_token(), settings)
        assert claims["preferred_username"] == "lin"

    def test_rejects_an_expired_token(self, settings: Settings) -> None:
        stale = datetime.now(timezone.utc) - timedelta(hours=1)
        with pytest.raises(HTTPException) as exc:
            security.decode_token(make_token(exp=stale, iat=stale), settings)
        assert exc.value.status_code == 401
        assert "expired" in exc.value.detail["detail"]

    def test_rejects_a_token_from_another_realm(self, settings: Settings) -> None:
        with pytest.raises(HTTPException) as exc:
            security.decode_token(make_token(iss="https://evil.test/realms/other"), settings)
        assert exc.value.status_code == 401

    def test_rejects_a_token_issued_to_another_client(self, settings: Settings) -> None:
        with pytest.raises(HTTPException) as exc:
            security.decode_token(make_token(azp="some-other-app"), settings)
        assert "another client" in exc.value.detail["detail"]

    def test_rejects_a_token_signed_by_a_different_key(self, settings: Settings) -> None:
        other = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        forged = jwt.encode({"sub": "x", "iss": ISSUER, "exp": datetime.now(timezone.utc) + timedelta(minutes=5)},
                            other, algorithm="RS256")
        with pytest.raises(HTTPException) as exc:
            security.decode_token(forged, settings)
        assert exc.value.status_code == 401

    def test_rejects_a_token_missing_required_claims(self, settings: Settings) -> None:
        now = datetime.now(timezone.utc)
        no_sub = jwt.encode({"iss": ISSUER, "exp": now + timedelta(minutes=5)}, private_key, algorithm="RS256")
        with pytest.raises(HTTPException):
            security.decode_token(no_sub, settings)

    def test_verifies_audience_when_one_is_configured(self) -> None:
        settings = Settings(keycloak_issuer=ISSUER, keycloak_audience="lvs-api", auth_bypass=False)

        assert security.decode_token(make_token(aud="lvs-api"), settings)["aud"] == "lvs-api"

        with pytest.raises(HTTPException) as exc:
            security.decode_token(make_token(aud="account"), settings)
        assert "audience" in exc.value.detail["detail"]

    def test_reports_a_missing_realm_as_a_configuration_error(self) -> None:
        with pytest.raises(HTTPException) as exc:
            security.decode_token(make_token(), Settings(keycloak_issuer="", auth_bypass=False))
        assert exc.value.status_code == 500
        assert exc.value.detail["error"] == "oidc_not_configured"


class TestPrincipal:
    def test_flattens_realm_and_client_roles(self, settings: Settings) -> None:
        claims = security.decode_token(make_token(), settings)
        principal = security.principal_from_claims(claims, settings)

        assert principal.username == "lin"
        assert principal.email == "lin@lvs.test"
        assert principal.roles == frozenset({"approver", "admin"})

    def test_display_name_falls_back_to_the_subject(self, settings: Settings) -> None:
        claims = security.decode_token(make_token(preferred_username=None, name=None), settings)
        assert security.principal_from_claims(claims, settings).display_name == "user-uuid-1"


class TestBypassGuard:
    def test_bypass_applies_only_in_development(self) -> None:
        assert Settings(auth_bypass=True, environment="development").bypass_enabled() is True
        assert Settings(auth_bypass=True, environment="production").bypass_enabled() is False
        assert Settings(auth_bypass=False, environment="development").bypass_enabled() is False
