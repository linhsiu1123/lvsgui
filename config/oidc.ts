/**
 * OIDC / Keycloak configuration.
 *
 * All authentication settings are sourced from environment variables and
 * centralized here so `auth.ts`, the middleware, and the token-refresh logic
 * read from a single, typed place. See `.env.example` for the required vars.
 *
 * Values are read lazily (not validated at import time) so `next build` works
 * without secrets present; `assertOidcConfigured()` enforces them at request
 * time with a clear error.
 */
export const oidcConfig = {
  /** Keycloak realm issuer, e.g. https://kc.example.com/realms/lvs */
  issuer: process.env.KEYCLOAK_ISSUER ?? '',
  clientId: process.env.KEYCLOAK_CLIENT_ID ?? '',
  clientSecret: process.env.KEYCLOAK_CLIENT_SECRET ?? '',
  /** Space-separated OIDC scopes requested at login. */
  scopes: process.env.KEYCLOAK_SCOPES ?? 'openid profile email',
  /** Refresh the access token this many seconds before it expires. */
  refreshThresholdSeconds: Number(process.env.OIDC_REFRESH_THRESHOLD ?? '60'),
} as const;

/** Keycloak's OpenID Connect token endpoint, derived from the issuer. */
export const tokenEndpoint = () => `${oidcConfig.issuer}/protocol/openid-connect/token`;

/** True when the minimum Keycloak settings are present. */
export function isOidcConfigured(): boolean {
  return Boolean(oidcConfig.issuer && oidcConfig.clientId && oidcConfig.clientSecret);
}

/** Throw a descriptive error if OIDC is not fully configured. */
export function assertOidcConfigured(): void {
  const missing = (['KEYCLOAK_ISSUER', 'KEYCLOAK_CLIENT_ID', 'KEYCLOAK_CLIENT_SECRET'] as const).filter(
    (k) => !process.env[k],
  );
  if (missing.length) {
    throw new Error(`OIDC is not configured. Missing environment variable(s): ${missing.join(', ')}`);
  }
}
