import { services } from '@/config/services';
import { backendFetch } from '@/lib/backend';
import { proxy, readJson } from '@/lib/api';

type Ctx = { params: Promise<{ id: string }> };

/** POST /api/cases/:id/reject { reason } — reject with a required reason. */
export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  const { reason } = await readJson<{ reason?: string }>(req);
  return proxy(() => backendFetch(services.cases.reject(id), { method: 'POST', body: { reason } }));
}
