import { services } from '@/config/services';
import { backendFetch } from '@/lib/backend';
import { proxy } from '@/lib/api';

/** GET /api/skills — list agent skills and their enabled state. */
export function GET() {
  return proxy(() => backendFetch(services.skills.list()));
}
