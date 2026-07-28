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

// Risk is surfaced as an *alert type* rather than a level: Low is the normal
// case and carries no badge at all, so only Medium/High get a visible chip.
export const RISK_LABEL: Record<RiskLevel, string> = { Low: '', Medium: 'Warning', High: 'Error' };

export function riskChip(r: RiskLevel): { label: string; bg: string; fg: string } {
  return r === 'Low'
    ? { label: '', bg: 'transparent', fg: 'var(--sub)' }
    : { label: RISK_LABEL[r], bg: RISK[r].bgVar, fg: RISK[r].fgVar };
}

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

/** One entry of the agent activity feed, as the backend returns it. */
export interface FeedItem {
  icon: string;
  chip: 'accent' | 'amber' | 'green';
  text: string;
  sub: string;
  time: string;
  /** ISO timestamp; present on server-sourced items. */
  at?: string;
}

// Routing-rules flow definitions.
//
// A flow is now an ordered chain of freely named/insertable nodes (`chain`)
// rather than a fixed trigger→agent→branch topology. `mid`/`high` are the
// legacy per-risk approver chains, still carried on each pipeline.
export interface RouteDef {
  meta: string;
  mid: string[];
  high: string[];
  chain?: string[];
  removed?: string[];
  cfg?: Record<string, Record<string, string>>;
  /** Whether the whole rule is active (the canvas toolbar switch). */
  enabled?: boolean;
  /** Node id ("n0", "n1", …) → agent skill key. */
  nodeSkills?: Record<string, string>;
  /** Node id → whether that step needs a human confirmation. */
  nodeVerify?: Record<string, boolean>;
}

/** Chain a pipeline starts with when it defines none of its own. */
export const DEFAULT_CHAIN = ['node1', 'node2', 'node3'];

// Flow-canvas geometry — nodes sit on a single row, evenly spaced.
export const NODE_W = 190;
export const NODE_GAP = 40;
export const NODE_X0 = 40;
export const NODE_Y = 40;

/** An agent skill as the backend returns it. */
export interface SkillDef {
  key: string;
  glyph: string;
  name: string;
  desc: string;
  enabled: boolean;
}

// Built-in skills that run continuously across the queue rather than at one
// step in a flow, so the canvas does not offer them as a node binding.
// Skills added by operators are always offered.
export const NON_NODE_SKILLS: readonly string[] = ['anomaly'];

// status: [key, label, fgVar, bgVar]
export const STATUS_DEFS: [string, string, string, string][] = [
  ['pending', 'In Review', 'var(--amber)', 'var(--amber-soft)'],
  ['auto', 'Auto-approve', 'var(--accent)', 'var(--accent-soft)'],
  ['approved', 'Approved', 'var(--green)', 'var(--green-soft)'],
  ['rejected', 'Rejected', 'var(--red)', 'var(--red-soft)'],
];

// Overview cards are labelled by the pipeline that handles each document type.
export const TYPE_DEFS = [
  { name: 'Rule Deck Change', label: 'Pipeline1', glyph: 'P1' },
  { name: 'LVS Verification Report', label: 'Pipeline2', glyph: 'P2' },
  { name: 'Waiver Request', label: 'Pipeline3', glyph: 'P3' },
];
