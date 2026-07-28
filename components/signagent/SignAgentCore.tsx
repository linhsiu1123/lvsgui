'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { DEFAULT_THEME, DARK_THEME } from './data';
import { INITIAL_STATE, type State, type SignAgentProps } from './types';
import { buildVals, pendingForMe } from './viewModel';
import { useSignAgentData } from './useSignAgentData';
import {
  TopBar,
  DashboardScreen,
  ApproverScreen,
  SkillsScreen,
  RoutingScreen,
  LoadingScreen,
  ErrorScreen,
  ActionErrorBanner,
} from './screens';

export default function SignAgentCore(props: SignAgentProps) {
  const direction = props.direction ?? 'Ant Light';
  const lowRiskAuto = props.lowRiskAuto ?? true;
  const showRisk = props.showRisk ?? true;

  const [state, setStateRaw] = useState<State>(INITIAL_STATE);
  const { server, status, error, actionError, dismissActionError, actions } = useSignAgentData();

  const setState = useCallback(
    (patch: Partial<State> | ((prev: State) => Partial<State>)) => {
      setStateRaw((prev) => ({ ...prev, ...(typeof patch === 'function' ? patch(prev) : patch) }));
    },
    [],
  );

  // Land on the first item in the approval queue rather than an empty pane.
  useEffect(() => {
    if (status !== 'ready') return;
    setStateRaw((prev) => {
      if (prev.selId) return prev;
      const first = pendingForMe(server.cases)[0];
      return first ? { ...prev, selId: first.id } : prev;
    });
  }, [status, server.cases]);

  // ── Theme CSS variables applied to the root element ──
  const themeVars = direction === 'Ant Dark' ? DARK_THEME : DEFAULT_THEME;

  const vals = useMemo(
    () => buildVals(state, setState, { lowRiskAuto, showRisk }, server, actions),
    [state, setState, lowRiskAuto, showRisk, server, actions],
  );

  return (
    <div
      className="sa-root min-h-screen bg-bg text-ink text-sm font-sans"
      style={themeVars as React.CSSProperties}
    >
      <TopBar vals={vals} />
      {actionError && <ActionErrorBanner message={actionError} onDismiss={dismissActionError} />}
      {status === 'loading' && <LoadingScreen />}
      {status === 'error' && <ErrorScreen message={error} onRetry={actions.reload} />}
      {status === 'ready' && (
        <>
          {vals.isDash && <DashboardScreen vals={vals} />}
          {vals.isApprover && <ApproverScreen vals={vals} />}
          {vals.isAdmin && <SkillsScreen vals={vals} />}
          {vals.isRoutes && <RoutingScreen vals={vals} />}
        </>
      )}
    </div>
  );
}
