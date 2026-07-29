import { services } from '@/config/services';
import { backendFetch } from '@/lib/backend';
import { proxy, readJson } from '@/lib/api';

type Ctx = { params: Promise<{ key: string }> };

/**
 * PATCH /api/skills/:key — partial edit of one agent skill.
 *
 * The body is forwarded whole: it may carry `enabled` alone (the card's
 * toggle) or any of `glyph`/`name`/`desc` (the edit dialog). Picking fields
 * out here would silently drop the rest, so validation is left to the backend,
 * which owns the schema.
 */
export async function PATCH(req: Request, { params }: Ctx) {
  const { key } = await params;
  const body = await readJson(req);
  return proxy(() => backendFetch(services.skills.toggle(key), { method: 'PATCH', body }));
}
