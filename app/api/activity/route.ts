import { services } from '@/config/services';
import { backendFetch } from '@/lib/backend';
import { proxy } from '@/lib/api';
import { isMockDataEnabled } from '@/config/api-mode';
import { mockBackend } from '@/lib/mock/backend';

/** GET /api/activity — recent agent activity feed. */
export function GET() {
  return proxy(() => (isMockDataEnabled() ? mockBackend.activity.list() : backendFetch(services.activity.list())));
}
