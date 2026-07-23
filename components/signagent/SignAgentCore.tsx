'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_THEME, DARK_THEME, NEW_CASE, FEED_STEPS } from './data';
import { INITIAL_STATE, type State, type SignAgentProps } from './types';
import { buildVals } from './viewModel';
import { TopBar, DashboardScreen, ApproverScreen, SkillsScreen, RoutingScreen } from './screens';

export default function SignAgentCore(props: SignAgentProps) {
  const direction = props.direction ?? 'Ant Light';
  const lowRiskAuto = props.lowRiskAuto ?? true;
  const showRisk = props.showRisk ?? true;

  const [state, setStateRaw] = useState<State>(INITIAL_STATE);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const feedStarted = useRef(false);

  const setState = useCallback(
    (patch: Partial<State> | ((prev: State) => Partial<State>)) => {
      setStateRaw((prev) => ({ ...prev, ...(typeof patch === 'function' ? patch(prev) : patch) }));
    },
    [],
  );

  // ── Live agent-activity feed simulation (componentDidMount → startFeed) ──
  useEffect(() => {
    if (feedStarted.current) return;
    feedStarted.current = true;
    const now = () => {
      const d = new Date();
      return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    };
    const run = (i: number) => {
      if (i >= FEED_STEPS.length) {
        setState({ feedWorking: null });
        return;
      }
      const st = FEED_STEPS[i];
      setState({ feedWorking: st.working });
      timers.current.push(
        setTimeout(() => {
          setState((prev) => ({
            feed: [{ icon: st.icon, chip: st.chip, text: st.text, sub: st.sub, time: now() }, ...prev.feed],
            cases: st.addCase ? [NEW_CASE, ...prev.cases] : prev.cases,
          }));
          run(i + 1);
        }, st.wait),
      );
    };
    run(0);
    return () => {
      timers.current.forEach(clearTimeout);
    };
  }, [setState]);

  // ── Theme CSS variables applied to the root element ──
  const themeVars = direction === 'Ant Dark' ? DARK_THEME : DEFAULT_THEME;

  const vals = useMemo(
    () => buildVals(state, setState, { lowRiskAuto, showRisk }),
    [state, setState, lowRiskAuto, showRisk],
  );

  return (
    <div
      className="sa-root min-h-screen bg-bg text-ink text-sm font-sans"
      style={themeVars as React.CSSProperties}
    >
      <TopBar vals={vals} />
      {vals.isDash && <DashboardScreen vals={vals} />}
      {vals.isApprover && <ApproverScreen vals={vals} />}
      {vals.isAdmin && <SkillsScreen vals={vals} />}
      {vals.isRoutes && <RoutingScreen vals={vals} />}
    </div>
  );
}
