/**
 * Typed browser client for the Next.js API layer. The UI calls these instead of
 * talking to the backend directly — the API routes attach the OIDC token and
 * proxy to the real backend service.
 *
 * The existing screens still render from static fixtures (`components/signagent/
 * data.ts`); this client is the migration path to wire them to live data.
 */
import type { CaseItem, RouteDef, SkillDef } from '@/components/signagent/data';

async function request<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    ...init,
    headers: { accept: 'application/json', ...init?.headers },
  });
  if (res.status === 401) throw new ApiError(401, 'Not authenticated');
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const message = (data && (data.error || data.message)) || `Request failed (${res.status})`;
    throw new ApiError(res.status, String(message), data);
  }
  return data as T;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const jsonInit = (method: string, body?: unknown): RequestInit => ({
  method,
  headers: { 'content-type': 'application/json' },
  body: body === undefined ? undefined : JSON.stringify(body),
});

export const api = {
  cases: {
    list: (type?: string) =>
      request<CaseItem[]>(`/api/cases${type ? `?type=${encodeURIComponent(type)}` : ''}`),
    get: (id: string) => request<CaseItem>(`/api/cases/${encodeURIComponent(id)}`),
    approve: (id: string) => request<CaseItem>(`/api/cases/${encodeURIComponent(id)}/approve`, jsonInit('POST')),
    reject: (id: string, reason: string) =>
      request<CaseItem>(`/api/cases/${encodeURIComponent(id)}/reject`, jsonInit('POST', { reason })),
  },
  routes: {
    list: () => request<Record<string, RouteDef>>('/api/routes'),
    update: (type: string, def: RouteDef) =>
      request<RouteDef>(`/api/routes/${encodeURIComponent(type)}`, jsonInit('PUT', def)),
  },
  skills: {
    list: () => request<SkillDef[]>('/api/skills'),
    toggle: (key: string, enabled: boolean) =>
      request<SkillDef>(`/api/skills/${encodeURIComponent(key)}`, jsonInit('PATCH', { enabled })),
  },
  activity: {
    list: () => request<unknown[]>('/api/activity'),
  },
};
