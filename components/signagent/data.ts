// ─────────────────────────────────────────────────────────────
// SignAgentCore — static data & theme definitions
// Ported from the Claude Design source (SignAgentCore.dc.html)
// ─────────────────────────────────────────────────────────────

export type ThemeVars = Record<string, string>;

export const DEFAULT_THEME: ThemeVars = {
  '--bg': '#f5f5f5',
  '--surface': '#ffffff',
  '--surface2': '#fafafa',
  '--ink': 'rgba(0,0,0,0.88)',
  '--sub': 'rgba(0,0,0,0.65)',
  '--line': '#f0f0f0',
  '--accent': '#1677ff',
  '--on-accent': '#ffffff',
  '--accent-soft': '#e6f4ff',
  '--green': '#52c41a',
  '--green-soft': '#f6ffed',
  '--red': '#ff4d4f',
  '--red-soft': '#fff2f0',
  '--amber': '#faad14',
  '--amber-soft': '#fffbe6',
};

export const DARK_THEME: ThemeVars = {
  '--bg': '#000000',
  '--surface': '#141414',
  '--surface2': '#1d1d1d',
  '--ink': 'rgba(255,255,255,0.85)',
  '--sub': 'rgba(255,255,255,0.65)',
  '--line': '#303030',
  '--accent': '#3c89e8',
  '--on-accent': '#ffffff',
  '--accent-soft': '#111a2c',
  '--green': '#49aa19',
  '--green-soft': '#162312',
  '--red': '#dc4446',
  '--red-soft': '#2c1618',
  '--amber': '#d89614',
  '--amber-soft': '#2b2111',
};

export type Direction = 'Ant Light' | 'Ant Dark';

export const THEMES: Record<Direction, ThemeVars> = {
  'Ant Light': DEFAULT_THEME,
  'Ant Dark': DARK_THEME,
};

export type RiskLevel = 'Low' | 'Medium' | 'High';

export const RISK: Record<RiskLevel, { bgVar: string; fgVar: string }> = {
  Low: { bgVar: 'var(--green-soft)', fgVar: 'var(--green)' },
  Medium: { bgVar: 'var(--amber-soft)', fgVar: 'var(--amber)' },
  High: { bgVar: 'var(--red-soft)', fgVar: 'var(--red)' },
};

export interface PreCheck {
  icon: string;
  ok: boolean;
  text: string;
}

export const PRECHECKS: Record<string, PreCheck[]> = {
  default: [
    { icon: '✓', ok: true, text: 'Document format & naming comply with LVS-QC-001' },
    { icon: '✓', ok: true, text: 'Required attachments 3/3 complete' },
    { icon: '✓', ok: true, text: 'Version sequence matches change log' },
    { icon: '✓', ok: true, text: 'No open linked ECO' },
  ],
  'QC-2605': [
    { icon: '✓', ok: true, text: 'Document format & naming comply with LVS-QC-001' },
    { icon: '✓', ok: true, text: 'Required attachments 2/2 complete' },
    { icon: '!', ok: false, text: 'Linked ECO-118 is still open; verify corrective-action progress' },
  ],
};

export const SUGGESTIONS: Record<string, { text: string; ok: boolean }> = {
  default: {
    text: 'Recommendation: Approve. All pre-review items passed; differences from prior versions are low-impact.',
    ok: true,
  },
  'QC-2605': {
    text: 'Recommendation: Hold. An open ECO exists; reject to request supplementary verification data.',
    ok: false,
  },
};

export interface TraceStep {
  step: string;
  detail: string;
}

export const TRACES: Record<string, TraceStep[]> = {
  default: [
    { step: 'Read document', detail: 'Opened RD-0981 v2.1 main doc and 2 attachments (diff report, regression results); fully parseable.' },
    { step: 'Compare prior versions', detail: '34 lines differ from v2.0, concentrated in M0 device compare rules; regression 1,208 cells all passed.' },
    { step: 'Query linked records', detail: 'No open items in ECO DB; 3 similar Rule Deck Changes in the last 90 days, all approved on first pass.' },
    { step: 'Risk determination', detail: 'Change touches core device-compare rules → graded Medium, routed to 2 levels of manual approval.' },
  ],
  'QC-2605': [
    { step: 'Read document', detail: 'Opened WV-0331 v1.0 main doc and 2 attachments; fully parseable.' },
    { step: 'Query linked records', detail: 'Detected linked ECO-118 in "in progress" state; corrective action not yet closed.' },
    { step: 'Compare prior versions', detail: 'Same engineer filed 2 Waiver Requests in 60 days; 1 was rejected for insufficient evidence.' },
    { step: 'Risk determination', detail: 'Open ECO exists → graded Medium; recommend holding and confirming ECO-118 progress first.' },
  ],
};

export interface RouteStep {
  name: string;
  state?: 'done' | 'rejected';
}

export interface CaseItem {
  id: string;
  title: string;
  type: string;
  ver: string;
  submitter: string;
  time: string;
  risk: RiskLevel;
  status: 'auto' | 'pending' | 'approved' | 'rejected';
  route: RouteStep[];
  routeIdx?: number;
  currentLevel2?: boolean;
  lastEvent: string;
}

export const NEW_CASE: CaseItem = {
  id: 'QC-2608',
  title: 'LVS Verification Report RPT-8834',
  type: 'LVS Verification Report',
  ver: 'v1.0',
  submitter: 'Wu Meng-chun',
  time: 'just now',
  risk: 'Low',
  status: 'auto',
  route: [{ name: 'Agent Auto-approve', state: 'done' }],
  lastEvent: 'just now · Agent pre-review passed, auto-approved by low-risk rule',
};

export interface FeedStep {
  wait: number;
  working: string;
  icon: string;
  chip: 'accent' | 'amber' | 'green';
  text: string;
  sub: string;
  addCase?: boolean;
}

export const FEED_STEPS: FeedStep[] = [
  { wait: 1400, working: 'Monitoring DMS repository', icon: 'IN', chip: 'accent', text: 'New request QC-2608 · LVS Verification Report RPT-8834', sub: 'Wu Meng-chun · uploaded to DMS' },
  { wait: 2400, working: 'Reading document & attachments', icon: 'RD', chip: 'accent', text: 'Read RPT-8834 v1.0, 3 attachments', sub: 'Matched template LVS-QC-001' },
  { wait: 2600, working: 'Running pre-review checks', icon: 'PR', chip: 'accent', text: 'Pre-review passed: format ✓ attachments 3/3 ✓ no open ECO', sub: '' },
  { wait: 2300, working: 'Risk grading', icon: 'GR', chip: 'amber', text: 'Risk grade: Low (small change, no rejection history)', sub: 'Route → Agent auto-approve' },
  { wait: 2000, working: 'Applying auto-approve rule', icon: 'OK', chip: 'green', text: 'QC-2608 auto-approved, queued for approval-lead audit', sub: 'Sampling rate 20%', addCase: true },
];

export const INITIAL_CASES: CaseItem[] = [
  { id: 'QC-2607', title: 'LVS Verification Report RPT-8821', type: 'LVS Verification Report', ver: 'v1.0', submitter: 'Chen Ya-ting', time: 'Today 09:12', risk: 'Low', status: 'auto', route: [{ name: 'Agent Auto-approve', state: 'done' }], lastEvent: 'Today 09:13 · Agent pre-review passed, auto-approved by low-risk rule' },
  { id: 'QC-2606', title: 'Rule Deck Change RD-0981 M0 device compare', type: 'Rule Deck Change', ver: 'v2.1', submitter: 'Chen Ya-ting', time: 'Yesterday 16:40', risk: 'Medium', status: 'pending', routeIdx: 0, route: [{ name: 'Verification Dep. Mgr. Lin' }, { name: 'Design Center Assoc. Mgr. Wang' }], lastEvent: 'Yesterday 16:41 · Agent pre-review done, routed to Verification Dep. Mgr. Lin' },
  { id: 'QC-2605', title: 'Waiver Request WV-0331', type: 'Waiver Request', ver: 'v1.0', submitter: 'Liu Chien-hung', time: '7/03 11:05', risk: 'Medium', status: 'pending', routeIdx: 0, route: [{ name: 'Verification Dep. Mgr. Lin' }], lastEvent: '7/03 11:06 · Agent detected an open linked ECO' },
  { id: 'QC-2604', title: 'Waiver Request WV-0312', type: 'Waiver Request', ver: 'v3.0', submitter: 'Liu Chien-hung', time: '7/01 14:22', risk: 'High', status: 'rejected', routeIdx: 0, route: [{ name: 'Verification Dep. Mgr. Lin', state: 'rejected' }], lastEvent: '7/01 15:02 · Dep. Mgr. Lin rejected: false-alarm root-cause analysis lacks evidence' },
  { id: 'QC-2603', title: 'LVS Verification Report RPT-8790', type: 'LVS Verification Report', ver: 'v1.0', submitter: 'Wu Meng-chun', time: '6/30 10:18', risk: 'Low', status: 'auto', route: [{ name: 'Agent Auto-approve', state: 'done' }], lastEvent: '6/30 10:19 · Agent pre-review passed, auto-approved' },
  { id: 'QC-2602', title: 'Rule Deck Change RD-0774 IP merge flow', type: 'Rule Deck Change', ver: 'v4.0', submitter: 'Wu Meng-chun', time: '6/28 09:40', risk: 'Medium', status: 'approved', routeIdx: 2, route: [{ name: 'Verification Dep. Mgr. Lin', state: 'done' }, { name: 'Design Center Assoc. Mgr. Wang', state: 'done' }], lastEvent: '6/29 11:20 · Assoc. Mgr. Wang approved, approval complete' },
];

// Routing-rules flow definitions
export interface RouteDef {
  meta: string;
  mid: string[];
  high: string[];
  removed?: string[];
  cfg?: Record<string, Record<string, string>>;
}

export const INITIAL_ROUTE_DEFS: Record<string, RouteDef> = {
  'Rule Deck Change': { meta: 'v3 · updated 6/28 · System Admin', mid: ['v', 'd'], high: ['v', 'd', 'g'] },
  'LVS Verification Report': { meta: 'v2 · updated 5/14 · System Admin', mid: ['v'], high: ['v', 'd'] },
  'Waiver Request': { meta: 'v4 · updated 6/03 · System Admin', mid: ['v'], high: ['v', 'd'] },
};

// Approver-role role/label maps for the flow canvas
export const APPROVER_TITLES: Record<string, string> = {
  v: 'Verification Dep. Mgr.',
  d: 'Design Center Assoc. Mgr.',
  g: 'General Manager',
  q: 'QA Dept. Mgr.',
};

export const APPROVER_PERSONS: Record<string, string> = {
  v: 'Dep. Mgr. Lin · Verification',
  d: 'Assoc. Mgr. Wang · Design Center',
  g: 'GM Office',
  q: 'Dept. Mgr. Tsai · QA',
};

export interface SkillDef {
  key: 'route' | 'precheck' | 'auto' | 'anomaly';
  glyph: string;
  name: string;
  desc: string;
}

export const SKILL_DEFS: SkillDef[] = [
  { key: 'route', glyph: 'RT', name: 'Routing Decision', desc: 'Automatically decides which managers and how many approval levels based on doc type and risk.' },
  { key: 'precheck', glyph: 'PR', name: 'Pre-review & Recommendation', desc: 'Checks format, attachments, version, and linked ECO before routing, with an approve/reject recommendation.' },
  { key: 'auto', glyph: 'OK', name: 'Low-risk Auto-approve', desc: 'Low-risk requests skip manual approval; audited afterward by the approval lead (20% sampling).' },
  { key: 'anomaly', glyph: 'AL', name: 'Anomaly Detection', desc: 'Watches for resubmissions, mismatched attachments, and routing bypasses; alerts the approval lead in real time.' },
];

export const SKILL_NAMES: Record<string, string> = {
  route: 'Routing Decision',
  precheck: 'Pre-review & Recommendation',
  auto: 'Low-risk Auto-approve',
  anomaly: 'Anomaly Detection',
};

// status: [key, label, fgVar, bgVar]
export const STATUS_DEFS: [string, string, string, string][] = [
  ['pending', 'In Review', 'var(--amber)', 'var(--amber-soft)'],
  ['auto', 'Auto-approve', 'var(--accent)', 'var(--accent-soft)'],
  ['approved', 'Approved', 'var(--green)', 'var(--green-soft)'],
  ['rejected', 'Rejected', 'var(--red)', 'var(--red-soft)'],
];

export const TYPE_DEFS = [
  { name: 'Rule Deck Change', glyph: 'RD' },
  { name: 'LVS Verification Report', glyph: 'VR' },
  { name: 'Waiver Request', glyph: 'WV' },
];
