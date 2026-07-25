import { services } from '@/config/services';
import { backendFetch } from '@/lib/backend';
import { proxy } from '@/lib/api';

type Ctx = { params: Promise<{ id: string }> };

/** POST /api/cases/:id/approve — approve the current stage. */
export async function POST(_req: Request, { params }: Ctx) {
  const { id } = await params;
  return proxy(() => backendFetch(services.cases.approve(id), { method: 'POST' }));
}
