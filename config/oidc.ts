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
  /**
   * Only confidential clients have one. A Keycloak client with
   * `Client authentication = Off` is public and has no secret at all — it
   * authenticates the code exchange with PKCE instead. Leave this empty in
   * that case; see `isPublicClient()`.
   */
  clientSecret: process.env.KEYCLOAK_CLIENT_SECRET ?? '',
  /** Space-separated OIDC scopes requested at login. */
  scopes: process.env.KEYCLOAK_SCOPES ?? 'openid profile email',
  /** Refresh the access token this many seconds before it expires. */
  refreshThresholdSeconds: Number(process.env.OIDC_REFRESH_THRESHOLD ?? '60'),
} as const;

/** Keycloak's OpenID Connect token endpoint, derived from the issuer. */
export const tokenEndpoint = () => `${oidcConfig.issuer}/protocol/openid-connect/token`;

/**
 * True when no client secret is configured, i.e. Keycloak's client is public
 * and the authorization-code exchange is secured with PKCE only.
 */
export function isPublicClient(): boolean {
  return !oidcConfig.clientSecret;
}

/**
 * True when the minimum Keycloak settings are present. The client secret is
 * not required — public clients legitimately have none.
 */
export function isOidcConfigured(): boolean {
  return Boolean(oidcConfig.issuer && oidcConfig.clientId);
}

/** Throw a descriptive error if OIDC is not fully configured. */
export function assertOidcConfigured(): void {
  const missing = (['KEYCLOAK_ISSUER', 'KEYCLOAK_CLIENT_ID'] as const).filter((k) => !process.env[k]);
  if (missing.length) {
    throw new Error(`OIDC is not configured. Missing environment variable(s): ${missing.join(', ')}`);
  }
}
