/**
 * Authentication mode.
 *
 * Normally every request is authenticated against Keycloak — `middleware.ts`
 * guards the routes and `lib/backend.ts` forwards the OIDC access token to the
 * backend.
 *
 * For local development on a machine with no Keycloak realm (or no route to
 * one), setting `AUTH_BYPASS=true` lets every request through with a stub
 * identity, so the UI can be worked on without an auth round-trip.
 *
 * The bypass is refused outside development, so it cannot ship by accident: in
 * a production build the flag is ignored and the app keeps enforcing Keycloak.
 */
import type { Session } from 'next-auth';

let productionMisuseReported = false;

/**
 * True when the Keycloak checks should be skipped. Only ever true in a
 * non-production build with `AUTH_BYPASS=true` explicitly set.
 */
export function isAuthBypassEnabled(): boolean {
  if (process.env.AUTH_BYPASS !== 'true') return false;

  if (process.env.NODE_ENV === 'production') {
    if (!productionMisuseReported) {
      productionMisuseReported = true;
      console.error(
        '[auth] AUTH_BYPASS=true was set in a production build and has been IGNORED. ' +
          'Keycloak authentication remains enforced. Remove the variable from this environment.',
      );
    }
    return false;
  }

  return true;
}

export interface DebugIdentity {
  name: string;
  email: string;
}

/** Stub identity representing the operator while the bypass is active. */
export function debugIdentity(): DebugIdentity {
  return {
    name: process.env.AUTH_BYPASS_USER || 'Debug User',
    email: process.env.AUTH_BYPASS_EMAIL || 'debug@localhost',
  };
}

/**
 * Stub session handed to `SessionProvider` while the bypass is active, so
 * `useSession()` resolves to a signed-in user without Auth.js ever running.
 */
export function debugSession(): Session {
  const { name, email } = debugIdentity();
  return {
    user: { name, email },
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  };
}

/**
 * Bearer token to send to the backend while Keycloak is bypassed.
 *
 * Optional. Set it when the backend is real and still wants a token; leave it
 * unset and the proxy calls the backend with no `Authorization` header, which
 * is what you want against a local mock.
 */
export function debugAccessToken(): string | undefined {
  return process.env.AUTH_BYPASS_TOKEN || undefined;
}
