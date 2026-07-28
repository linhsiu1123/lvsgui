/**
 * Test-only fixtures shaped exactly like the backend's responses.
 *
 * They mirror `backend/app/seed.py`, which is what a freshly seeded database
 * serves. Nothing in the app imports this — it exists so component tests can
 * stub `fetch` with realistic payloads instead of inventing their own.
 */
import type { CaseItem, FeedItem, RouteDef, SkillDef } from './data';

const LIN = 'Verification Dep. Mgr. Lin';
const WANG = 'Design Center Assoc. Mgr. Wang';

export const CASES: CaseItem[] = [
  { id: 'QC-2607', title: 'LVS Verification Report RPT-8821', type: 'LVS Verification Report', ver: 'v1.0', submitter: 'Chen Ya-ting', time: 'Today 09:12', risk: 'Low', status: 'auto', route: [{ name: 'Agent Auto-approve', state: 'done' }], lastEvent: 'Today 09:13 · Agent pre-review passed, auto-approved by low-risk rule' },
  { id: 'QC-2606', title: 'Rule Deck Change RD-0981 M0 device compare', type: 'Rule Deck Change', ver: 'v2.1', submitter: 'Chen Ya-ting', time: 'Yesterday 16:40', risk: 'Medium', status: 'pending', routeIdx: 0, route: [{ name: LIN }, { name: WANG }], lastEvent: 'Yesterday 16:41 · Agent pre-review done, routed to ' + LIN },
  { id: 'QC-2605', title: 'Waiver Request WV-0331', type: 'Waiver Request', ver: 'v1.0', submitter: 'Liu Chien-hung', time: '7/03 11:05', risk: 'Medium', status: 'pending', routeIdx: 0, route: [{ name: LIN }], lastEvent: '7/03 11:06 · Agent detected an open linked ECO' },
  { id: 'QC-2604', title: 'Waiver Request WV-0312', type: 'Waiver Request', ver: 'v3.0', submitter: 'Liu Chien-hung', time: '7/01 14:22', risk: 'High', status: 'rejected', routeIdx: 0, route: [{ name: LIN, state: 'rejected' }], lastEvent: '7/01 15:02 · Dep. Mgr. Lin rejected: false-alarm root-cause analysis lacks evidence' },
  { id: 'QC-2603', title: 'LVS Verification Report RPT-8790', type: 'LVS Verification Report', ver: 'v1.0', submitter: 'Wu Meng-chun', time: '6/30 10:18', risk: 'Low', status: 'auto', route: [{ name: 'Agent Auto-approve', state: 'done' }], lastEvent: '6/30 10:19 · Agent pre-review passed, auto-approved' },
  { id: 'QC-2602', title: 'Rule Deck Change RD-0774 IP merge flow', type: 'Rule Deck Change', ver: 'v4.0', submitter: 'Wu Meng-chun', time: '6/28 09:40', risk: 'Medium', status: 'approved', routeIdx: 2, route: [{ name: LIN, state: 'done' }, { name: WANG, state: 'done' }], lastEvent: '6/29 11:20 · Assoc. Mgr. Wang approved, approval complete' },
];

const flow = (meta: string, mid: string[], high: string[]): RouteDef => ({
  meta,
  mid,
  high,
  chain: ['node1', 'node2', 'node3'],
  enabled: true,
  nodeSkills: {},
  nodeVerify: {},
});

export const FLOWS: Record<string, RouteDef> = {
  Pipeline1: flow('v3 · updated 6/28 · System Admin', ['v', 'd'], ['v', 'd', 'g']),
  Pipeline2: flow('v2 · updated 5/14 · System Admin', ['v'], ['v', 'd']),
  Pipeline3: flow('v4 · updated 6/03 · System Admin', ['v'], ['v', 'd']),
};

export const SKILLS: SkillDef[] = [
  { key: 'route', glyph: 'RT', name: 'Routing Decision', desc: 'Automatically decides which managers and how many approval levels based on doc type and risk.', enabled: true },
  { key: 'precheck', glyph: 'PR', name: 'Pre-review & Recommendation', desc: 'Checks format, attachments, version, and linked ECO before routing, with an approve/reject recommendation.', enabled: true },
  { key: 'auto', glyph: 'OK', name: 'Low-risk Auto-approve', desc: 'Low-risk requests skip manual approval; audited afterward by the approval lead (20% sampling).', enabled: true },
  { key: 'anomaly', glyph: 'AL', name: 'Anomaly Detection', desc: 'Watches for resubmissions, mismatched attachments, and routing bypasses; alerts the approval lead in real time.', enabled: true },
];

export const ACTIVITY: FeedItem[] = [
  { icon: 'OK', chip: 'green', text: 'QC-2602 approved by Wang', sub: 'Approval complete', time: '11:20' },
];
