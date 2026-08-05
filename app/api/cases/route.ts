import { services } from '@/config/services';
import { backendFetch } from '@/lib/backend';
import { proxy } from '@/lib/api';
import { isMockDataEnabled } from '@/config/api-mode';
import { mockBackend } from '@/lib/mock/backend';

/** GET /api/cases?type=... — list approval documents (optionally by product type). */
export function GET(req: Request) {
  const type = new URL(req.url).searchParams.get('type') ?? undefined;
  return proxy(() =>
    isMockDataEnabled() ? mockBackend.cases.list(type) : backendFetch(services.cases.list(), { query: { type } }),
  );
}
