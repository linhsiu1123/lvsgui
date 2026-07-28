'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, ApiError } from '@/lib/api-client';
import type { CaseItem, FeedItem, RouteDef, SkillDef } from './data';

/**
 * The server-owned slice of the console's state.
 *
 * Everything here comes from the backend through `/api/*`. Purely visual state
 * — which tab is open, which node is selected, the canvas zoom — stays in the
 * component and is deliberately *not* part of this.
 */
export interface ServerState {
  cases: CaseItem[];
  flows: Record<string, RouteDef>;
  skills: SkillDef[];
  activity: FeedItem[];
}

export interface DataActions {
  approve(id: string): Promise<void>;
  reject(id: string, reason: string): Promise<void>;
  toggleSkill(key: string, enabled: boolean): void;
  /** Resolves to an error message, or null when the skill was created. */
  createSkill(skill: SkillDef): Promise<string | null>;
  /** Resolves to an error message, or null when the edit was saved. */
  updateSkill(key: string, patch: Partial<Omit<SkillDef, 'key'>>): Promise<string | null>;
  /** Persist one flow. Debounced — safe to call on every keystroke. */
  saveFlow(name: string, def: RouteDef): void;
  createFlow(name: string, def: RouteDef): void;
  renameFlow(from: string, to: string): void;
  reload(): void;
}

export type LoadStatus = 'loading' | 'ready' | 'error';

const EMPTY: ServerState = { cases: [], flows: {}, skills: [], activity: [] };

/** How often the activity feed re-polls while the console is open. */
export const ACTIVITY_POLL_MS = 15_000;
/** Flow edits are chatty (one per keystroke); collapse them into one PUT. */
export const FLOW_SAVE_DEBOUNCE_MS = 400;

function messageFor(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 401) return 'Not signed in. Reload to authenticate.';
    if (err.status === 502 || err.status === 504) return 'The approval service is unreachable.';
    return err.message;
  }
  return err instanceof Error ? err.message : 'Unexpected error';
}

export function useSignAgentData() {
  const [server, setServer] = useState<ServerState>(EMPTY);
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  /** Non-fatal: a write failed but the console is still usable. */
  const [actionError, setActionError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  // ── initial load ──
  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    setError(null);

    Promise.all([api.cases.list(), api.routes.list(), api.skills.list(), api.activity.list()])
      .then(([cases, flows, skills, activity]) => {
        if (cancelled) return;
        setServer({ cases, flows, skills, activity });
        setStatus('ready');
      })
      .catch((err) => {
        if (cancelled) return;
        setError(messageFor(err));
        setStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  // ── activity polling ──
  useEffect(() => {
    if (status !== 'ready') return;
    const id = setInterval(() => {
      api.activity
        .list()
        .then((activity) => alive.current && setServer((s) => ({ ...s, activity })))
        // A failed poll is not worth interrupting the user for; the next one may work.
        .catch(() => undefined);
    }, ACTIVITY_POLL_MS);
    return () => clearInterval(id);
  }, [status]);

  const refreshActivity = useCallback(() => {
    api.activity
      .list()
      .then((activity) => alive.current && setServer((s) => ({ ...s, activity })))
      .catch(() => undefined);
  }, []);

  // ── flow saves, debounced per pipeline ──
  const flowTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  useEffect(() => {
    const timers = flowTimers.current;
    return () => Object.values(timers).forEach(clearTimeout);
  }, []);

  const queueFlowSave = useCallback((name: string, def: RouteDef) => {
    clearTimeout(flowTimers.current[name]);
    flowTimers.current[name] = setTimeout(() => {
      api.routes.update(name, def).catch((err) => {
        if (alive.current) setActionError(`Could not save ${name}: ${messageFor(err)}`);
      });
    }, FLOW_SAVE_DEBOUNCE_MS);
  }, []);

  const actions = useMemo<DataActions>(
    () => ({
      async approve(id) {
        setActionError(null);
        try {
          // The server owns the transition; take its version of the document.
          const updated = await api.cases.approve(id);
          if (!alive.current) return;
          setServer((s) => ({ ...s, cases: s.cases.map((c) => (c.id === id ? updated : c)) }));
          refreshActivity();
        } catch (err) {
          if (alive.current) setActionError(messageFor(err));
        }
      },

      async reject(id, reason) {
        setActionError(null);
        try {
          const updated = await api.cases.reject(id, reason);
          if (!alive.current) return;
          setServer((s) => ({ ...s, cases: s.cases.map((c) => (c.id === id ? updated : c)) }));
          refreshActivity();
        } catch (err) {
          if (alive.current) setActionError(messageFor(err));
        }
      },

      toggleSkill(key, enabled) {
        setActionError(null);
        // Optimistic: the switch should not lag behind the pointer.
        setServer((s) => ({
          ...s,
          skills: s.skills.map((sk) => (sk.key === key ? { ...sk, enabled } : sk)),
        }));
        api.skills.toggle(key, enabled).catch((err) => {
          if (!alive.current) return;
          setActionError(messageFor(err));
          setServer((s) => ({
            ...s,
            skills: s.skills.map((sk) => (sk.key === key ? { ...sk, enabled: !enabled } : sk)),
          }));
        });
      },

      // Create and edit report their own errors rather than raising the
      // global banner: the dialog that triggered them stays open and shows
      // the message inline, so the user can correct the input in place.
      async createSkill(skill) {
        try {
          const created = await api.skills.create(skill);
          if (alive.current) setServer((s) => ({ ...s, skills: [...s.skills, created] }));
          return null;
        } catch (err) {
          return messageFor(err);
        }
      },

      async updateSkill(key, patch) {
        try {
          const updated = await api.skills.update(key, patch);
          if (alive.current) {
            setServer((s) => ({ ...s, skills: s.skills.map((sk) => (sk.key === key ? updated : sk)) }));
          }
          return null;
        } catch (err) {
          return messageFor(err);
        }
      },

      saveFlow(name, def) {
        setServer((s) => ({ ...s, flows: { ...s.flows, [name]: def } }));
        queueFlowSave(name, def);
      },

      createFlow(name, def) {
        setServer((s) => ({ ...s, flows: { ...s.flows, [name]: def } }));
        queueFlowSave(name, def);
      },

      renameFlow(from, to) {
        setServer((s) => {
          const def = s.flows[from];
          if (!def || s.flows[to]) return s;
          const flows = { ...s.flows, [to]: def };
          delete flows[from];
          return { ...s, flows };
        });
        // Rename is create-then-delete: there is no rename endpoint, and doing
        // it in this order never leaves the pipeline missing on the server.
        const def = server.flows[from];
        if (!def) return;
        clearTimeout(flowTimers.current[from]);
        api.routes
          .update(to, def)
          .then(() => api.routes.remove(from))
          .catch((err) => {
            if (alive.current) setActionError(`Could not rename ${from}: ${messageFor(err)}`);
          });
      },

      reload() {
        setReloadToken((n) => n + 1);
      },
    }),
    [queueFlowSave, refreshActivity, server.flows],
  );

  return { server, status, error, actionError, dismissActionError: () => setActionError(null), actions };
}
