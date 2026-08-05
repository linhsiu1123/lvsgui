import { services } from '@/config/services';
import { backendFetch } from '@/lib/backend';
import { proxy, readJson } from '@/lib/api';
import { isMockDataEnabled } from '@/config/api-mode';
import { mockBackend } from '@/lib/mock/backend';

type Ctx = { params: Promise<{ id: string }> };

/** POST /api/cases/:id/reject { reason } — reject with a required reason. */
export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  const { reason } = await readJson<{ reason?: string }>(req);
  return proxy(() =>
    isMockDataEnabled()
      ? mockBackend.cases.reject(id, reason ?? '')
      : backendFetch(services.cases.reject(id), { method: 'POST', body: { reason } }),
  );
}
