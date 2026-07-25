import { services } from '@/config/services';
import { backendFetch } from '@/lib/backend';
import { proxy, readJson } from '@/lib/api';

type Ctx = { params: Promise<{ key: string }> };

/** PATCH /api/skills/:key { enabled } — toggle one agent skill. */
export async function PATCH(req: Request, { params }: Ctx) {
  const { key } = await params;
  const { enabled } = await readJson<{ enabled?: boolean }>(req);
  return proxy(() => backendFetch(services.skills.toggle(key), { method: 'PATCH', body: { enabled } }));
}
