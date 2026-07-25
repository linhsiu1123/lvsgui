import { services } from '@/config/services';
import { backendFetch } from '@/lib/backend';
import { proxy } from '@/lib/api';

/** GET /api/activity — recent agent activity feed. */
export function GET() {
  return proxy(() => backendFetch(services.activity.list()));
}
