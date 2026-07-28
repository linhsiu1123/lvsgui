'use client';

import { Alert, Avatar, Input, Modal, Select, Skeleton, Switch, Table, Tooltip } from 'antd';
import type { ColumnsType } from 'antd/es/table';

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Shown while the first load of documents, flows and skills is in flight. */
export function LoadingScreen() {
  return (
    <div className="max-w-[1400px] mx-auto pt-[26px] px-7 pb-12" role="status" aria-label="Loading console data">
      <Skeleton active paragraph={{ rows: 2 }} />
      <div className="mt-8">
        <Skeleton active paragraph={{ rows: 6 }} />
      </div>
    </div>
  );
}

/** The initial load failed outright — nothing can be rendered. */
export function ErrorScreen({ message, onRetry }: { message: string | null; onRetry: () => void }) {
  return (
    <div className="max-w-[680px] mx-auto pt-16 px-7">
      <Alert
        type="error"
        showIcon
        message="Could not load the approval console"
        description={message ?? 'The approval service did not respond.'}
        action={
          <button
            onClick={onRetry}
            className="cursor-pointer text-xs font-bold px-3 py-1.5 rounded-md border border-line bg-surface text-accent"
          >
            Retry
          </button>
        }
      />
    </div>
  );
}

/** A write failed, but the console is still usable — never block on this. */
export function ActionErrorBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div className="px-7 pt-3">
      <Alert type="warning" showIcon closable message={message} onClose={onDismiss} />
    </div>
  );
}

// Repeated Tailwind recipes for the design's building blocks.
const mono = 'font-mono';
const iconChip = 'grid place-items-center font-bold flex-none';

function PillTabs({ label, tabs, dashed }: { label: string; tabs: any[]; dashed?: boolean }) {
  return (
    <div
      className={`flex items-center gap-1 bg-surface2 rounded-md border border-line pl-2.5 pr-[3px] py-[3px] ${
        dashed ? 'border-dashed' : 'border-solid'
      }`}
    >
      <span className="text-[10.5px] font-bold text-accent bg-accent-soft px-[9px] py-[3px] rounded-full tracking-[0.5px] mr-1 whitespace-nowrap flex-none">
        {label}
      </span>
      {tabs.map((t, i) => (
        <button
          key={i}
          onClick={t.pick}
          className="whitespace-nowrap flex-none border-none cursor-pointer px-4 py-[7px] rounded-lg text-[13px] transition-colors duration-150"
          style={{ fontWeight: t.fw, background: t.bg, color: t.fg }}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function TopBar({ vals }: { vals: any }) {
  return (
    <div className="h-[58px] flex items-center gap-6 px-5 bg-surface border-b border-line sticky top-0 z-10">
      <div className="flex items-center gap-2.5">
        <div className={`w-7 h-7 rounded-lg bg-accent text-on-accent text-[11.5px] ${iconChip}`}>SW</div>
        <div>
          <div className="font-bold text-[15px] leading-[1.2]">Smart Workflow</div>
          <div className="text-[11px] text-sub leading-[1.2]">LVS QC Document Approval · Agent</div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <PillTabs label="Workspace" tabs={vals.workTabs} />
        <PillTabs label="ADMIN" tabs={vals.adminTabs} dashed />
      </div>
      <div className="ml-auto flex items-center gap-2.5">
        <div className="text-right">
          <div className="font-medium text-[13px] leading-[1.2]">{vals.personaName}</div>
          <div className="text-[11px] text-sub leading-[1.2]">{vals.personaRole}</div>
        </div>
        {/* antd sets its own background/colour on .ant-avatar, which beats
            utility classes; inline style is the documented way to win without
            reaching into `.ant-*` selectors. */}
        <Avatar
          size={32}
          className="font-bold"
          style={{ background: 'var(--accent-soft)', color: 'var(--accent)', fontSize: 14 }}
        >
          {vals.personaInitial}
        </Avatar>
      </div>
    </div>
  );
}

const pill = 'inline-block text-[11.5px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap';

// antd exposes no header font-size/weight token, so the design's 11.5px/700
// header is applied through the documented `title` ReactNode instead of a
// `.ant-table-thead` CSS override. Colour comes from the `headerColor` token.
const th = (label: string) => <span className="text-[11.5px] font-bold">{label}</span>;

const dashColumns: ColumnsType<any> = [
  {
    title: th('ID'),
    dataIndex: 'id',
    width: 96,
    render: (v: string) => <span className={`${mono} text-xs text-sub`}>{v}</span>,
  },
  {
    title: th('Document'),
    dataIndex: 'title',
    render: (v: string) => <span className="font-medium">{v}</span>,
  },
  {
    title: th('Product Type'),
    dataIndex: 'type',
    width: 124,
    render: (v: string) => <span className="text-sub">{v}</span>,
  },
  {
    // Low risk is the norm and carries no badge, so the cell is often empty.
    title: th('Alert Type'),
    dataIndex: 'riskLabel',
    width: 88,
    render: (v: string, r: any) =>
      v ? (
        <span className={`${pill} px-2`} style={{ background: r.riskBg, color: r.riskFg }}>
          {v}
        </span>
      ) : null,
  },
  {
    title: th('Status'),
    dataIndex: 'stLabel',
    width: 120,
    render: (v: string, r: any) => (
      <Tooltip title={r.stTitle}>
        <span
          onClick={r.stClick}
          className={`sa-hover-brightf ${pill} cursor-pointer`}
          style={{ background: r.stBg, color: r.stFg }}
        >
          {v}
          <span className="ml-[5px] text-[10px]">↗</span>
        </span>
      </Tooltip>
    ),
  },
  {
    title: th('Current Stage'),
    dataIndex: 'stage',
    render: (v: string) => <span className="text-sub text-[12.5px]">{v}</span>,
  },
];

export function DashboardScreen({ vals }: { vals: any }) {
  return (
    <div className="max-w-[1400px] mx-auto pt-[26px] px-7 pb-12 flex flex-wrap gap-[22px] items-start">
      <div className="flex-[1_1_620px] min-w-0">
        <div className="flex items-baseline gap-3 mb-4">
          <h2 className="m-0 text-[19px] font-bold">Approval Overview</h2>
          <span className="text-[12.5px] text-sub">By product type · Live status</span>
        </div>
        <div className="grid grid-cols-3 gap-3.5">
          {vals.dashTypes.map((dt: any) => (
            <div
              key={dt.key}
              onClick={dt.pick}
              className="sa-hover-accent cursor-pointer bg-surface rounded-lg p-[18px] border-[1.5px]"
              style={{ borderColor: dt.border }}
            >
              <div className="flex items-center gap-2.5">
                <div className={`w-[34px] h-[34px] rounded-md bg-accent-soft text-accent text-[15px] ${iconChip}`}>
                  {dt.glyph}
                </div>
                <div className="font-bold text-[14.5px]">{dt.name}</div>
                <div className="ml-auto text-[22px] font-bold">{dt.total}</div>
              </div>
              <div className="flex h-2 rounded-full overflow-hidden mt-3.5 bg-surface2">
                {dt.bar.map((b: any, i: number) => (
                  <span key={i} style={{ width: b.w, background: b.color }} />
                ))}
              </div>
              <div className="flex flex-wrap gap-x-3.5 gap-y-2 mt-3">
                {dt.stats.map((ds: any, i: number) => (
                  <div key={i} className="flex items-center gap-[5px] text-xs text-sub">
                    <span className="w-2 h-2 rounded-full" style={{ background: ds.color }} />
                    <span>
                      {ds.label} {ds.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2.5 mt-[26px] mb-3">
          <span className="text-xs font-bold tracking-[0.08em] text-sub">Approval Status</span>
          <span className="text-xs text-sub">· {vals.dashFilterLabel}</span>
          {vals.dashFiltered && (
            <button
              onClick={vals.dashClear}
              className="cursor-pointer text-xs font-bold px-2.5 py-1 rounded-full border border-line bg-surface text-accent"
            >
              Show all
            </button>
          )}
        </div>
        <Table
          className="border border-line rounded-lg overflow-hidden"
          columns={dashColumns}
          dataSource={vals.dashRows}
          rowKey="id"
          pagination={false}
        />
      </div>

      <ActivityFeed vals={vals} />
      <DetailModal vals={vals} />
    </div>
  );
}

function ActivityFeed({ vals }: { vals: any }) {
  return (
    <div className="flex-[1_1_300px] max-w-[440px] sticky top-[84px] bg-surface border border-line rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-[13px] border-b border-line bg-surface2">
        <span
          className="w-2 h-2 rounded-full bg-green"
          style={{ animation: 'pulse 1.6s ease infinite' }}
        />
        <span className="text-[13px] font-bold">Agent Activity</span>
        <span className="ml-auto text-[10.5px] font-bold text-green tracking-[0.08em]">LIVE</span>
      </div>
      <div className="px-4 pt-1 pb-3.5 flex flex-col">
        {vals.feedWorkingOn && (
          <div className="flex items-center gap-2.5 py-3 border-b border-dashed border-line">
            <div className={`w-[26px] h-[26px] rounded-lg bg-accent-soft text-accent text-xs ${iconChip}`}>AI</div>
            <span className="text-[12.5px] text-sub">{vals.feedWorkingLabel}</span>
            <span className="flex gap-[3px] ml-0.5">
              {[0, 0.2, 0.4].map((d) => (
                <span
                  key={d}
                  className="w-1 h-1 rounded-full bg-accent"
                  style={{ animation: 'blink 1.2s infinite', animationDelay: `${d}s` }}
                />
              ))}
            </span>
          </div>
        )}
        {vals.feedIdle && (
          <div className="flex items-center gap-2.5 py-3 border-b border-dashed border-line">
            <div className={`w-[26px] h-[26px] rounded-lg bg-surface2 text-sub text-xs ${iconChip}`}>AI</div>
            <span className="text-[12.5px] text-sub">Monitoring · awaiting new requests</span>
          </div>
        )}
        {vals.feedItems.map((fi: any, i: number) => (
          <div
            key={i}
            className="flex gap-2.5 py-[11px] border-b border-dashed border-line"
            style={{ animation: 'fadeUp .3s ease' }}
          >
            <div
              className={`w-[26px] h-[26px] rounded-lg text-xs ${iconChip}`}
              style={{ background: fi.chipBg, color: fi.chipFg }}
            >
              {fi.icon}
            </div>
            <div className="min-w-0">
              <div className="text-[12.5px] leading-normal">{fi.text}</div>
              <div className="text-[11px] text-sub mt-0.5">
                {fi.time}
                {fi.subSep}
                {fi.sub}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DetailModal({ vals }: { vals: any }) {
  return (
    <Modal
      open={!!vals.dashModalOpen}
      onCancel={vals.dashModalClose}
      footer={null}
      closable={false}
      width={584}
      getContainer={false}
      styles={{ body: { padding: 0 } }}
    >
      {vals.dashModalOpen && (
        <div className="p-0.5">
          <div className="flex items-center gap-2.5">
            <span className={`${mono} text-[12.5px] text-sub`}>{vals.modalId}</span>
            <span
              className="text-[11.5px] font-bold px-[9px] py-[3px] rounded-full"
              style={{ background: vals.modalRiskBg, color: vals.modalRiskFg }}
            >
              {vals.modalRiskLabel}
            </span>
            <span
              className="text-[11.5px] font-bold px-[9px] py-[3px] rounded-full"
              style={{ background: vals.modalStBg, color: vals.modalStFg }}
            >
              {vals.modalStLabel}
            </span>
            <button
              onClick={vals.dashModalClose}
              className="ml-auto cursor-pointer border-none bg-surface2 text-sub w-[26px] h-[26px] rounded-lg text-[13px]"
            >
              ✕
            </button>
          </div>
          <div className="font-bold text-[15.5px] mt-2.5 leading-[1.4]">{vals.modalTitle}</div>
          <div className="text-[12.5px] text-sub mt-1">{vals.modalMeta}</div>

          <div className="flex items-center gap-2.5 mt-4 px-3.5 py-[11px] rounded-md bg-surface2 border border-line">
            <span className="text-[12.5px] font-bold">{vals.modalRuleLabel}</span>
            <span className="text-[12.5px] text-sub">{vals.modalRuleDesc}</span>
            <button
              onClick={vals.modalGoRoutes}
              className="sa-hover-accent ml-auto cursor-pointer text-xs font-bold px-3 py-1.5 rounded-lg border border-line bg-surface text-accent whitespace-nowrap"
            >
              View routing rules ↗
            </button>
          </div>

          <div className="flex flex-col mt-4">
            {vals.modalSteps.map((st: any, i: number) => (
              <div key={i} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-6 h-6 rounded-full text-[11.5px] ${iconChip}`}
                    style={{ background: st.dotBg, color: st.dotFg }}
                  >
                    {st.icon}
                  </div>
                  {st.hasLine && <div className="w-0.5 flex-1 min-h-[14px] bg-line" />}
                </div>
                <div className="pb-3.5">
                  <div className="text-[13.5px] leading-6" style={{ fontWeight: st.fw, color: st.fg }}>
                    {st.label}
                  </div>
                  {st.sub && <div className="text-xs text-sub mt-px">{st.sub}</div>}
                </div>
              </div>
            ))}
          </div>

          <div className="text-[12.5px] text-sub border-t border-line pt-3">{vals.modalLastEvent}</div>
        </div>
      )}
    </Modal>
  );
}

export function ApproverScreen({ vals }: { vals: any }) {
  return (
    <div className="grid grid-cols-[330px_1fr] h-[calc(100vh-58px)]">
      <div className="border-r border-line overflow-y-auto p-[18px] flex flex-col gap-2.5">
        <div className="text-xs font-bold tracking-[0.08em] text-sub mb-1">
          Awaiting my approval ({vals.approverCount})
        </div>
        {vals.approverCases.map((k: any) => (
          <div
            key={k.id}
            onClick={k.pick}
            className="sa-hover-accent cursor-pointer bg-surface rounded-lg px-3.5 py-[13px] border-[1.5px]"
            style={{ borderColor: k.cardBorder }}
          >
            <div className="flex gap-2 items-center">
              <span className={`${mono} text-xs text-sub`}>{k.id}</span>
              {k.riskLabel && (
                <span
                  className="ml-auto text-[11.5px] font-bold px-2 py-[3px] rounded-full"
                  style={{ background: k.riskBg, color: k.riskFg }}
                >
                  {k.riskLabel}
                </span>
              )}
            </div>
            <div className="font-bold text-[13.5px] mt-1.5 leading-[1.4]">{k.title}</div>
            <div className="text-xs text-sub mt-[5px]">
              {k.submitter} · {k.time}
            </div>
          </div>
        ))}
        {vals.approverEmpty && (
          <div className="text-center text-sub py-10 text-[13px]">No pending items</div>
        )}
      </div>
      <div className="overflow-y-auto px-7 py-6">
        {vals.hasSel ? (
          <div className="max-w-[760px]">
            <div className="flex items-center gap-3">
              <span className={`${mono} text-[13px] text-sub`}>{vals.selId}</span>
              {vals.selRiskLabel && (
                <span
                  className="text-xs font-bold px-2.5 py-1 rounded-full"
                  style={{ background: vals.selRiskBg, color: vals.selRiskFg }}
                >
                  {vals.selRiskLabel}
                </span>
              )}
            </div>
            <h2 className="mt-2 mb-[18px] text-[21px] font-bold">{vals.selTitle}</h2>
            <div className="grid grid-cols-4 gap-3 bg-surface border border-line rounded-lg px-[18px] py-4">
              {vals.selMeta.map((mm: any, i: number) => (
                <div key={i}>
                  <div className="text-[11.5px] text-sub mb-[3px]">{mm.label}</div>
                  <div className="text-[13.5px] font-medium">{mm.value}</div>
                </div>
              ))}
            </div>
            <div className="mt-4 bg-surface border border-line rounded-lg p-[18px]">
              <div className="flex items-center gap-2 mb-3">
                <div className={`w-[22px] h-[22px] rounded-md bg-accent text-on-accent text-[11px] ${iconChip}`}>AI</div>
                <span className="text-[13px] font-bold">Agent Pre-review Report</span>
              </div>
              <div className="flex flex-col gap-2">
                {vals.selChecks.map((c: any, i: number) => (
                  <div key={i} className="flex gap-[9px] items-baseline text-[13.5px]">
                    <span className="font-bold" style={{ color: c.color }}>
                      {c.icon}
                    </span>
                    <span>{c.text}</span>
                  </div>
                ))}
              </div>
              <div
                className="mt-3.5 px-3.5 py-[11px] rounded-md text-[13.5px] font-medium"
                style={{ background: vals.selSugBg, color: vals.selSugFg }}
              >
                {vals.selSuggestion}
              </div>
              <button
                onClick={vals.onTraceToggle}
                className="mt-3 cursor-pointer text-[12.5px] font-bold py-1.5 border-none bg-transparent text-accent"
              >
                {vals.traceToggleLabel}
              </button>
              {vals.traceOpen && (
                <div className="mt-1.5 border-t border-dashed border-line pt-3.5 flex flex-col gap-3">
                  {vals.selTrace.map((tr: any) => (
                    <div key={tr.n} className="flex gap-[11px]" style={{ animation: 'fadeUp .35s ease both', animationDelay: tr.delay }}>
                      <span className={`w-[22px] h-[22px] rounded-full bg-surface2 border border-line text-sub text-[11px] ${iconChip}`}>
                        {tr.n}
                      </span>
                      <div>
                        <div className="text-[12.5px] font-bold leading-[22px]">{tr.step}</div>
                        <div className="text-[12.5px] text-sub leading-[1.6] mt-px">{tr.detail}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex gap-2.5 mt-[18px] items-center">
              <button
                onClick={vals.onApprove}
                className="sa-hover-bright cursor-pointer text-sm font-bold px-[26px] py-[11px] rounded-md border-none bg-green text-white"
              >
                Approve
              </button>
              <button
                onClick={vals.onRejectToggle}
                className="sa-hover-redsoft cursor-pointer text-sm font-bold px-[26px] py-[11px] rounded-md border-[1.5px] border-red bg-transparent text-red"
              >
                Reject
              </button>
            </div>
            {vals.rejecting && (
              <div className="flex gap-2.5 mt-3" style={{ animation: 'fadeUp .2s ease' }}>
                <Input
                  value={vals.rejectReason}
                  onChange={vals.onRejectInput}
                  placeholder="Rejection reason (required)"
                  className="flex-1 max-w-[480px]"
                  style={{ fontSize: 13.5 }}
                />
                <button
                  onClick={vals.onRejectConfirm}
                  className="cursor-pointer text-[13.5px] font-bold px-[18px] rounded-md border-none bg-red text-white"
                >
                  Confirm rejection
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="grid place-items-center h-full text-sub text-[13.5px]">
            Select a request from the left
          </div>
        )}
      </div>
    </div>
  );
}

interface SkillDraft {
  key: string;
  glyph: string;
  name: string;
  desc: string;
  enabled: boolean;
}

const EMPTY_DRAFT: SkillDraft = { key: '', glyph: '', name: '', desc: '', enabled: true };

// Mirrors the backend's key pattern so bad input is caught before the request.
const KEY_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;

export function SkillsScreen({ vals }: { vals: any }) {
  // `editing` is the key being edited, or '' for a new skill, or null when the
  // dialog is closed.
  const [editing, setEditing] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState<SkillDraft>(EMPTY_DRAFT);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const isNew = editing === '';

  const openNew = () => {
    setDraft(EMPTY_DRAFT);
    setError(null);
    setEditing('');
  };
  const openEdit = (sk: any) => {
    setDraft({ key: sk.key, glyph: sk.glyph, name: sk.name, desc: sk.desc, enabled: sk.enabled });
    setError(null);
    setEditing(sk.key);
  };
  const close = () => {
    setEditing(null);
    setError(null);
  };

  const set = (patch: Partial<SkillDraft>) => setDraft((d) => ({ ...d, ...patch }));

  function validate(): string | null {
    if (isNew) {
      if (!draft.key.trim()) return 'A key is required.';
      if (!KEY_PATTERN.test(draft.key)) {
        return 'Key must be lowercase letters, digits, hyphen or underscore, starting with a letter or digit.';
      }
      if (vals.existingSkillKeys.includes(draft.key)) return `A skill with key "${draft.key}" already exists.`;
    }
    if (!draft.glyph.trim()) return 'A badge is required.';
    if (draft.glyph.length > 4) return 'Badge must be 4 characters or fewer.';
    if (!draft.name.trim()) return 'A name is required.';
    if (!draft.desc.trim()) return 'A description is required.';
    return null;
  }

  async function save() {
    const invalid = validate();
    if (invalid) {
      setError(invalid);
      return;
    }
    setSaving(true);
    const failure = isNew
      ? await vals.skillCreate({ ...draft, key: draft.key.trim() })
      : await vals.skillUpdate(draft.key, {
          glyph: draft.glyph,
          name: draft.name,
          desc: draft.desc,
          enabled: draft.enabled,
        });
    setSaving(false);
    if (failure) setError(failure);
    else close();
  }

  return (
    <div className="max-w-[960px] mx-auto pt-[26px] px-7 pb-12">
      <div className="flex items-center gap-3 mb-3">
        <span className="text-xs font-bold tracking-[0.08em] text-sub">AGENT SKILLS</span>
        <div className="flex-1" />
        <button
          onClick={openNew}
          className="sa-hover-accent-text cursor-pointer border border-dashed border-line bg-transparent text-accent text-xs font-bold px-3 py-1.5 rounded-md"
        >
          ＋ New skill
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {vals.skillCards.map((sk: any) => (
          <div
            key={sk.key}
            className="bg-surface border border-line rounded-lg px-[18px] py-4 flex gap-3.5 items-start"
            style={{ opacity: sk.opacity }}
          >
            <div className={`w-[34px] h-[34px] rounded-md bg-accent-soft text-accent text-[15px] ${iconChip}`}>
              {sk.glyph}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm">{sk.name}</span>
                <button
                  onClick={() => openEdit(sk)}
                  aria-label={`Edit ${sk.name}`}
                  title="Edit skill"
                  className="sa-hover-surface2 cursor-pointer border-none bg-transparent text-sub text-xs w-[22px] h-[22px] rounded-md flex-none"
                >
                  ✎
                </button>
              </div>
              <div className="text-[12.5px] text-sub leading-[1.6] mt-1">{sk.desc}</div>
            </div>
            <Switch checked={sk.on} onChange={sk.toggle} />
          </div>
        ))}
      </div>

      <Modal
        open={editing !== null}
        title={isNew ? 'New skill' : `Edit ${draft.name || draft.key}`}
        onCancel={close}
        onOk={save}
        okText={isNew ? 'Create' : 'Save'}
        confirmLoading={saving}
        destroyOnHidden
        getContainer={false}
        width={520}
      >
        <div className="flex flex-col gap-3 pt-2">
          <label className="flex flex-col gap-1">
            <span className="text-[12px] text-sub">
              Key {isNew ? '' : '(immutable — flow nodes are bound to it)'}
            </span>
            <Input
              value={draft.key}
              onChange={(e) => set({ key: e.target.value })}
              disabled={!isNew}
              placeholder="duplicate-check"
              aria-label="Skill key"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[12px] text-sub">Badge</span>
            <Input
              value={draft.glyph}
              onChange={(e) => set({ glyph: e.target.value })}
              maxLength={4}
              placeholder="DC"
              aria-label="Skill badge"
              className="w-24"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[12px] text-sub">Name</span>
            <Input
              value={draft.name}
              onChange={(e) => set({ name: e.target.value })}
              placeholder="Duplicate Detection"
              aria-label="Skill name"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[12px] text-sub">Description</span>
            <Input.TextArea
              value={draft.desc}
              onChange={(e) => set({ desc: e.target.value })}
              rows={3}
              placeholder="What this skill does, in one or two sentences."
              aria-label="Skill description"
            />
          </label>

          <label className="flex items-center gap-2">
            <Switch checked={draft.enabled} onChange={(v) => set({ enabled: v })} />
            <span className="text-[12.5px]">{draft.enabled ? 'Enabled' : 'Disabled'}</span>
          </label>

          {error && <Alert type="error" showIcon message={error} />}
        </div>
      </Modal>
    </div>
  );
}

export function RoutingScreen({ vals }: { vals: any }) {
  return (
    <div className="max-w-[1240px] mx-auto pt-[22px] px-7 pb-12">
      <div className="flex items-center gap-3 mb-3.5 flex-wrap">
        <div className="flex gap-1 bg-surface2 border border-line rounded-md p-[3px]">
          {vals.routeTabs.map((rt: any, i: number) => (
            <button
              key={i}
              onClick={rt.pick}
              className="whitespace-nowrap flex-none border-none cursor-pointer px-3.5 py-[7px] rounded-lg text-[12.5px] transition-colors duration-150"
              style={{ fontWeight: rt.fw, background: rt.bg, color: rt.fg }}
            >
              {rt.label}
            </button>
          ))}
          <button
            onClick={vals.routeAddFlow}
            title="Add flow"
            className="sa-hover-accent-text whitespace-nowrap flex-none border border-dashed border-line cursor-pointer px-3 py-1.5 rounded-lg text-[13px] font-bold bg-transparent text-sub"
          >
            ＋
          </button>
        </div>
        {vals.routeRenaming && (
          <div className="flex items-center gap-1.5">
            <Input
              value={vals.routeNameDraft}
              onChange={vals.routeNameInput}
              onKeyDown={vals.routeNameKey}
              className="text-[12.5px] w-40"
            />
            <button
              onClick={vals.routeRenameCommit}
              className="cursor-pointer border-none bg-accent text-on-accent text-xs font-bold px-3 py-[7px] rounded-lg"
            >
              OK
            </button>
          </div>
        )}
        {vals.routeNotRenaming && (
          <button
            onClick={vals.routeRenameStart}
            title="Rename flow"
            className="sa-hover-surface2 cursor-pointer border-none bg-transparent text-sub text-[13px] w-[26px] h-[26px] rounded-md flex-none"
          >
            ✎
          </button>
        )}
        <span className="text-xs text-sub">{vals.routeMeta}</span>
        {vals.routeRemovedChips.map((rc: any, i: number) => (
          <button
            key={i}
            onClick={rc.restore}
            title="Restore node"
            className="sa-hover-accent-text whitespace-nowrap flex-none cursor-pointer border border-dashed border-line bg-transparent text-sub text-[11.5px] px-2.5 py-1 rounded-full"
          >
            ↺ {rc.label}
          </button>
        ))}
        <div className="flex-1" />
        <span className="text-xs font-bold" style={{ color: vals.routeStateFg }}>
          {vals.routeStateLabel}
        </span>
        <Switch checked={vals.routeOn} onChange={vals.routeToggle} />
      </div>

      <div className="relative border border-line rounded-lg overflow-hidden bg-surface2">
        <div
          onClick={vals.routeCanvasClick}
          className="overflow-auto max-h-[560px] transition-opacity duration-200"
          style={{ opacity: vals.routeCanvasOpacity }}
        >
          <div
            className="relative"
            style={{
              width: vals.flowCanvasW,
              height: vals.flowCanvasH,
              transform: `scale(${vals.routeZoom})`,
              transformOrigin: '0 0',
              backgroundImage: 'radial-gradient(circle, var(--line) 1.1px, transparent 1.1px)',
              backgroundSize: '18px 18px',
            }}
          >
            <svg
              width={vals.flowCanvasW}
              height={vals.flowCanvasH}
              className="absolute inset-0 pointer-events-none"
            >
              {vals.flowEdges.map((fe: any) => (
                <g key={fe.id}>
                  <path d={fe.d} style={{ fill: 'none', stroke: fe.stroke, strokeWidth: fe.w }} />
                  <path
                    d={fe.d}
                    onClick={fe.pick}
                    className="cursor-pointer"
                    style={{ fill: 'none', stroke: 'transparent', strokeWidth: 14, pointerEvents: 'stroke' }}
                  />
                </g>
              ))}
            </svg>
            {vals.flowEdgeLabels.map((fl: any, i: number) => (
              <div
                key={i}
                className="absolute text-[10.5px] font-bold px-[9px] py-0.5 rounded-full border"
                style={{ left: fl.x, top: fl.y, background: fl.bg, color: fl.fg, borderColor: fl.fg }}
              >
                {fl.text}
              </div>
            ))}
            {vals.flowNodes.map((fn: any) => (
              <div
                key={fn.id}
                onClick={fn.pick}
                className="sa-hover-accent absolute w-[190px] box-border bg-surface rounded-[11px] cursor-pointer border-[1.5px] shadow-[0_2px_8px_rgba(0,0,0,.06)]"
                style={{ left: fn.x, top: fn.y, height: fn.h, borderColor: fn.border }}
              >
                <div className="flex items-center gap-2.5 px-3" style={{ height: fn.headH }}>
                  <div
                    className={`w-[30px] h-[30px] rounded-lg text-[13px] ${iconChip}`}
                    style={{ background: fn.iconBg, color: fn.iconFg }}
                  >
                    {fn.glyph}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[13px] font-bold leading-[1.25] whitespace-nowrap overflow-hidden text-ellipsis">{fn.title}</div>
                    <div className="text-[10.5px] text-sub leading-[1.3] mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis">{fn.sub}</div>
                  </div>
                </div>
                {fn.isSwitch && (
                  <div className="border-t border-line pt-0.5">
                    {fn.rows.map((fr: any, i: number) => (
                      <div key={i} className="flex items-center gap-1.5 h-[26px] px-3 text-[11px]">
                        <span className="w-[7px] h-[7px] rounded-full flex-none" style={{ background: fr.dot }} />
                        <span className="font-bold">{fr.label}</span>
                        <span className="ml-auto text-sub text-[10.5px]">{fr.to}</span>
                      </div>
                    ))}
                  </div>
                )}
                {fn.ports.map((fp: any, i: number) => (
                  <span
                    key={i}
                    className="absolute w-[9px] h-[9px] rounded-full bg-surface border-2"
                    style={{ top: fp.top, left: fp.left, right: fp.right, borderColor: fp.color }}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="absolute left-3.5 bottom-3.5 flex items-center gap-1 bg-surface border border-line rounded-md p-[3px] shadow-[0_2px_8px_rgba(0,0,0,.08)]">
          <button
            onClick={vals.routeZoomOut}
            title="Zoom out"
            className="sa-hover-surface2 cursor-pointer border-none bg-transparent text-sm font-bold text-ink w-[26px] h-6 rounded-md"
          >
            −
          </button>
          <span className="text-[11px] text-sub min-w-[38px] text-center">{vals.routeZoomPct}</span>
          <span className="w-px h-4 bg-line mx-0.5" />
          <button
            onClick={vals.routeAddNode}
            title="Add node"
            className="sa-hover-accent-soft cursor-pointer border-none bg-transparent text-[11.5px] font-bold text-accent h-6 px-2 rounded-md whitespace-nowrap"
          >
            ＋ Node
          </button>
          <button
            onClick={vals.routeZoomIn}
            title="Zoom in"
            className="sa-hover-surface2 cursor-pointer border-none bg-transparent text-sm font-bold text-ink w-[26px] h-6 rounded-md"
          >
            ＋
          </button>
        </div>

        {vals.routePanelOpen && <RoutePanel vals={vals} />}
      </div>
      <div className="mt-3.5 text-[12.5px] text-sub leading-[1.7]">
        Risk levels are determined by the Agent from document impact scope, change magnitude, and history; click a node to
        view that stage&rsquo;s settings. When risk is Low and the &ldquo;Low-risk auto-approve&rdquo; skill is on, the
        request skips manual approval and is audited afterward by the approval lead.
      </div>
    </div>
  );
}

function RoutePanel({ vals }: { vals: any }) {
  return (
    <div
      className="absolute w-[272px] bg-surface border border-line rounded-lg shadow-[0_6px_16px_0_rgba(0,0,0,0.08),0_3px_6px_-4px_rgba(0,0,0,0.12),0_9px_28px_8px_rgba(0,0,0,0.05)]"
      style={{ top: vals.routePanelTop, left: vals.routePanelLeft, animation: 'fadeUp .18s ease' }}
    >
      <div className="flex items-center gap-2 px-3.5 py-3 border-b border-line">
        <div className="min-w-0 flex-1">
          <div className="text-[13.5px] font-bold">{vals.routePanelTitle}</div>
          <div className="text-[11px] text-sub mt-0.5">{vals.routePanelKind}</div>
        </div>
        <button
          onClick={vals.routePanelClose}
          title="Close"
          className="sa-hover-surface2 cursor-pointer border-none bg-transparent text-sub text-[15px] w-6 h-6 rounded-md flex-none"
        >
          ×
        </button>
      </div>
      <div className="px-3.5 pt-2.5 pb-[13px] flex flex-col gap-2">
        {vals.routePanelRows.map((pr: any, i: number) => {
          if (pr.isText)
            return (
              <div key={i} className="flex gap-2.5 text-xs leading-normal">
                <span className="flex-none w-16 text-sub">{pr.k}</span>
                <span className="min-w-0 font-medium" style={{ color: pr.fg }}>
                  {pr.v}
                </span>
              </div>
            );
          if (pr.isInput)
            return (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="flex-none w-16 text-sub">{pr.k}</span>
                <Input
                  value={pr.value}
                  onChange={pr.change}
                  spellCheck={false}
                  size="small"
                  className="flex-1 min-w-0"
                  style={{ fontSize: 12 }}
                />
              </div>
            );
          if (pr.isSel)
            return (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="flex-none w-16 text-sub">{pr.k}</span>
                <Select
                  value={pr.value}
                  onChange={(v) => pr.change({ target: { value: v } })}
                  size="small"
                  className="flex-1 min-w-0"
                  options={pr.options.map((op: any) => ({ value: op.v, label: op.label }))}
                />
                {pr.canRemove && (
                  <button
                    onClick={pr.remove}
                    title="Remove this stage"
                    className="sa-hover-red-cell cursor-pointer border-none bg-transparent text-sub text-[13px] w-[22px] h-[22px] rounded-md flex-none"
                  >
                    ✕
                  </button>
                )}
              </div>
            );
          if (pr.isBtn)
            return (
              <button
                key={i}
                onClick={pr.click}
                className="sa-hover-accent-text cursor-pointer border border-dashed border-line bg-transparent text-xs font-semibold px-2.5 py-1.5 rounded-lg text-center"
                style={{ color: pr.fg2 }}
              >
                {pr.label}
              </button>
            );
          if (pr.isToggle)
            return (
              <div key={i} className="flex items-center gap-2 text-xs py-0.5">
                <span className="flex-none w-16 text-sub">{pr.k}</span>
                <span className="flex-1 min-w-0 font-medium" style={{ color: pr.fg }}>
                  {pr.v}
                </span>
                <Switch checked={pr.checked} size="small" onChange={pr.toggle} />
              </div>
            );
          return null;
        })}
      </div>
    </div>
  );
}
