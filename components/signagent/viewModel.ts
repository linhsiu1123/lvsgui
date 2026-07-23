import React from 'react';
import {
  RISK,
  PRECHECKS,
  SUGGESTIONS,
  TRACES,
  STATUS_DEFS,
  TYPE_DEFS,
  SKILL_DEFS,
  SKILL_NAMES,
  APPROVER_TITLES,
  APPROVER_PERSONS,
  type CaseItem,
  type RouteDef,
} from './data';
import type { State } from './types';

// The vals bag is a faithful port of the original DCLogic.renderVals() output.
// It is intentionally loosely typed (any) — it is a heterogeneous view-model.
/* eslint-disable @typescript-eslint/no-explicit-any */

export function buildVals(
  state: State,
  setState: (patch: Partial<State> | ((prev: State) => Partial<State>)) => void,
  props: { lowRiskAuto: boolean; showRisk: boolean },
): any {
  const s = state;
  const { lowRiskAuto, showRisk } = props;

  // ---- derived cases (lowRiskAuto tweak) ----
  const cases = s.cases.map((c) => {
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
      name: t.name,
      glyph: t.glyph,
      total: String(list.length),
      border: s.dashType === t.name ? 'var(--accent)' : 'var(--line)',
      bar: nonzero.map((x) => ({ w: `${((x.count / list.length) * 100).toFixed(1)}%`, color: x.color })),
      stats: nonzero,
      pick: () => setState((st) => ({ dashType: st.dashType === t.name ? null : t.name })),
    };
  });
  const stageOf = (c: CaseItem) => {
    if (c.status === 'pending') return `Awaiting ${c.route[c.routeIdx!].name}`;
    if (c.status === 'auto') return 'Agent auto-approved (auditing)';
    if (c.status === 'approved') return 'Approval complete';
    return c.lastEvent.split('·').pop()!.trim();
  };
  const dashRows = cases
    .filter((c) => !s.dashType || c.type === s.dashType)
    .map((c) => {
      const sd = statusDefs.find((x) => x[0] === c.status)!;
      const rb = showRisk
        ? { label: `${c.risk} Risk`, bg: RISK[c.risk].bgVar, fg: RISK[c.risk].fgVar }
        : { label: '—', bg: 'transparent', fg: 'var(--sub)' };
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
  const pendingMine = cases.filter((c) => c.status === 'pending' && c.routeIdx === 0 && !c.currentLevel2);
  const riskBadge = (r: CaseItem['risk']) =>
    showRisk
      ? { label: `${r} Risk`, bg: RISK[r].bgVar, fg: RISK[r].fgVar }
      : { label: '', bg: 'transparent', fg: 'transparent' };
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
  const selChecks = sel
    ? (PRECHECKS[sel.id] || PRECHECKS.default).map((c) => ({ ...c, color: c.ok ? 'var(--green)' : 'var(--amber)' }))
    : [];
  const sug = sel ? SUGGESTIONS[sel.id] || SUGGESTIONS.default : null;
  const selRb = sel ? riskBadge(sel.risk) : { label: '', bg: 'transparent', fg: 'transparent' };

  // ---- admin skills ----
  const skillCards = SKILL_DEFS.map((d) => {
    const on = s.skills[d.key];
    return {
      ...d,
      on,
      opacity: on ? 1 : 0.55,
      toggle: (checked: boolean) => setState((st) => ({ skills: { ...st.skills, [d.key]: checked } })),
    };
  });

  // ---- approve / reject ----
  const approve = () => {
    const id = s.selId;
    setState((st) => ({
      rejecting: false,
      rejectReason: '',
      cases: st.cases.map((c) => {
        if (c.id !== id) return c;
        const route = c.route.map((r, i) => (i === c.routeIdx ? { ...r, state: 'done' as const } : r));
        const nextIdx = (c.routeIdx ?? 0) + 1;
        const finished = nextIdx >= route.length;
        return {
          ...c,
          route,
          routeIdx: nextIdx,
          status: finished ? ('approved' as const) : ('pending' as const),
          currentLevel2: !finished,
          lastEvent:
            'just now · Dep. Mgr. Lin approved' +
            (finished ? ', approval complete' : ', routed to Design Center Assoc. Mgr. Wang'),
        };
      }),
      selId: null,
    }));
  };
  const rejectConfirm = () => {
    if (!s.rejectReason.trim()) return;
    const id = s.selId;
    const reason = s.rejectReason;
    setState((st) => ({
      rejecting: false,
      rejectReason: '',
      cases: st.cases.map((c) =>
        c.id === id
          ? {
              ...c,
              status: 'rejected' as const,
              route: c.route.map((r, i) => (i === c.routeIdx ? { ...r, state: 'rejected' as const } : r)),
              lastEvent: `just now · Dep. Mgr. Lin rejected: ${reason}`,
            }
          : c,
      ),
      selId: null,
    }));
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
    ...feedVals(s),
    dashFiltered: !!s.dashType,
    dashFilterLabel: s.dashType || 'All types',
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

    // routes
    ...routeVals(s, setState),
  };
}

// ── modal view-model ──
function modalVals(
  s: State,
  setState: (patch: Partial<State> | ((prev: State) => Partial<State>)) => void,
  cases: CaseItem[],
  statusDefs: typeof STATUS_DEFS,
  showRisk: boolean,
): any {
  const c = s.dashModal ? cases.find((x) => x.id === s.dashModal) : null;
  const close = () => setState({ dashModal: null });
  if (!c) return { dashModalOpen: false, dashModalClose: close };
  const sd = statusDefs.find((x) => x[0] === c.status)!;
  const rb = showRisk
    ? { label: `${c.risk} Risk`, bg: RISK[c.risk].bgVar, fg: RISK[c.risk].fgVar }
    : { label: '—', bg: 'var(--surface2)', fg: 'var(--sub)' };
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
    ? 'Low Risk → Agent Auto-approve'
    : `${c.risk} Risk → ${c.route.length} levels of manual approval`;
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
    modalGoRoutes: () =>
      setState({
        dashModal: null,
        role: 'routes',
        routeTab: c.type,
        routeSel: isAuto ? 'auto' : 'sw',
        routeEdgeSel: null,
      }),
    modalSteps: withLines,
    modalLastEvent: c.lastEvent,
  };
}

// ── activity-feed view-model ──
function feedVals(s: State): any {
  const chipC: Record<string, [string, string]> = {
    accent: ['var(--accent-soft)', 'var(--accent)'],
    amber: ['var(--amber-soft)', 'var(--amber)'],
    green: ['var(--green-soft)', 'var(--green)'],
  };
  const feed = s.feed || [];
  const feedItems = feed.map((f) => {
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
    feedWorkingOn: !!s.feedWorking,
    feedWorkingLabel: s.feedWorking || '',
    feedIdle: !s.feedWorking && feed.length > 0,
  };
}

// ── routing-rules flow-canvas view-model ──
function routeVals(
  s: State,
  setState: (patch: Partial<State> | ((prev: State) => Partial<State>)) => void,
): any {
  const tab = s.routeTab;
  const on = s.routeOn[tab];
  const G = 'var(--green)',
    A = 'var(--amber)',
    R = 'var(--red)';
  const GS = 'var(--green-soft)',
    AS = 'var(--amber-soft)',
    RS = 'var(--red-soft)';

  const defs = s.routeDefs;
  const D = defs[tab];
  const T = APPROVER_TITLES;
  const P = APPROVER_PERSONS;
  const optList = Object.keys(T).map((k) => ({ v: k, label: T[k] }));
  const now = new Date();
  const today = `${now.getMonth() + 1}/${String(now.getDate()).padStart(2, '0')}`;
  const bump = (m: string) => m.replace(/updated [\d/]+|created today/, `updated ${today}`);
  const setChain = (branch: 'mid' | 'high', mut: (arr: string[]) => void) =>
    setState((st) => {
      const d = st.routeDefs[tab];
      const arr = [...(d[branch] as string[])];
      mut(arr);
      if (!arr.length) return {};
      return { routeDefs: { ...st.routeDefs, [tab]: { ...d, [branch]: arr, meta: bump(d.meta) } } };
    });

  const skillOpts = [{ v: '', label: '— None —' }, ...Object.keys(SKILL_NAMES).map((k) => ({ v: k, label: SKILL_NAMES[k] }))];
  const defaultNodeSkill: Record<string, string> = { a: 'precheck', sw: 'route', auto: 'auto' };
  const setNodeSkill = (id: string, key: string) =>
    setState((st) => ({ nodeSkills: { ...st.nodeSkills, [id]: key } }));
  const skillRow = (id: string) => {
    const val = s.nodeSkills && s.nodeSkills[id] !== undefined ? s.nodeSkills[id] : defaultNodeSkill[id] || '';
    return {
      isSel: true,
      k: 'Skill',
      options: skillOpts,
      value: val,
      change: (e: any) => setNodeSkill(id, e.target.value),
    };
  };
  const defaultVerify: Record<string, boolean> = { t: false, a: false, sw: false, auto: false, rev: true };
  const verifyKey = (id: string) => `${tab}:${id}`;
  const verifyOn = (id: string) => {
    const k = verifyKey(id);
    return s.nodeVerify && s.nodeVerify[k] !== undefined
      ? s.nodeVerify[k]
      : defaultVerify[id] !== undefined
        ? defaultVerify[id]
        : true;
  };
  const verifyRow = (id: string) => {
    const von = verifyOn(id);
    return {
      isToggle: true,
      k: 'Human verify?',
      v: von ? 'Requires manual confirmation' : 'No confirmation needed',
      fg: von ? 'var(--ink)' : 'var(--sub)',
      checked: von,
      toggle: () => {
        const k = verifyKey(id);
        setState((st) => ({
          nodeVerify: {
            ...st.nodeVerify,
            [k]: !(st.nodeVerify && st.nodeVerify[k] !== undefined
              ? st.nodeVerify[k]
              : defaultVerify[id] !== undefined
                ? defaultVerify[id]
                : true),
          },
        }));
      },
    };
  };

  const removed = D.removed || [];
  const has = (id: string) => removed.indexOf(id) < 0;
  const cfgAll = D.cfg || {};
  const cfgT = { event: 'Uploaded to DMS', source: 'DMS repository', ...cfgAll.t };
  const cfgA = { mode: 'Standard', ...cfgAll.a };
  const cfgAuto = { cond: 'Risk = Low AND all pre-checks passed', ...cfgAll.auto };
  const cfgRev = { rate: '20%', when: 'Within 24h', ...cfgAll.rev };
  const opt = (arr: string[]) => arr.map((x) => ({ v: x, label: x }));
  const setCfg = (id: string, patch: Record<string, string>) =>
    setState((st) => {
      const d = st.routeDefs[tab];
      const c = d.cfg || {};
      return {
        routeDefs: {
          ...st.routeDefs,
          [tab]: { ...d, cfg: { ...c, [id]: { ...(c[id] || {}), ...patch } }, meta: bump(d.meta) },
        },
      };
    });
  const removeNode = (id: string) =>
    setState((st) => {
      const d = st.routeDefs[tab];
      return {
        routeSel: null,
        routeDefs: { ...st.routeDefs, [tab]: { ...d, removed: [...(d.removed || []), id], meta: bump(d.meta) } },
      };
    });
  const restoreNode = (id: string) =>
    setState((st) => {
      const d = st.routeDefs[tab];
      return {
        routeDefs: {
          ...st.routeDefs,
          [tab]: { ...d, removed: (d.removed || []).filter((x) => x !== id), meta: bump(d.meta) },
        },
      };
    });

  interface FlowNode {
    id: string;
    x: number;
    y: number;
    kind: string;
    glyph: string;
    title: string;
    sub: string;
    person?: string;
  }
  const nodes: FlowNode[] = [];
  const mk = (id: string, x: number, y: number, kind: string, glyph: string, title: string, sub: string, person?: string) =>
    nodes.push({ id, x, y, kind, glyph, title, sub, person });
  if (has('t')) mk('t', 30, 250, 'trigger', 'IN', 'Document Submitted', cfgT.source);
  if (has('a')) mk('a', 250, 250, 'agent', 'PR', 'Agent Pre-review', `${cfgA.mode} · format · attachments · ECO`);
  mk('sw', 470, 217, 'switch', 'GR', 'Risk Grading', 'Agent overall judgment');
  if (has('auto')) mk('auto', 700, 70, 'auto', 'OK', 'Agent Auto-approve', 'skill · Low-risk auto-approve');
  if (has('rev')) mk('rev', 925, 70, 'review', 'AU', 'Approval Lead Audit', `Sample ${cfgRev.rate} · ${cfgRev.when}`);
  const bx = [700, 925, 1150];
  D.mid.forEach((k, i) => mk(`m${i}`, bx[i], 250, 'human', 'SG', T[k], `Stage ${i + 1} · SLA 24h`, P[k]));
  D.high.forEach((k, i) => mk(`h${i}`, bx[i], 430, 'human', 'SG', T[k], `Stage ${i + 1} · SLA 24h`, P[k]));

  const byId: Record<string, FlowNode> = {};
  nodes.forEach((n) => (byId[n.id] = n));
  const cy = (n: FlowNode) => n.y + 33;
  const bez = (x1: number, y1: number, x2: number, y2: number) =>
    `M ${x1} ${y1} C ${x1 + 62} ${y1}, ${x2 - 62} ${y2}, ${x2} ${y2}`;
  interface Edge {
    id: string;
    from: string;
    to: string;
    d: string;
    stroke: string;
  }
  const edges: Edge[] = [];
  const link = (id: string, a: string, b: string, stroke?: string) => {
    const n1 = byId[a],
      n2 = byId[b];
    if (!n1 || !n2) return;
    edges.push({ id, from: a, to: b, d: bez(n1.x + 190, cy(n1), n2.x, cy(n2)), stroke: stroke || 'var(--sub)' });
  };
  const spine = ['t', 'a', 'sw'].filter(has);
  for (let si = 1; si < spine.length; si++) link(`sp-${spine[si]}`, spine[si - 1], spine[si]);
  const branchFn = (id: string, i: number, target: string, stroke: string) => {
    const n2 = byId[target];
    if (n2) edges.push({ id, from: 'sw', to: target, d: bez(660, 277 + 26 * i, n2.x, cy(n2)), stroke });
  };
  const lowTarget = has('auto') ? 'auto' : has('rev') ? 'rev' : null;
  if (lowTarget) branchFn('br-low', 0, lowTarget, G);
  branchFn('br-mid', 1, 'm0', A);
  branchFn('br-high', 2, 'h0', R);
  link('auto-rev', 'auto', 'rev', G);
  D.mid.forEach((k, i) => {
    if (i > 0) link(`cm-${i - 1}`, `m${i - 1}`, `m${i}`, A);
  });
  D.high.forEach((k, i) => {
    if (i > 0) link(`ch-${i - 1}`, `h${i - 1}`, `h${i}`, R);
  });

  const labels = [
    { text: 'Low Risk', x: 700, y: 44, bg: GS, fg: G },
    { text: 'Medium Risk', x: 700, y: 224, bg: AS, fg: A },
    { text: 'High Risk', x: 700, y: 404, bg: RS, fg: R },
  ];

  const iconMap: Record<string, [string, string]> = {
    trigger: ['var(--accent-soft)', 'var(--accent)'],
    agent: ['var(--accent-soft)', 'var(--accent)'],
    switch: [AS, A],
    human: ['var(--accent-soft)', 'var(--accent)'],
    auto: [GS, G],
    review: [AS, A],
  };
  const lastM = `m${D.mid.length - 1}`,
    lastH = `h${D.high.length - 1}`;
  const flowNodes = nodes.map((n) => {
    const isSwitch = n.kind === 'switch';
    const ports: { top: number; left: string; right: string; color: string }[] = [];
    if (n.id !== 't') ports.push({ top: 28, left: '-5px', right: 'auto', color: 'var(--sub)' });
    if (isSwitch) {
      ports.push({ top: 55.5, left: 'auto', right: '-5px', color: G });
      ports.push({ top: 81.5, left: 'auto', right: '-5px', color: A });
      ports.push({ top: 107.5, left: 'auto', right: '-5px', color: R });
    } else if (n.id !== 'rev' && n.id !== lastM && n.id !== lastH) {
      ports.push({ top: 28, left: 'auto', right: '-5px', color: 'var(--sub)' });
    }
    return {
      ...n,
      h: isSwitch ? 132 : 66,
      headH: isSwitch ? 46 : 63,
      isSwitch,
      iconBg: iconMap[n.kind][0],
      iconFg: iconMap[n.kind][1],
      border: s.routeSel === n.id ? 'var(--accent)' : 'var(--line)',
      rows: isSwitch
        ? [
            { dot: G, label: 'Low Risk', to: '→ Auto-approve' },
            { dot: A, label: 'Medium Risk', to: `→ ${D.mid.length} levels` },
            { dot: R, label: 'High Risk', to: `→ ${D.high.length} levels` },
          ]
        : [],
      ports,
      pick: (e: React.MouseEvent) => {
        e.stopPropagation();
        setState({ routeSel: n.id, routeEdgeSel: null });
      },
    };
  });

  const sel = s.routeSel ? byId[s.routeSel] : null;
  const kindLabel: Record<string, string> = {
    trigger: 'Trigger node',
    agent: 'Agent node',
    switch: 'Branch node',
    human: 'Manual approval',
    auto: 'Auto-approve',
    review: 'Audit node',
  };
  const ink = 'var(--ink)';
  let panelRows: any[] = [];
  if (sel) {
    const delRow = {
      isBtn: true,
      danger: true,
      label: 'Delete node',
      click: (e: React.MouseEvent) => {
        e.stopPropagation();
        removeNode(sel.id);
      },
    };
    if (sel.kind === 'trigger')
      panelRows = [
        {
          isSel: true,
          k: 'Trigger event',
          options: opt(['Uploaded to DMS', 'Scheduled trigger']),
          value: cfgT.event,
          change: (e: any) => setCfg('t', { event: e.target.value }),
        },
        {
          isSel: true,
          k: 'Source',
          options: opt(['DMS repository', 'Form', 'API integration']),
          value: cfgT.source,
          change: (e: any) => setCfg('t', { source: e.target.value }),
        },
        { k: 'Doc type', v: tab, fg: ink },
        delRow,
      ];
    else if (sel.kind === 'agent')
      panelRows = [
        {
          isSel: true,
          k: 'Decision mode',
          options: opt(['Standard', 'Strict (escalate on borderline)', 'Lenient (escalate only High)']),
          value: cfgA.mode,
          change: (e: any) => setCfg('a', { mode: e.target.value }),
        },
        { k: 'Checks', v: 'format · attachments · version · linked ECO', fg: ink },
        { k: 'Output', v: 'Risk level (Low / Medium / High)', fg: ink },
        delRow,
      ];
    else if (sel.kind === 'switch') {
      panelRows = [{ k: 'Low Risk', v: 'Agent Auto-approve (post-audit)', fg: G }];
      ([['mid', 'Medium Risk', A], ['high', 'High Risk', R]] as ['mid' | 'high', string, string][]).forEach(
        ([br, name, color]) => {
          panelRows.push({ k: name, v: `${D[br].length} levels`, fg: color });
          D[br].forEach((key, i) => {
            panelRows.push({
              isSel: true,
              k: `Stage ${i + 1}`,
              options: optList,
              value: key,
              change: (e: any) => {
                const v = e.target.value;
                setChain(br, (a) => {
                  a[i] = v;
                });
              },
              canRemove: D[br].length > 1,
              remove: (e: React.MouseEvent) => {
                e.stopPropagation();
                setChain(br, (a) => {
                  a.splice(i, 1);
                });
              },
            });
          });
          if (D[br].length < 3)
            panelRows.push({
              isBtn: true,
              label: `＋ ${name} add a stage`,
              click: (e: React.MouseEvent) => {
                e.stopPropagation();
                setChain(br, (a) => {
                  a.push('v');
                });
              },
            });
        },
      );
    } else if (sel.kind === 'human') {
      const hm = /^([mh])(\d+)$/.exec(sel.id)!;
      const branch = hm[1] === 'm' ? 'mid' : 'high';
      const hi = +hm[2];
      const arr = D[branch];
      const nextKey = hi + 1 < arr.length ? arr[hi + 1] : 'end';
      panelRows = [
        {
          isSel: true,
          k: 'Approver',
          options: optList,
          value: arr[hi],
          change: (e: any) => {
            const v = e.target.value;
            setChain(branch, (a) => {
              a[hi] = v;
            });
          },
        },
        {
          isSel: true,
          k: 'Next stage',
          options: [...optList, { v: 'end', label: 'End approval' }],
          value: nextKey,
          change: (e: any) => {
            const v = e.target.value;
            setChain(branch, (a) => {
              if (v === 'end') a.length = hi + 1;
              else if (hi + 1 < a.length) a[hi + 1] = v;
              else a.push(v);
            });
          },
        },
        { k: 'SLA', v: '24 hours', fg: ink },
        { k: 'Actions', v: 'Approve / Reject (reason required)', fg: ink },
      ];
      if (arr.length > 1)
        panelRows.push({
          isBtn: true,
          danger: true,
          label: 'Remove this stage',
          click: (e: React.MouseEvent) => {
            e.stopPropagation();
            setState({ routeSel: null });
            setChain(branch, (a) => {
              a.splice(hi, 1);
            });
          },
        });
    } else if (sel.kind === 'auto')
      panelRows = [
        {
          k: 'Status',
          v: `Low-risk auto-approve · ${s.skills.auto ? 'Enabled' : 'Disabled (routes to manual)'}`,
          fg: s.skills.auto ? G : R,
        },
        {
          isSel: true,
          k: 'Condition',
          options: opt(['Risk = Low AND all pre-checks passed', 'Only Risk = Low']),
          value: cfgAuto.cond,
          change: (e: any) => setCfg('auto', { cond: e.target.value }),
        },
        { k: 'After', v: `Approval Lead Audit ${cfgRev.rate}`, fg: ink },
        delRow,
      ];
    else
      panelRows = [
        { k: 'Executor', v: 'Approval Lead', fg: ink },
        {
          isSel: true,
          k: 'Sample rate',
          options: opt(['10%', '20%', '30%', '100%']),
          value: cfgRev.rate,
          change: (e: any) => setCfg('rev', { rate: e.target.value }),
        },
        {
          isSel: true,
          k: 'Timing',
          options: opt(['Within 24h', 'Within 48h', 'Weekly summary']),
          value: cfgRev.when,
          change: (e: any) => setCfg('rev', { when: e.target.value }),
        },
        delRow,
      ];
  }

  let eSel: Edge | null = null;
  let edgeTitle = '';
  if (!sel && s.routeEdgeSel) {
    eSel = edges.find((ed) => ed.id === s.routeEdgeSel) || null;
    if (eSel) {
      const nameOf = (id: string) => (byId[id] ? byId[id].title : id);
      edgeTitle = `${nameOf(eSel.from)} → ${nameOf(eSel.to)}`;
      const clearEdge = () => setState({ routeEdgeSel: null });
      const eid = eSel.id;
      const chainEdge = /^c([mh])-(\d+)$/.exec(eid);
      panelRows = [{ k: 'Source', v: nameOf(eSel.from), fg: ink }];
      if (eid === 'sp-a') {
        panelRows.push({
          isSel: true,
          k: 'Target',
          options: opt(['Agent Pre-review', 'Risk Grading (skip pre-review)']),
          value: 'Agent Pre-review',
          change: (e: any) => {
            if (e.target.value !== 'Agent Pre-review') {
              removeNode('a');
              clearEdge();
            }
          },
        });
      } else if (eid === 'sp-sw') {
        panelRows.push({ k: 'Target', v: 'Risk Grading', fg: ink });
        if (!has('a'))
          panelRows.push({
            isBtn: true,
            label: '↺ Restore Agent Pre-review node',
            click: (e: React.MouseEvent) => {
              e.stopPropagation();
              restoreNode('a');
              clearEdge();
            },
          });
      } else if (eid === 'br-low') {
        const lowOpts = has('rev')
          ? ['Agent Auto-approve', 'Approval Lead Audit (skip auto-approve)']
          : ['Agent Auto-approve'];
        panelRows.push({
          isSel: true,
          k: 'Target',
          options: opt(lowOpts),
          value: has('auto') ? 'Agent Auto-approve' : 'Approval Lead Audit (skip auto-approve)',
          change: (e: any) => {
            const v = e.target.value;
            clearEdge();
            if (v === 'Agent Auto-approve') restoreNode('auto');
            else removeNode('auto');
          },
        });
        panelRows.push({ k: 'Condition', v: 'Risk = Low', fg: G });
      } else if (eid === 'br-mid' || eid === 'br-high') {
        const br = eid === 'br-mid' ? 'mid' : 'high';
        panelRows.push({
          isSel: true,
          k: 'Stage 1',
          options: optList,
          value: D[br][0],
          change: (e: any) => {
            const v = e.target.value;
            setChain(br, (a) => {
              a[0] = v;
            });
          },
        });
        panelRows.push({ k: 'Condition', v: br === 'mid' ? 'Risk = Medium' : 'Risk = High', fg: br === 'mid' ? A : R });
      } else if (chainEdge) {
        const br = chainEdge[1] === 'm' ? 'mid' : 'high';
        const ci = +chainEdge[2];
        panelRows.push({
          isSel: true,
          k: 'Target approver',
          options: optList,
          value: D[br][ci + 1],
          change: (e: any) => {
            const v = e.target.value;
            setChain(br, (a) => {
              a[ci + 1] = v;
            });
          },
        });
        panelRows.push({
          isBtn: true,
          danger: true,
          label: 'Delete link (approval ends here)',
          click: (e: React.MouseEvent) => {
            e.stopPropagation();
            clearEdge();
            setChain(br, (a) => {
              a.length = ci + 1;
            });
          },
        });
      } else {
        panelRows.push({ k: 'Target', v: nameOf(eSel.to), fg: ink });
        panelRows.push({ k: 'Condition', v: 'Sent to audit after auto-approve', fg: ink });
      }
    }
  }
  if (sel) panelRows = [skillRow(sel.id), verifyRow(sel.id), ...panelRows];
  panelRows = panelRows.map((r) =>
    r.isBtn || r.isSel || r.isToggle
      ? r.isBtn
        ? { ...r, fg2: r.danger ? 'var(--red)' : 'var(--sub)' }
        : r
      : { ...r, isText: true },
  );

  const commitRename = () =>
    setState((st) => {
      const name = (st.routeNameDraft || '').trim();
      if (!name || name === tab || st.routeDefs[name]) return { routeRenaming: false };
      const nd: Record<string, RouteDef> = {};
      Object.keys(st.routeDefs).forEach((k) => {
        nd[k === tab ? name : k] = st.routeDefs[k];
      });
      const no = { ...st.routeOn };
      no[name] = no[tab];
      delete no[tab];
      return { routeDefs: nd, routeOn: no, routeTab: name, routeRenaming: false };
    });

  const zoomSet = (dz: number) =>
    setState((st) => ({ routeZoom: Math.min(1.3, Math.max(0.55, Math.round((st.routeZoom + dz) * 100) / 100)) }));

  return {
    isRoutes: s.role === 'routes',
    routeTabs: Object.keys(defs).map((k) => ({
      label: k,
      fw: tab === k ? 700 : 400,
      bg: tab === k ? 'var(--surface)' : 'transparent',
      fg: tab === k ? 'var(--ink)' : 'var(--sub)',
      pick: () => setState({ routeTab: k, routeSel: null, routeEdgeSel: null }),
    })),
    routeMeta: D.meta,
    routeAddFlow: () =>
      setState((st) => {
        let n = 1;
        while (st.routeDefs[`New Flow ${n}`]) n++;
        const name = `New Flow ${n}`;
        return {
          routeDefs: {
            ...st.routeDefs,
            [name]: { meta: 'v1 · created today · System Admin', mid: ['v'], high: ['v', 'd'] },
          },
          routeOn: { ...st.routeOn, [name]: true },
          routeTab: name,
          routeSel: null,
          routeRenaming: true,
          routeNameDraft: name,
        };
      }),
    routeRenaming: s.routeRenaming,
    routeNotRenaming: !s.routeRenaming,
    routeNameDraft: s.routeNameDraft,
    routeRenameStart: () => setState({ routeRenaming: true, routeNameDraft: tab }),
    routeNameInput: (e: any) => setState({ routeNameDraft: e.target.value }),
    routeNameKey: (e: any) => {
      if (e.key === 'Enter') commitRename();
    },
    routeRenameCommit: commitRename,
    routeRemovedChips: removed.map((id) => ({
      label:
        ({ t: 'Document Submitted', a: 'Agent Pre-review', auto: 'Auto-approve', rev: 'Approval Lead Audit' } as Record<string, string>)[
          id
        ] || id,
      restore: () => restoreNode(id),
    })),
    routeStateLabel: on ? 'Rule active' : 'Disabled',
    routeStateFg: on ? G : 'var(--sub)',
    routeOn: on,
    routeToggle: () => setState((st) => ({ routeOn: { ...st.routeOn, [tab]: !st.routeOn[tab] } })),
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
    routePanelTitle: sel ? sel.title : edgeTitle,
    routePanelKind: sel ? `${kindLabel[sel.kind]} · ${tab}` : eSel ? `Link · ${tab}` : '',
    routePanelRows: panelRows,
    routePanelClose: (e: React.MouseEvent) => {
      e.stopPropagation();
      setState({ routeSel: null, routeEdgeSel: null });
    },
  };
}
