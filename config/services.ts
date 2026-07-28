/**
 * Backend service configuration.
 *
 * The app talks to a separate backend. Every Next.js API route proxies to it
 * through `lib/backend.ts`, which attaches the Keycloak access token. The
 * mapping between our API routes and the backend's real endpoints lives here,
 * in one place, so it can be adjusted without touching the route handlers.
 *
 * Adjust the path templates below to match your backend's actual routes.
 */
export const backendConfig = {
  /** Base URL of the backend service, e.g. https://api.example.com */
  baseUrl: process.env.BACKEND_BASE_URL ?? '',
  /** Per-request timeout in milliseconds. */
  timeoutMs: Number(process.env.BACKEND_TIMEOUT_MS ?? '15000'),
} as const;

export function isBackendConfigured(): boolean {
  return Boolean(backendConfig.baseUrl);
}

/**
 * Backend endpoint templates, grouped by service. Each function returns the
 * path (relative to `backendConfig.baseUrl`) for one operation.
 */
export const services = {
  cases: {
    list: () => `/qc/documents`,
    get: (id: string) => `/qc/documents/${encodeURIComponent(id)}`,
    approve: (id: string) => `/qc/documents/${encodeURIComponent(id)}/approve`,
    reject: (id: string) => `/qc/documents/${encodeURIComponent(id)}/reject`,
  },
  routes: {
    list: () => `/qc/routing-flows`,
    update: (type: string) => `/qc/routing-flows/${encodeURIComponent(type)}`,
    remove: (type: string) => `/qc/routing-flows/${encodeURIComponent(type)}`,
  },
  skills: {
    list: () => `/qc/skills`,
    create: () => `/qc/skills`,
    toggle: (key: string) => `/qc/skills/${encodeURIComponent(key)}`,
  },
  activity: {
    list: () => `/qc/activity`,
  },
} as const;
