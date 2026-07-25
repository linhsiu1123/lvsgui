import { services } from '@/config/services';
import { backendFetch } from '@/lib/backend';
import { proxy, readJson } from '@/lib/api';

type Ctx = { params: Promise<{ type: string }> };

/** PUT /api/routes/:type — persist the routing flow for one product type. */
export async function PUT(req: Request, { params }: Ctx) {
  const { type } = await params;
  const body = await readJson(req);
  return proxy(() => backendFetch(services.routes.update(type), { method: 'PUT', body }));
}
