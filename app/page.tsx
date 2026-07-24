'use client';

import React, { useState } from 'react';
import { ConfigProvider, Segmented, Switch, theme } from 'antd';
import SignAgentCore from '@/components/signagent/SignAgentCore';
import { DEFAULT_THEME, DARK_THEME, type Direction } from '@/components/signagent/data';

export default function Page() {
  const [direction, setDirection] = useState<Direction>('Ant Light');
  const [lowRiskAuto, setLowRiskAuto] = useState(true);
  const [showRisk, setShowRisk] = useState(true);

  const dark = direction === 'Ant Dark';
  const tv = dark ? DARK_THEME : DEFAULT_THEME;

  return (
    <ConfigProvider
      theme={{
        algorithm: dark ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: {
          colorPrimary: tv['--accent'],
          colorSuccess: tv['--green'],
          colorError: tv['--red'],
          colorWarning: tv['--amber'],
          fontFamily:
            "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,'Noto Sans TC','Noto Sans',sans-serif",
        },
        components: {
          // Approval Status table, themed via documented component tokens rather
          // than `.ant-*` CSS overrides. Values are the design's CSS variables, so
          // the table re-themes automatically between Ant Light and Ant Dark.
          Table: {
            colorBgContainer: 'var(--surface)',
            headerBg: 'var(--surface2)',
            headerColor: 'var(--sub)',
            headerSplitColor: 'transparent',
            borderColor: 'var(--line)',
            rowHoverBg: 'var(--surface2)',
            cellFontSize: 13,
            cellPaddingBlock: 13,
            cellPaddingInline: 18,
          },
        },
      }}
    >
      <ControlBar
        direction={direction}
        setDirection={setDirection}
        lowRiskAuto={lowRiskAuto}
        setLowRiskAuto={setLowRiskAuto}
        showRisk={showRisk}
        setShowRisk={setShowRisk}
      />
      <SignAgentCore direction={direction} lowRiskAuto={lowRiskAuto} showRisk={showRisk} />
    </ConfigProvider>
  );
}

function ControlBar({
  direction,
  setDirection,
  lowRiskAuto,
  setLowRiskAuto,
  showRisk,
  setShowRisk,
}: {
  direction: Direction;
  setDirection: (d: Direction) => void;
  lowRiskAuto: boolean;
  setLowRiskAuto: (b: boolean) => void;
  showRisk: boolean;
  setShowRisk: (b: boolean) => void;
}) {
  const dark = direction === 'Ant Dark';
  return (
    <div
      className="fixed right-4 bottom-4 z-[1000] flex items-center gap-4 rounded-[10px] px-3.5 py-2.5 backdrop-blur-md"
      style={{
        background: dark ? 'rgba(30,30,30,0.92)' : 'rgba(255,255,255,0.92)',
        border: `1px solid ${dark ? '#303030' : '#f0f0f0'}`,
        boxShadow: '0 6px 18px rgba(0,0,0,0.16)',
      }}
    >
      <Segmented
        size="small"
        value={direction}
        onChange={(v) => setDirection(v as Direction)}
        options={['Ant Light', 'Ant Dark']}
      />
      <label className="flex items-center gap-1.5 text-xs" style={{ color: dark ? '#fff' : '#000' }}>
        <Switch size="small" checked={lowRiskAuto} onChange={setLowRiskAuto} />
        Low-risk auto
      </label>
      <label className="flex items-center gap-1.5 text-xs" style={{ color: dark ? '#fff' : '#000' }}>
        <Switch size="small" checked={showRisk} onChange={setShowRisk} />
        Show risk
      </label>
    </div>
  );
}
