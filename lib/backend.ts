import { auth } from '@/auth';
import { backendConfig, isBackendConfigured } from '@/config/services';

/** Error carrying an HTTP status + parsed body, thrown by `backendFetch`. */
export class BackendError extends Error {
  constructor(
    public status: number,
    public body: unknown,
  ) {
    super(typeof body === 'string' ? body : `Backend request failed (${status})`);
    this.name = 'BackendError';
  }
}

interface BackendFetchOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** JSON-serializable request body. */
  body?: unknown;
  /** Extra query parameters. */
  query?: Record<string, string | undefined>;
  headers?: Record<string, string>;
}

/**
 * Call the backend service on behalf of the signed-in user.
 *
 * Reads the Keycloak access token from the session and forwards it as a
 * `Bearer` token — this is how "every backend service passes OIDC
 * authentication". Throws `BackendError` on auth/config/HTTP failures.
 */
export async function backendFetch<T = unknown>(path: string, opts: BackendFetchOptions = {}): Promise<T> {
  const session = await auth();

  if (!session?.accessToken || session.error === 'RefreshAccessTokenError') {
    throw new BackendError(401, { error: 'not_authenticated' });
  }
  if (!isBackendConfigured()) {
    throw new BackendError(500, { error: 'backend_not_configured', detail: 'BACKEND_BASE_URL is not set' });
  }

  const url = new URL(`${backendConfig.baseUrl}${path}`);
  for (const [k, v] of Object.entries(opts.query ?? {})) {
    if (v !== undefined) url.searchParams.set(k, v);
  }

  const hasBody = opts.body !== undefined;
  let res: Response;
  try {
    res = await fetch(url, {
      method: opts.method ?? 'GET',
      headers: {
        accept: 'application/json',
        ...(hasBody ? { 'content-type': 'application/json' } : {}),
        ...opts.headers,
        authorization: `Bearer ${session.accessToken}`,
      },
      body: hasBody ? JSON.stringify(opts.body) : undefined,
      cache: 'no-store',
      signal: AbortSignal.timeout(backendConfig.timeoutMs),
    });
  } catch (err) {
    const timedOut = err instanceof Error && err.name === 'TimeoutError';
    throw new BackendError(timedOut ? 504 : 502, {
      error: timedOut ? 'backend_timeout' : 'backend_unreachable',
    });
  }

  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) throw new BackendError(res.status, data);
  return data as T;
}
