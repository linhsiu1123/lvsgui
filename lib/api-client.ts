/**
 * Typed browser client for the Next.js API layer. The UI calls these instead of
 * talking to the backend directly — the API routes attach the OIDC token and
 * proxy to the real backend service.
 *
 * `components/signagent/useSignAgentData.ts` is the sole consumer: it owns the
 * server-backed slice of the console's state and calls through here.
 */
import type { CaseItem, FeedItem, RouteDef, SkillDef } from '@/components/signagent/data';

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
    remove: (type: string) => request<null>(`/api/routes/${encodeURIComponent(type)}`, jsonInit('DELETE')),
  },
  skills: {
    list: () => request<SkillDef[]>('/api/skills'),
    create: (skill: SkillDef) => request<SkillDef>('/api/skills', jsonInit('POST', skill)),
    /** Partial edit — omitted fields are left alone. `key` is immutable. */
    update: (key: string, patch: Partial<Omit<SkillDef, 'key'>>) =>
      request<SkillDef>(`/api/skills/${encodeURIComponent(key)}`, jsonInit('PATCH', patch)),
    toggle: (key: string, enabled: boolean) =>
      request<SkillDef>(`/api/skills/${encodeURIComponent(key)}`, jsonInit('PATCH', { enabled })),
  },
  activity: {
    list: () => request<FeedItem[]>('/api/activity'),
  },
};
