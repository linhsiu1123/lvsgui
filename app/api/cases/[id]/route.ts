import { services } from '@/config/services';
import { backendFetch } from '@/lib/backend';
import { proxy } from '@/lib/api';
import { isMockDataEnabled } from '@/config/api-mode';
import { mockBackend } from '@/lib/mock/backend';

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/cases/:id — one approval document with its routing/progress. */
export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  return proxy(() => (isMockDataEnabled() ? mockBackend.cases.get(id) : backendFetch(services.cases.get(id))));
}
