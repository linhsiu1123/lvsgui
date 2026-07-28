import { services } from '@/config/services';
import { backendFetch } from '@/lib/backend';
import { proxy, readJson } from '@/lib/api';

/** GET /api/skills — list agent skills and their enabled state. */
export function GET() {
  return proxy(() => backendFetch(services.skills.list()));
}

/** POST /api/skills — add a skill. */
export async function POST(req: Request) {
  const body = await readJson(req);
  return proxy(() => backendFetch(services.skills.create(), { method: 'POST', body }));
}
