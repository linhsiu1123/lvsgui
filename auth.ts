import NextAuth from 'next-auth';
import Keycloak from 'next-auth/providers/keycloak';
import type { JWT } from 'next-auth/jwt';
import { oidcConfig, tokenEndpoint, isPublicClient } from '@/config/oidc';
import { isAuthBypassEnabled } from '@/config/auth-mode';

/**
 * Refresh an expired Keycloak access token using the stored refresh token.
 * Returns a new JWT on success, or the same token flagged with an error so the
 * UI/API can force a re-login.
 */
async function refreshAccessToken(token: JWT): Promise<JWT> {
  try {
    if (!token.refreshToken) throw new Error('no refresh token');
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: oidcConfig.clientId,
      refresh_token: token.refreshToken,
    });
    // Public clients must not send client_secret at all — Keycloak rejects the
    // request as invalid_client if the parameter is present but empty.
    if (!isPublicClient()) body.set('client_secret', oidcConfig.clientSecret);
    const res = await fetch(tokenEndpoint(), {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
    });
    const refreshed = await res.json();
    if (!res.ok) throw refreshed;
    return {
      ...token,
      accessToken: refreshed.access_token,
      expiresAt: Math.floor(Date.now() / 1000) + Number(refreshed.expires_in ?? 0),
      refreshToken: refreshed.refresh_token ?? token.refreshToken,
      error: undefined,
    };
  } catch (err) {
    console.error('Keycloak token refresh failed', err);
    return { ...token, error: 'RefreshAccessTokenError' };
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Required for non-Vercel / self-hosted / proxied deployments.
  trustHost: true,
  // Under the dev auth bypass nothing here is ever exercised, but Auth.js still
  // wants a secret to construct itself — supply a throwaway so `AUTH_BYPASS=true`
  // runs against a completely empty .env.local. Never reachable in production:
  // `isAuthBypassEnabled()` returns false there.
  ...(isAuthBypassEnabled() && !process.env.AUTH_SECRET
    ? { secret: 'auth-bypass-development-only-secret' }
    : {}),
  // Registering Keycloak without an issuer makes Auth.js assert on every call
  // (InvalidEndpoints), which turns a plain "not configured yet" into an
  // opaque 500. With no issuer we register nothing: /api/auth/* then answers
  // with an empty session, and `middleware.ts` is what reports the real cause.
  providers: oidcConfig.issuer
    ? [
        Keycloak({
          clientId: oidcConfig.clientId,
          issuer: oidcConfig.issuer,
          // A public Keycloak client (Client authentication = Off) has no
          // secret: tell Auth.js to skip client authentication on the token
          // endpoint and rely on PKCE. Confidential clients keep their secret.
          ...(isPublicClient()
            ? { client: { token_endpoint_auth_method: 'none' } }
            : { clientSecret: oidcConfig.clientSecret }),
          checks: ['pkce', 'state'],
          authorization: { params: { scope: oidcConfig.scopes } },
        }),
      ]
    : [],
  session: { strategy: 'jwt' },
  callbacks: {
    async jwt({ token, account }) {
      // Initial sign-in: persist the Keycloak tokens on the JWT.
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.expiresAt = account.expires_at;
        return token;
      }
      // Still valid (with a small safety margin) — reuse as-is.
      const marginMs = oidcConfig.refreshThresholdSeconds * 1000;
      if (token.expiresAt && Date.now() < token.expiresAt * 1000 - marginMs) {
        return token;
      }
      // Expired (or about to) — refresh.
      return refreshAccessToken(token);
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken;
      session.error = token.error;
      return session;
    },
  },
});
