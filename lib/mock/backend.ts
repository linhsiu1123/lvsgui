/**
 * In-memory mock backend — implements the same operations `lib/backend.ts`'s
 * `backendFetch` would proxy to the real service, against `lib/mock/store.ts`
 * instead of an HTTP call. Enabled via `USE_MOCK_DATA=true`
 * (`config/api-mode.ts`).
 *
 * Mirrors the approval state machine in `backend/app/domain.py` closely enough
 * to exercise the UI's real approve/reject/routing/skill flows end to end, but
 * is not a faithful reimplementation — there is no optimistic-concurrency
 * check, since there is only ever one mock client talking to this store.
 *
 * Throws `BackendError` on the same failure shapes the real backend returns,
 * so `lib/api.ts`'s `proxy()` needs no changes to handle either source.
 */
import { isAuthBypassEnabled, debugIdentity } from '@/config/auth-mode';
import type { CaseItem, FeedItem, RouteDef, SkillDef } from '@/components/signagent/data';
import { BackendError } from '@/lib/backend';
import { mockStore } from './store';

/**
 * `@/auth` is imported dynamically, not at module scope: it pulls in
 * `next-auth`'s ESM build, and this module is reachable from every route
 * handler's static imports regardless of whether mock mode is on. A lazy
 * import keeps that cost (and any test-environment ESM-transform issues)
 * confined to the moment a mock write actually needs a caller's identity.
 */
async function currentActorName(): Promise<string> {
  if (isAuthBypassEnabled()) return debugIdentity().name;
  const { auth } = await import('@/auth');
  const session = await auth();
  return session?.user?.name || 'Unknown User';
}

function nowClock(): string {
  return new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function findCase(id: string): CaseItem {
  const found = mockStore.cases.find((c) => c.id === id);
  if (!found) throw new BackendError(404, { error: 'not_found', detail: `No document ${id}` });
  return found;
}

/** Guard shared by approve/reject — mirrors `domain.py`'s `assert_actionable`. */
function assertActionable(item: CaseItem): number {
  if (item.status !== 'pending') {
    throw new BackendError(409, {
      error: 'invalid_transition',
      detail: `${item.id} is not awaiting approval (status: ${item.status})`,
    });
  }
  const idx = item.routeIdx ?? 0;
  if (!item.route[idx]) {
    throw new BackendError(409, { error: 'invalid_transition', detail: `${item.id} has no stage awaiting a decision` });
  }
  return idx;
}

function pushActivity(entry: Omit<FeedItem, 'time'>): void {
  mockStore.activity.unshift({ ...entry, time: nowClock() });
}

export const mockBackend = {
  cases: {
    async list(type?: string): Promise<CaseItem[]> {
      const items = type ? mockStore.cases.filter((c) => c.type === type) : mockStore.cases;
      return [...items];
    },

    async get(id: string): Promise<CaseItem> {
      return findCase(id);
    },

    async approve(id: string): Promise<CaseItem> {
      const item = findCase(id);
      const idx = assertActionable(item);
      const approver = await currentActorName();

      item.route = item.route.map((s, i) => (i === idx ? { ...s, state: 'done' as const } : s));
      const nextIdx = idx + 1;
      const finished = nextIdx >= item.route.length;
      const tail = finished ? 'approval complete' : `routed to ${item.route[nextIdx].name}`;

      item.routeIdx = nextIdx;
      item.status = finished ? 'approved' : 'pending';
      item.currentLevel2 = !finished;
      item.lastEvent = `${nowClock()} · ${approver} approved, ${tail}`;

      pushActivity({
        icon: finished ? 'OK' : 'AP',
        chip: finished ? 'green' : 'accent',
        text: `${id} approved by ${approver}`,
        sub: finished ? 'Approval complete' : `Routed to ${item.route[nextIdx].name}`,
      });

      return item;
    },

    async reject(id: string, reason: string): Promise<CaseItem> {
      const item = findCase(id);
      const idx = assertActionable(item);
      const trimmed = reason.trim();
      if (!trimmed) {
        throw new BackendError(422, { error: 'invalid_transition', detail: 'A rejection reason is required' });
      }
      const approver = await currentActorName();

      item.route = item.route.map((s, i) => (i === idx ? { ...s, state: 'rejected' as const } : s));
      item.status = 'rejected';
      item.currentLevel2 = false;
      item.lastEvent = `${nowClock()} · ${approver} rejected: ${trimmed}`;

      pushActivity({ icon: 'RJ', chip: 'amber', text: `${id} rejected by ${approver}`, sub: trimmed });

      return item;
    },
  },

  routes: {
    async list(): Promise<Record<string, RouteDef>> {
      return { ...mockStore.flows };
    },

    async update(type: string, def: RouteDef): Promise<RouteDef> {
      mockStore.flows[type] = { ...def };
      return mockStore.flows[type];
    },

    async remove(type: string): Promise<null> {
      if (!(type in mockStore.flows)) {
        throw new BackendError(404, { error: 'not_found', detail: `No pipeline ${type}` });
      }
      delete mockStore.flows[type];
      return null;
    },
  },

  skills: {
    async list(): Promise<SkillDef[]> {
      return [...mockStore.skills];
    },

    async create(skill: SkillDef): Promise<SkillDef> {
      if (mockStore.skills.some((s) => s.key === skill.key)) {
        throw new BackendError(409, { error: 'already_exists', detail: `Skill ${skill.key} already exists` });
      }
      mockStore.skills.push({ ...skill });
      return skill;
    },

    /** Partial edit — same PATCH semantics as `PATCH /qc/skills/{key}`. */
    async toggle(key: string, patch: Partial<Omit<SkillDef, 'key'>>): Promise<SkillDef> {
      const item = mockStore.skills.find((s) => s.key === key);
      if (!item) throw new BackendError(404, { error: 'not_found', detail: `No skill ${key}` });
      if (Object.keys(patch).length === 0) {
        throw new BackendError(422, { error: 'empty_update', detail: 'No fields to update' });
      }
      Object.assign(item, patch);
      return item;
    },
  },

  activity: {
    async list(limit = 50): Promise<FeedItem[]> {
      return mockStore.activity.slice(0, limit);
    },
  },
};
