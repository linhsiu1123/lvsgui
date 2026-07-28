import { auth } from '@/auth';
import { isAuthBypassEnabled } from '@/config/auth-mode';
import { assertOidcConfigured, isOidcConfigured } from '@/config/oidc';

/**
 * Enforces OIDC on the whole app:
 *  - `/api/auth/*` (Auth.js endpoints) are always allowed.
 *  - Other `/api/*` requests return 401 JSON when unauthenticated.
 *  - Page requests redirect to the Keycloak sign-in flow.
 */
const enforceKeycloak = auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;

  if (nextUrl.pathname.startsWith('/api/auth')) return;
  if (isLoggedIn) return;

  if (nextUrl.pathname.startsWith('/api/')) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  const signInUrl = new URL('/api/auth/signin', nextUrl.origin);
  signInUrl.searchParams.set('callbackUrl', nextUrl.href);
  return Response.redirect(signInUrl);
});

/** Development escape hatch — see `config/auth-mode.ts`. */
function allowEveryRequest() {
  return undefined;
}

/** Names the missing Keycloak variables instead of Auth.js's opaque failure. */
function misconfigurationDetail(): string {
  try {
    assertOidcConfigured();
    return '';
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
}

/**
 * Keycloak is enforced but not configured. Fail every request with the missing
 * variable names — otherwise Auth.js reports an unrelated `InvalidEndpoints`.
 */
function reportMisconfiguration() {
  return Response.json({ error: 'oidc_not_configured', detail: misconfigurationDetail() }, { status: 500 });
}

function selectMiddleware() {
  if (isAuthBypassEnabled()) {
    console.warn('[auth] AUTH_BYPASS=true — Keycloak is DISABLED and every request is allowed through.');
    return allowEveryRequest;
  }
  if (!isOidcConfigured()) {
    console.error(`[auth] ${misconfigurationDetail()} Set AUTH_BYPASS=true to develop without Keycloak.`);
    return reportMisconfiguration;
  }
  return enforceKeycloak;
}

export default selectMiddleware();

export const config = {
  // Run on everything except Next internals and static assets.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
};
