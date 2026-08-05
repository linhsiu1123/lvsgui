import { services } from '@/config/services';
import { backendFetch } from '@/lib/backend';
import { proxy, readJson } from '@/lib/api';
import { isMockDataEnabled } from '@/config/api-mode';
import { mockBackend } from '@/lib/mock/backend';
import type { SkillDef } from '@/components/signagent/data';

/** GET /api/skills — list agent skills and their enabled state. */
export function GET() {
  return proxy(() => (isMockDataEnabled() ? mockBackend.skills.list() : backendFetch(services.skills.list())));
}

/** POST /api/skills — add a skill. */
export async function POST(req: Request) {
  const body = await readJson<SkillDef>(req);
  return proxy(() =>
    isMockDataEnabled() ? mockBackend.skills.create(body) : backendFetch(services.skills.create(), { method: 'POST', body }),
  );
}
