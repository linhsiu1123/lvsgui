import { auth } from '@/auth';

/**
 * Enforces OIDC on the whole app:
 *  - `/api/auth/*` (Auth.js endpoints) are always allowed.
 *  - Other `/api/*` requests return 401 JSON when unauthenticated.
 *  - Page requests redirect to the Keycloak sign-in flow.
 */
export default auth((req) => {
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

export const config = {
  // Run on everything except Next internals and static assets.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
};
