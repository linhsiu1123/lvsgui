import { services } from '@/config/services';
import { backendFetch } from '@/lib/backend';
import { proxy } from '@/lib/api';
import { isMockDataEnabled } from '@/config/api-mode';
import { mockBackend } from '@/lib/mock/backend';

/** GET /api/routes — list routing-rule flows for all product types. */
export function GET() {
  return proxy(() => (isMockDataEnabled() ? mockBackend.routes.list() : backendFetch(services.routes.list())));
}
