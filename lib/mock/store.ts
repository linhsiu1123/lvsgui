/**
 * In-memory mock data store.
 *
 * Backs `lib/mock/backend.ts` when `USE_MOCK_DATA=true` (see
 * `config/api-mode.ts`). Seeded once per server process with content shaped
 * like a freshly seeded real backend (`backend/app/seed.py`) — deliberately
 * NOT imported from `components/signagent/fixtures.ts`, which is test-only
 * fixture data with its own "nothing in the app imports this" invariant; this
 * module keeps an independent copy so the two can't drift into each other.
 *
 * Next.js keeps one module instance per server process, so mutations
 * (approve/reject, flow edits, skill toggles) persist across requests for the
 * life of the dev server — restart to reset.
 */
import type { CaseItem, FeedItem, RouteDef, SkillDef } from '@/components/signagent/data';

const LIN = 'Verification Dep. Mgr. Lin';
const WANG = 'Design Center Assoc. Mgr. Wang';

function seedCases(): CaseItem[] {
  return [
    {
      id: 'QC-2607',
      title: 'LVS Verification Report RPT-8821',
      type: 'LVS Verification Report',
      ver: 'v1.0',
      submitter: 'Chen Ya-ting',
      time: 'Today 09:12',
      risk: 'Low',
      status: 'auto',
      route: [{ name: 'Agent Auto-approve', state: 'done' }],
      lastEvent: 'Today 09:12 · Agent pre-review passed, auto-approved by low-risk rule',
    },
    {
      id: 'QC-2606',
      title: 'Rule Deck Change RD-0981 M0 device compare',
      type: 'Rule Deck Change',
      ver: 'v2.1',
      submitter: 'Chen Ya-ting',
      time: 'Yesterday 16:40',
      risk: 'Medium',
      status: 'pending',
      routeIdx: 0,
      route: [{ name: LIN }, { name: WANG }],
      lastEvent: `Yesterday 16:40 · Agent pre-review done, routed to ${LIN}`,
    },
    {
      id: 'QC-2605',
      title: 'Waiver Request WV-0331',
      type: 'Waiver Request',
      ver: 'v1.0',
      submitter: 'Liu Chien-hung',
      time: '7/03 11:05',
      risk: 'Medium',
      status: 'pending',
      routeIdx: 0,
      route: [{ name: LIN }],
      lastEvent: '7/03 11:05 · Agent detected an open linked ECO',
    },
    {
      id: 'QC-2604',
      title: 'Waiver Request WV-0312',
      type: 'Waiver Request',
      ver: 'v3.0',
      submitter: 'Liu Chien-hung',
      time: '7/01 14:22',
      risk: 'High',
      status: 'rejected',
      routeIdx: 0,
      route: [{ name: LIN, state: 'rejected' }],
      lastEvent: '7/01 14:22 · Dep. Mgr. Lin rejected: false-alarm root-cause analysis lacks evidence',
    },
    {
      id: 'QC-2603',
      title: 'LVS Verification Report RPT-8790',
      type: 'LVS Verification Report',
      ver: 'v1.0',
      submitter: 'Wu Meng-chun',
      time: '6/30 10:18',
      risk: 'Low',
      status: 'auto',
      route: [{ name: 'Agent Auto-approve', state: 'done' }],
      lastEvent: '6/30 10:18 · Agent pre-review passed, auto-approved',
    },
    {
      id: 'QC-2602',
      title: 'Rule Deck Change RD-0774 IP merge flow',
      type: 'Rule Deck Change',
      ver: 'v4.0',
      submitter: 'Wu Meng-chun',
      time: '6/28 09:40',
      risk: 'Medium',
      status: 'approved',
      routeIdx: 2,
      route: [
        { name: LIN, state: 'done' },
        { name: WANG, state: 'done' },
      ],
      lastEvent: `6/28 09:40 · ${WANG} approved, approval complete`,
    },
  ];
}

function seedFlows(): Record<string, RouteDef> {
  const chain = () => ['node1', 'node2', 'node3'];
  return {
    Pipeline1: { meta: 'v3 · updated 6/28 · System Admin', mid: ['v', 'd'], high: ['v', 'd', 'g'], chain: chain(), enabled: true, nodeSkills: {}, nodeVerify: {} },
    Pipeline2: { meta: 'v2 · updated 5/14 · System Admin', mid: ['v'], high: ['v', 'd'], chain: chain(), enabled: true, nodeSkills: {}, nodeVerify: {} },
    Pipeline3: { meta: 'v4 · updated 6/03 · System Admin', mid: ['v'], high: ['v', 'd'], chain: chain(), enabled: true, nodeSkills: {}, nodeVerify: {} },
  };
}

function seedSkills(): SkillDef[] {
  return [
    {
      key: 'route',
      glyph: 'RT',
      name: 'Routing Decision',
      desc: 'Automatically decides which managers and how many approval levels based on doc type and risk.',
      enabled: true,
    },
    {
      key: 'precheck',
      glyph: 'PR',
      name: 'Pre-review & Recommendation',
      desc: 'Checks format, attachments, version, and linked ECO before routing, with an approve/reject recommendation.',
      enabled: true,
    },
    {
      key: 'auto',
      glyph: 'OK',
      name: 'Low-risk Auto-approve',
      desc: 'Low-risk requests skip manual approval; audited afterward by the approval lead (20% sampling).',
      enabled: true,
    },
    {
      key: 'anomaly',
      glyph: 'AL',
      name: 'Anomaly Detection',
      desc: 'Watches for resubmissions, mismatched attachments, and routing bypasses; alerts the approval lead in real time.',
      enabled: true,
    },
  ];
}

function seedActivity(): FeedItem[] {
  return [
    { icon: 'OK', chip: 'green', text: 'QC-2602 approved by System Admin', sub: 'Approval complete', time: '09:40' },
    { icon: 'RJ', chip: 'amber', text: 'QC-2604 rejected by Dep. Mgr. Lin', sub: 'False-alarm root-cause analysis lacks evidence', time: '14:22' },
  ];
}

export interface MockStore {
  cases: CaseItem[];
  flows: Record<string, RouteDef>;
  skills: SkillDef[];
  activity: FeedItem[];
}

function seed(): MockStore {
  return { cases: seedCases(), flows: seedFlows(), skills: seedSkills(), activity: seedActivity() };
}

// Module-level singleton — one process, one store, for the life of the server.
export const mockStore: MockStore = seed();

/** Restores the store to its seeded state. Exposed for tests only. */
export function resetMockStore(): void {
  Object.assign(mockStore, seed());
}
