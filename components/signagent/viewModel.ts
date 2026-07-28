import React from 'react';
import {
  PRECHECKS,
  SUGGESTIONS,
  TRACES,
  STATUS_DEFS,
  TYPE_DEFS,
  NON_NODE_SKILLS,
  DEFAULT_CHAIN,
  NODE_W,
  NODE_GAP,
  NODE_X0,
  NODE_Y,
  RISK_LABEL,
  riskChip,
  type CaseItem,
  type RouteDef,
} from './data';
import type { State } from './types';
import type { DataActions, ServerState } from './useSignAgentData';

// The vals bag is a faithful port of the original DCLogic.renderVals() output.
// It is intentionally loosely typed (any) — it is a heterogeneous view-model.
/* eslint-disable @typescript-eslint/no-explicit-any */

type SetState = (patch: Partial<State> | ((prev: State) => Partial<State>)) => void;

/** Documents awaiting *this* approver — the Pending Items queue. */
export function pendingForMe(cases: CaseItem[]): CaseItem[] {
  return cases.filter((c) => c.status === 'pending' && c.routeIdx === 0 && !c.currentLevel2);
}

/** The pipeline whose flow is on screen; falls back to the first one loaded. */
export function activeFlowName(state: State, flows: Record<string, RouteDef>): string {
  return state.routeTab && flows[state.routeTab] ? state.routeTab : Object.keys(flows)[0] || '';
}

export function buildVals(
  state: State,
  setState: SetState,
  props: { lowRiskAuto: boolean; showRisk: boolean },
  server: ServerState,
  actions: DataActions,
): any {
  const s = state;
  const { lowRiskAuto, showRisk } = props;

  // ---- derived cases (lowRiskAuto tweak) ----
  const cases = server.cases.map((c) => {
    if (c.id === 'QC-2607' && !lowRiskAuto && c.status === 'auto') {
      return {
        ...c,
        status: 'pending' as const,
        routeIdx: 0,
        route: [{ name: 'Verification Dep. Mgr. Lin' }],
        lastEvent:
          'Today 09:13 · Agent pre-review passed, routed to Verification Dep. Mgr. Lin (auto-approve disabled)',
      };
    }
    return c;
  });

  const personas: Record<State['role'], { name: string; role: string }> = {
    dash: { name: 'Dep. Mgr. Lin', role: 'Verification Team · Approval Lead' },
    approver: { name: 'Dep. Mgr. Lin', role: 'Verification Team · Approval Lead' },
    admin: { name: 'System Admin', role: 'Workflow & Agent Config' },
    routes: { name: 'System Admin', role: 'Workflow & Agent Config' },
  };
  const p = personas[s.role];

  const mkTab = ([key, label]: [State['role'], string]) => ({
    key,
    label,
    fw: s.role === key ? 700 : 400,
    bg: s.role === key ? 'var(--surface)' : 'transparent',
    fg: s.role === key ? 'var(--ink)' : 'var(--sub)',
    pick: () => setState({ role: key, rejecting: false }),
  });
  const workTabs = ([['dash', 'Overview'], ['approver', 'Pending Items']] as [State['role'], string][]).map(mkTab);
  const adminTabs = ([['admin', 'Skills'], ['routes', 'Routing Rules']] as [State['role'], string][]).map(mkTab);

  // ---- dashboard ----
  const statusDefs = STATUS_DEFS;
  const dashTypes = TYPE_DEFS.map((t) => {
    const list = cases.filter((c) => c.type === t.name);
    const counts = statusDefs.map(([key, label, color]) => ({
      label,
      color,
      count: list.filter((c) => c.status === key).length,
    }));
    const nonzero = counts.filter((x) => x.count > 0);
    return {
      key: t.name,
      name: t.label,
      glyph: t.glyph,
      total: String(list.length),
      border: s.dashType === t.name ? 'var(--accent)' : 'var(--line)',
      bar: nonzero.map((x) => ({ w: `${((x.count / list.length) * 100).toFixed(1)}%`, color: x.color })),
      stats: nonzero,
      pick: () => setState((st) => ({ dashType: st.dashType === t.name ? null : t.name })),
    };
  });
  const stageOf = (c: CaseItem) => {
    const stage = c.route[c.routeIdx ?? -1];
    if (c.status === 'pending' && stage) return `Awaiting ${stage.name}`;
    if (c.status === 'auto') return 'Agent auto-approved (auditing)';
    if (c.status === 'approved') return 'Approval complete';
    return c.lastEvent.split('·').pop()!.trim();
  };
  const dashRows = cases
    .filter((c) => !s.dashType || c.type === s.dashType)
    .map((c) => {
      const sd = statusDefs.find((x) => x[0] === c.status)!;
      const rb = showRisk ? riskChip(c.risk) : { label: '—', bg: 'transparent', fg: 'var(--sub)' };
      return {
        id: c.id,
        title: `${c.title} ${c.ver}`,
        type: c.type,
        riskLabel: rb.label,
        riskBg: rb.bg,
        riskFg: rb.fg,
        stLabel: sd[1],
        stFg: sd[2],
        stBg: sd[3],
        stage: stageOf(c),
        stTitle: 'View approval progress and routing rules',
        stClick: () => setState({ dashModal: c.id }),
      };
    });

  // ---- approver ----
  const pendingMine = pendingForMe(cases);
  const riskBadge = (r: CaseItem['risk']) =>
    showRisk ? riskChip(r) : { label: '', bg: 'transparent', fg: 'transparent' };
  const approverCases = pendingMine.map((c) => {
    const rb = riskBadge(c.risk);
    return {
      id: c.id,
      title: `${c.title} ${c.ver}`,
      submitter: c.submitter,
      time: c.time,
      riskLabel: rb.label,
      riskBg: rb.bg,
      riskFg: rb.fg,
      cardBorder: s.selId === c.id ? 'var(--accent)' : 'var(--line)',
      pick: () => setState({ selId: c.id, rejecting: false, traceOpen: false }),
    };
  });
  const sel = pendingMine.find((c) => c.id === s.selId) || null;
  // The pre-review report and reasoning trace are not modelled by the backend;
  // they stay as canned per-document analysis.
  const selChecks = sel
    ? (PRECHECKS[sel.id] || PRECHECKS.default).map((c) => ({ ...c, color: c.ok ? 'var(--green)' : 'var(--amber)' }))
    : [];
  const sug = sel ? SUGGESTIONS[sel.id] || SUGGESTIONS.default : null;
  const selRb = sel ? riskBadge(sel.risk) : { label: '', bg: 'transparent', fg: 'transparent' };

  // ---- admin skills ----
  const skillCards = server.skills.map((d) => ({
    ...d,
    on: d.enabled,
    opacity: d.enabled ? 1 : 0.55,
    toggle: (checked: boolean) => actions.toggleSkill(d.key, checked),
  }));
  const existingSkillKeys = server.skills.map((d) => d.key);

  // ---- approve / reject ----
  const approve = () => {
    if (!s.selId) return;
    const id = s.selId;
    setState({ rejecting: false, rejectReason: '', selId: null });
    void actions.approve(id);
  };
  const rejectConfirm = () => {
    if (!s.selId || !s.rejectReason.trim()) return;
    const id = s.selId;
    const reason = s.rejectReason;
    setState({ rejecting: false, rejectReason: '', selId: null });
    void actions.reject(id, reason);
  };

  return {
    // top bar
    workTabs,
    adminTabs,
    personaName: p.name,
    personaRole: p.role,
    personaInitial: p.name[0],
    isApprover: s.role === 'approver',
    isAdmin: s.role === 'admin',
    isDash: s.role === 'dash',
    isRoutes: s.role === 'routes',
    showRisk,

    // dashboard
    dashTypes,
    dashRows,
    ...modalVals(s, setState, cases, statusDefs, showRisk),
    ...feedVals(server.activity),
    dashFiltered: !!s.dashType,
    dashFilterLabel: TYPE_DEFS.find((t) => t.name === s.dashType)?.label || s.dashType || 'All types',
    dashClear: () => setState({ dashType: null }),

    // approver
    approverCases,
    approverCount: pendingMine.length,
    approverEmpty: pendingMine.length === 0,
    hasSel: !!sel,
    noSel: !sel,
    selId: sel ? sel.id : '',
    selTitle: sel ? `${sel.title} ${sel.ver}` : '',
    selRiskLabel: selRb.label,
    selRiskBg: selRb.bg,
    selRiskFg: selRb.fg,
    selMeta: sel
      ? [
          { label: 'Owner Engineer', value: sel.submitter },
          { label: 'Doc type', value: sel.type },
          { label: 'Version', value: sel.ver },
          { label: 'Submitted', value: sel.time },
        ]
      : [],
    selChecks,
    selSuggestion: sug ? sug.text : '',
    selSugBg: sug && sug.ok ? 'var(--green-soft)' : 'var(--amber-soft)',
    selSugFg: sug && sug.ok ? 'var(--green)' : 'var(--amber)',
    traceOpen: !!s.traceOpen,
    traceToggleLabel: s.traceOpen ? 'Collapse reasoning ▴' : 'Show Agent reasoning ▾',
    onTraceToggle: () => setState((st) => ({ traceOpen: !st.traceOpen })),
    selTrace: sel
      ? (TRACES[sel.id] || TRACES.default).map((t, i) => ({ ...t, n: i + 1, delay: `${i * 90}ms` }))
      : [],
    onApprove: approve,
    onRejectToggle: () => setState((st) => ({ rejecting: !st.rejecting })),
    rejecting: s.rejecting,
    rejectReason: s.rejectReason,
    onRejectInput: (e: React.ChangeEvent<HTMLInputElement>) => setState({ rejectReason: e.target.value }),
    onRejectConfirm: rejectConfirm,

    // skills
    skillCards,
    existingSkillKeys,
    skillCreate: actions.createSkill,
    skillUpdate: actions.updateSkill,

    // routes
    ...routeVals(s, setState, server.flows, server.skills, actions),
  };
}

// ── modal view-model ──
function modalVals(
  s: State,
  setState: SetState,
  cases: CaseItem[],
  statusDefs: typeof STATUS_DEFS,
  showRisk: boolean,
): any {
  const c = s.dashModal ? cases.find((x) => x.id === s.dashModal) : null;
  const close = () => setState({ dashModal: null });
  if (!c) return { dashModalOpen: false, dashModalClose: close };
  const sd = statusDefs.find((x) => x[0] === c.status)!;
  const rb = showRisk ? riskChip(c.risk) : { label: '—', bg: 'var(--surface2)', fg: 'var(--sub)' };
  const isAuto = c.status === 'auto';
  const G = 'var(--green)',
    Gs = 'var(--green-soft)',
    A = 'var(--amber)',
    As = 'var(--amber-soft)',
    R = 'var(--red)',
    Rs = 'var(--red-soft)';
  const mkStep = (label: string, sub: string, st: 'done' | 'rejected' | 'current' | 'waiting') => ({
    label,
    sub,
    icon: st === 'done' ? '✓' : st === 'rejected' ? '✕' : st === 'current' ? '●' : '○',
    dotBg: st === 'done' ? Gs : st === 'rejected' ? Rs : st === 'current' ? As : 'var(--surface2)',
    dotFg: st === 'done' ? G : st === 'rejected' ? R : st === 'current' ? A : 'var(--sub)',
    fg: st === 'waiting' ? 'var(--sub)' : 'var(--ink)',
    fw: st === 'current' ? 700 : 500,
  });
  const branchDesc = isAuto
    ? 'Low risk → Agent Auto-approve'
    : `${RISK_LABEL[c.risk]} → ${c.route.length} levels of manual approval`;
  const steps = [
    mkStep('Document Submitted', `${c.submitter} · ${c.time}`, 'done'),
    mkStep('Agent Pre-review', 'format · attachments · linked ECO', 'done'),
    mkStep('Risk Grading', branchDesc, 'done'),
    ...c.route.map((r, i) => {
      const st =
        r.state === 'done'
          ? 'done'
          : r.state === 'rejected'
            ? 'rejected'
            : c.status === 'pending' && i === c.routeIdx
              ? 'current'
              : 'waiting';
      return mkStep(r.name, '', st as any);
    }),
  ];
  if (isAuto) steps.push(mkStep('Approval Lead Audit', 'Sampling rate 20% · after', 'current'));
  if (c.status === 'approved') steps.push(mkStep('Approval complete', '', 'done'));
  const withLines = steps.map((st, i) => ({ ...st, hasLine: i < steps.length - 1 }));
  return {
    dashModalOpen: true,
    dashModalClose: close,
    modalId: c.id,
    modalTitle: `${c.title} ${c.ver}`,
    modalMeta: `${c.type} · ${c.ver} · ${c.submitter} · ${c.time}`,
    modalRiskLabel: rb.label,
    modalRiskBg: rb.bg,
    modalRiskFg: rb.fg,
    modalStLabel: sd[1],
    modalStFg: sd[2],
    modalStBg: sd[3],
    modalRuleLabel: `${c.type} routing`,
    modalRuleDesc: branchDesc,
    // Deep-link to the pipeline that handles this document type. Flows are
    // keyed by pipeline label, so the doc type has to be mapped across.
    modalGoRoutes: () =>
      setState({
        dashModal: null,
        role: 'routes',
        routeTab: TYPE_DEFS.find((t) => t.name === c.type)?.label ?? c.type,
        routeSel: null,
        routeEdgeSel: null,
      }),
    modalSteps: withLines,
    modalLastEvent: c.lastEvent,
  };
}

// ── activity-feed view-model ──
function feedVals(activity: ServerState['activity']): any {
  const chipC: Record<string, [string, string]> = {
    accent: ['var(--accent-soft)', 'var(--accent)'],
    amber: ['var(--amber-soft)', 'var(--amber)'],
    green: ['var(--green-soft)', 'var(--green)'],
  };
  const feedItems = activity.map((f) => {
    const cc = chipC[f.chip] || chipC.accent;
    return {
      icon: f.icon,
      text: f.text,
      sub: f.sub,
      subSep: f.sub ? ' · ' : '',
      time: f.time,
      chipBg: cc[0],
      chipFg: cc[1],
    };
  });
  return {
    feedItems,
    // Nothing reports an in-flight agent step yet, so the console shows the
    // idle state whenever the feed is live.
    feedWorkingOn: false,
    feedWorkingLabel: '',
    feedIdle: true,
  };
}

// ── routing-rules flow-canvas view-model ──
function routeVals(
  s: State,
  setState: SetState,
  defs: Record<string, RouteDef>,
  skills: ServerState['skills'],
  actions: DataActions,
): any {
  // Node bindings offer whatever skills exist on the server, minus the
  // built-ins that do not belong to a single step.
  const nodeSkillNames: Record<string, string> = Object.fromEntries(
    skills.filter((sk) => !NON_NODE_SKILLS.includes(sk.key)).map((sk) => [sk.key, sk.name]),
  );

  const tab = activeFlowName(s, defs);
  const D = defs[tab];

  const baseTabs = Object.keys(defs).map((k) => ({
    label: k,
    fw: tab === k ? 700 : 400,
    bg: tab === k ? 'var(--surface)' : 'transparent',
    fg: tab === k ? 'var(--ink)' : 'var(--sub)',
    pick: () => setState({ routeTab: k, routeSel: null, routeEdgeSel: null }),
  }));

  const now = new Date();
  const today = `${now.getMonth() + 1}/${String(now.getDate()).padStart(2, '0')}`;
  const bump = (m: string) => m.replace(/updated [\d/]+|created today/, `updated ${today}`);

  const newFlow = (): RouteDef => ({
    meta: 'v1 · created today · System Admin',
    mid: ['v'],
    high: ['v', 'd'],
    chain: [...DEFAULT_CHAIN],
    enabled: true,
    nodeSkills: {},
    nodeVerify: {},
  });
  const addFlow = () => {
    let n = 4;
    while (defs[`Pipeline${n}`]) n++;
    const name = `Pipeline${n}`;
    actions.createFlow(name, newFlow());
    setState({ routeTab: name, routeSel: null, routeRenaming: true, routeNameDraft: name });
  };

  // Flows are still loading (or failed to load): render an empty canvas rather
  // than crashing on a missing definition.
  if (!D) {
    return {
      isRoutes: s.role === 'routes',
      routeTabs: baseTabs,
      routeMeta: '',
      flowCanvasW: 760,
      flowCanvasH: 166,
      routeAddNode: () => undefined,
      routeAddFlow: addFlow,
      routeRenaming: false,
      routeNotRenaming: false,
      routeNameDraft: '',
      routeRenameStart: () => undefined,
      routeNameInput: () => undefined,
      routeNameKey: () => undefined,
      routeRenameCommit: () => undefined,
      routeRemovedChips: [],
      routeStateLabel: '',
      routeStateFg: 'var(--sub)',
      routeOn: false,
      routeToggle: () => undefined,
      routeCanvasOpacity: 1,
      routeCanvasClick: () => undefined,
      routeZoom: s.routeZoom,
      routeZoomPct: `${Math.round(s.routeZoom * 100)}%`,
      routeZoomIn: () => undefined,
      routeZoomOut: () => undefined,
      flowNodes: [],
      flowEdges: [],
      flowEdgeLabels: [],
      routePanelOpen: false,
      routePanelLeft: '14px',
      routePanelTop: '14px',
      routePanelTitle: '',
      routePanelKind: '',
      routePanelRows: [],
      routePanelClose: () => undefined,
    };
  }

  const on = D.enabled ?? true;
  const G = 'var(--green)';

  /** Every flow edit funnels through here, so all of them persist. */
  const patchFlow = (patch: Partial<RouteDef>) =>
    actions.saveFlow(tab, { ...D, ...patch, meta: bump(D.meta) });

  const nodeSkills = D.nodeSkills ?? {};
  const nodeVerify = D.nodeVerify ?? {};

  const skillOpts = [
    { v: '', label: '— None —' },
    ...Object.keys(nodeSkillNames).map((k) => ({ v: k, label: nodeSkillNames[k] })),
  ];
  const skillOf = (id: string) => nodeSkills[id] ?? '';
  const skillRow = (id: string) => ({
    isSel: true,
    k: 'Skill',
    options: skillOpts,
    value: skillOf(id),
    change: (e: any) => patchFlow({ nodeSkills: { ...nodeSkills, [id]: e.target.value } }),
  });

  const verifyOn = (id: string) => nodeVerify[id] ?? true;
  const verifyRow = (id: string) => {
    const von = verifyOn(id);
    return {
      isToggle: true,
      k: 'Human verify?',
      v: von ? 'Requires manual confirmation' : 'No confirmation needed',
      fg: von ? 'var(--ink)' : 'var(--sub)',
      checked: von,
      toggle: () => patchFlow({ nodeVerify: { ...nodeVerify, [id]: !von } }),
    };
  };

  const removed = D.removed || [];
  const restoreNode = (id: string) => patchFlow({ removed: removed.filter((x) => x !== id) });

  // ── node chain ──
  const chain = D.chain?.length ? D.chain : DEFAULT_CHAIN;
  const setNodes = (mut: (arr: string[]) => void) => {
    const arr = [...chain];
    mut(arr);
    if (!arr.length) return;
    patchFlow({ chain: arr });
  };
  const addNode = (at?: number) =>
    setNodes((a) => {
      let n = a.length + 1;
      while (a.indexOf(`node${n}`) >= 0) n++;
      a.splice(at === undefined ? a.length : at, 0, `node${n}`);
    });

  interface FlowNode {
    id: string;
    i: number;
    name: string;
    x: number;
    y: number;
    kind: string;
    glyph: string;
    title: string;
    sub: string;
  }
  const nodes: FlowNode[] = chain.map((name, i) => ({
    id: `n${i}`,
    i,
    name,
    x: NODE_X0 + i * (NODE_W + NODE_GAP),
    y: NODE_Y,
    kind: 'step',
    glyph: String(i + 1),
    title: name,
    sub: nodeSkillNames[skillOf(`n${i}`)] || 'No skill assigned',
  }));
  const byId: Record<string, FlowNode> = {};
  nodes.forEach((n) => (byId[n.id] = n));

  const cy = (n: FlowNode) => n.y + 33;
  const bez = (x1: number, y1: number, x2: number, y2: number) =>
    `M ${x1} ${y1} C ${x1 + 30} ${y1}, ${x2 - 30} ${y2}, ${x2} ${y2}`;
  interface Edge {
    id: string;
    from: string;
    to: string;
    d: string;
    stroke: string;
  }
  const edges: Edge[] = [];
  for (let i = 1; i < nodes.length; i++) {
    const a = nodes[i - 1],
      b = nodes[i];
    edges.push({
      id: `e${i - 1}`,
      from: a.id,
      to: b.id,
      d: bez(a.x + NODE_W, cy(a), b.x, cy(b)),
      stroke: 'var(--sub)',
    });
  }
  const labels: any[] = [];

  // The canvas grows with the chain, and taller while a panel is open so the
  // panel never overflows the scroll area.
  const canvasW = Math.max(760, NODE_X0 * 2 + nodes.length * NODE_W + (nodes.length - 1) * NODE_GAP);
  const canvasH = NODE_Y + 66 + (s.routeSel || s.routeEdgeSel ? 420 : 60);

  const flowNodes = nodes.map((n) => ({
    ...n,
    h: 66,
    headH: 63,
    isSwitch: false,
    rows: [],
    iconBg: 'var(--accent-soft)',
    iconFg: 'var(--accent)',
    border: s.routeSel === n.id ? 'var(--accent)' : 'var(--line)',
    ports: [
      ...(n.i > 0 ? [{ top: 28, left: '-5px', right: 'auto', color: 'var(--sub)' }] : []),
      ...(n.i < nodes.length - 1 ? [{ top: 28, left: 'auto', right: '-5px', color: 'var(--sub)' }] : []),
    ],
    pick: (e: React.MouseEvent) => {
      e.stopPropagation();
      setState({ routeSel: n.id, routeEdgeSel: null });
    },
  }));

  const sel = s.routeSel ? byId[s.routeSel] : null;
  const kindLabel: Record<string, string> = { step: 'Flow node' };
  const ink = 'var(--ink)';
  let panelRows: any[] = [];
  if (sel) {
    panelRows = [
      {
        isInput: true,
        k: 'Name',
        value: sel.name,
        change: (e: any) => {
          const v = e.target.value;
          setNodes((a) => {
            a[sel.i] = v;
          });
        },
      },
      skillRow(sel.id),
      verifyRow(sel.id),
      { k: 'Step', v: `${sel.i + 1} of ${nodes.length}`, fg: ink },
      {
        isBtn: true,
        label: '＋ Add node after this',
        click: (e: React.MouseEvent) => {
          e.stopPropagation();
          addNode(sel.i + 1);
        },
      },
    ];
    if (nodes.length > 1)
      panelRows.push({
        isBtn: true,
        danger: true,
        label: 'Delete node',
        click: (e: React.MouseEvent) => {
          e.stopPropagation();
          setState({ routeSel: null });
          setNodes((a) => {
            a.splice(sel.i, 1);
          });
        },
      });
  }

  let eSel: Edge | null = null;
  let edgeTitle = '';
  if (!sel && s.routeEdgeSel) {
    eSel = edges.find((ed) => ed.id === s.routeEdgeSel) || null;
    if (eSel) {
      const nameOf = (id: string) => (byId[id] ? byId[id].title : id);
      edgeTitle = `${nameOf(eSel.from)} → ${nameOf(eSel.to)}`;
      const at = byId[eSel.to].i;
      panelRows = [
        { k: 'Source', v: nameOf(eSel.from), fg: ink },
        { k: 'Target', v: nameOf(eSel.to), fg: ink },
        {
          isBtn: true,
          label: '＋ Insert node here',
          click: (e: React.MouseEvent) => {
            e.stopPropagation();
            setState({ routeEdgeSel: null });
            addNode(at);
          },
        },
      ];
    }
  }
  panelRows = panelRows.map((r) =>
    r.isBtn || r.isSel || r.isToggle || r.isInput
      ? r.isBtn
        ? { ...r, fg2: r.danger ? 'var(--red)' : 'var(--sub)' }
        : r
      : { ...r, isText: true },
  );

  const commitRename = () => {
    const name = (s.routeNameDraft || '').trim();
    if (!name || name === tab || defs[name]) {
      setState({ routeRenaming: false });
      return;
    }
    actions.renameFlow(tab, name);
    setState({ routeTab: name, routeRenaming: false });
  };

  const zoomSet = (dz: number) =>
    setState((st) => ({ routeZoom: Math.min(1.3, Math.max(0.55, Math.round((st.routeZoom + dz) * 100) / 100)) }));

  return {
    isRoutes: s.role === 'routes',
    routeTabs: baseTabs,
    routeMeta: D.meta,
    flowCanvasW: canvasW,
    flowCanvasH: canvasH,
    routeAddNode: (e: React.MouseEvent) => {
      e.stopPropagation();
      addNode();
    },
    routeAddFlow: addFlow,
    routeRenaming: s.routeRenaming,
    routeNotRenaming: !s.routeRenaming,
    routeNameDraft: s.routeNameDraft,
    routeRenameStart: () => setState({ routeRenaming: true, routeNameDraft: tab }),
    routeNameInput: (e: any) => setState({ routeNameDraft: e.target.value }),
    routeNameKey: (e: any) => {
      if (e.key === 'Enter') commitRename();
    },
    routeRenameCommit: commitRename,
    routeRemovedChips: removed.map((id) => ({ label: id, restore: () => restoreNode(id) })),
    routeStateLabel: on ? 'Rule active' : 'Disabled',
    routeStateFg: on ? G : 'var(--sub)',
    routeOn: on,
    routeToggle: () => patchFlow({ enabled: !on }),
    routeCanvasOpacity: on ? 1 : 0.45,
    routeCanvasClick: () => setState({ routeSel: null, routeEdgeSel: null }),
    routeZoom: s.routeZoom,
    routeZoomPct: `${Math.round(s.routeZoom * 100)}%`,
    routeZoomIn: () => zoomSet(0.15),
    routeZoomOut: () => zoomSet(-0.15),
    flowNodes,
    flowEdges: edges.map((ed) => ({
      ...ed,
      w: s.routeEdgeSel === ed.id ? 3.5 : 2,
      pick: (ev: React.MouseEvent) => {
        ev.stopPropagation();
        setState({ routeSel: null, routeEdgeSel: ed.id });
      },
    })),
    flowEdgeLabels: labels,
    routePanelOpen: !!sel || !!eSel,
    // The panel hangs directly under whatever is selected (centred on the node,
    // or on the midpoint of a link), clamped to stay inside the canvas.
    routePanelLeft: (() => {
      const z = s.routeZoom,
        PW = 272;
      const anchor = sel
        ? sel
        : eSel
          ? { x: (byId[eSel.from].x + NODE_W + byId[eSel.to].x) / 2 - NODE_W / 2, y: byId[eSel.to].y }
          : null;
      if (!anchor) return '14px';
      const L = anchor.x * z + (NODE_W * z - PW) / 2;
      const maxL = canvasW * z - PW - 14;
      return `${Math.max(14, Math.min(L, Math.max(14, maxL)))}px`;
    })(),
    routePanelTop: (() => {
      const anchor = sel ? sel : eSel ? byId[eSel.to] : null;
      if (!anchor) return '14px';
      return `${(anchor.y + 66) * s.routeZoom + 16}px`;
    })(),
    routePanelTitle: sel ? sel.title : edgeTitle,
    routePanelKind: sel ? `${kindLabel[sel.kind]} · ${tab}` : eSel ? `Link · ${tab}` : '',
    routePanelRows: panelRows,
    routePanelClose: (e: React.MouseEvent) => {
      e.stopPropagation();
      setState({ routeSel: null, routeEdgeSel: null });
    },
  };
}
