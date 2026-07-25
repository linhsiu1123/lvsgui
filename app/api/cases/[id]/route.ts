import { services } from '@/config/services';
import { backendFetch } from '@/lib/backend';
import { proxy } from '@/lib/api';

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/cases/:id — one approval document with its routing/progress. */
export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  return proxy(() => backendFetch(services.cases.get(id)));
}
