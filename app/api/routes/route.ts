import { services } from '@/config/services';
import { backendFetch } from '@/lib/backend';
import { proxy } from '@/lib/api';

/** GET /api/routes — list routing-rule flows for all product types. */
export function GET() {
  return proxy(() => backendFetch(services.routes.list()));
}
