/**
 * Mock data mode.
 *
 * Normally every `/api/*` route proxies to the real backend (`lib/backend.ts`).
 * Setting `USE_MOCK_DATA=true` swaps that for an in-memory mock
 * (`lib/mock/backend.ts`) instead, so the console can be run and exercised —
 * including approve/reject, routing-flow edits, and skill CRUD — with no
 * backend service or MongoDB running at all.
 *
 * Independent of `AUTH_BYPASS` (`config/auth-mode.ts`): you can mock the data
 * layer while still exercising real Keycloak sign-in, or vice versa. Note that
 * `middleware.ts` still enforces OIDC regardless of this flag, so mocking the
 * data layer alone does not unblock a Keycloak-less dev loop — pair it with
 * `AUTH_BYPASS=true` for that.
 *
 * Ignored in a production build, so it cannot ship by accident.
 */
let productionMisuseReported = false;

export function isMockDataEnabled(): boolean {
  if (process.env.USE_MOCK_DATA !== 'true') return false;

  if (process.env.NODE_ENV === 'production') {
    if (!productionMisuseReported) {
      productionMisuseReported = true;
      console.error(
        '[api] USE_MOCK_DATA=true was set in a production build and has been IGNORED. ' +
          'The real backend remains in use. Remove the variable from this environment.',
      );
    }
    return false;
  }

  return true;
}
