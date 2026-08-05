import { services } from '@/config/services';
import { backendFetch } from '@/lib/backend';
import { proxy, readJson } from '@/lib/api';
import { isMockDataEnabled } from '@/config/api-mode';
import { mockBackend } from '@/lib/mock/backend';
import type { RouteDef } from '@/components/signagent/data';

type Ctx = { params: Promise<{ type: string }> };

/** PUT /api/routes/:type — persist the routing flow for one product type. */
export async function PUT(req: Request, { params }: Ctx) {
  const { type } = await params;
  const body = await readJson<RouteDef>(req);
  return proxy(() =>
    isMockDataEnabled()
      ? mockBackend.routes.update(type, body)
      : backendFetch(services.routes.update(type), { method: 'PUT', body }),
  );
}

/** DELETE /api/routes/:type — remove a flow (the console renames by re-create). */
export async function DELETE(_req: Request, { params }: Ctx) {
  const { type } = await params;
  return proxy(() =>
    isMockDataEnabled() ? mockBackend.routes.remove(type) : backendFetch(services.routes.remove(type), { method: 'DELETE' }),
  );
}
