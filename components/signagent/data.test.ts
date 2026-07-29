import {
  DEFAULT_THEME,
  DARK_THEME,
  THEMES,
  RISK,
  RISK_LABEL,
  PRECHECKS,
  SUGGESTIONS,
  TRACES,
  DEFAULT_CHAIN,
  NON_NODE_SKILLS,
  STATUS_DEFS,
  TYPE_DEFS,
  riskChip,
} from './data';

describe('theme tokens', () => {
  it('light and dark themes expose the same variable keys', () => {
    expect(Object.keys(DEFAULT_THEME).sort()).toEqual(Object.keys(DARK_THEME).sort());
  });

  it('THEMES maps directions to the correct palettes', () => {
    expect(THEMES['Ant Light']).toBe(DEFAULT_THEME);
    expect(THEMES['Ant Dark']).toBe(DARK_THEME);
    expect(DEFAULT_THEME['--accent']).toBe('#1677ff');
    expect(DARK_THEME['--accent']).toBe('#3c89e8');
  });
});

describe('risk + status definitions', () => {
  it('covers every risk level with soft/foreground vars', () => {
    (['Low', 'Medium', 'High'] as const).forEach((r) => {
      expect(RISK[r].bgVar).toMatch(/^var\(--/);
      expect(RISK[r].fgVar).toMatch(/^var\(--/);
    });
  });

  it('defines a status tuple per known status key', () => {
    const keys = STATUS_DEFS.map((s) => s[0]);
    expect(keys).toEqual(['pending', 'auto', 'approved', 'rejected']);
    STATUS_DEFS.forEach((s) => expect(s).toHaveLength(4));
  });
});

describe('alert-type chips', () => {
  it('leaves low risk unbadged and maps Medium/High to Warning/Error', () => {
    expect(riskChip('Low').label).toBe('');
    expect(riskChip('Medium')).toMatchObject({ label: 'Warning', fg: RISK.Medium.fgVar });
    expect(riskChip('High')).toMatchObject({ label: 'Error', fg: RISK.High.fgVar });
  });

  it('RISK_LABEL covers every level', () => {
    expect(Object.keys(RISK_LABEL).sort()).toEqual(['High', 'Low', 'Medium']);
  });
});

describe('pre-review / suggestion / trace maps', () => {
  // These stay client-side: the backend does not model the agent's per-document
  // analysis, so the console renders canned reports for the demo documents.
  it('provides a default and a QC-2605-specific override for each', () => {
    expect(PRECHECKS.default.length).toBeGreaterThan(0);
    expect(PRECHECKS['QC-2605'].some((c) => !c.ok)).toBe(true);
    expect(SUGGESTIONS.default.ok).toBe(true);
    expect(SUGGESTIONS['QC-2605'].ok).toBe(false);
    expect(TRACES.default).toHaveLength(4);
    expect(TRACES['QC-2605']).toHaveLength(4);
  });
});

describe('skills + types', () => {
  it('withholds only the queue-wide built-in from flow-node binding', () => {
    // The catalogue itself now comes from the backend; this list is the single
    // rule the canvas applies on top of it.
    expect(NON_NODE_SKILLS).toEqual(['anomaly']);
  });

  it('exposes the three product types and their pipelines', () => {
    expect(TYPE_DEFS.map((t) => t.name)).toEqual([
      'Rule Deck Change',
      'LVS Verification Report',
      'Waiver Request',
    ]);
    expect(TYPE_DEFS.map((t) => t.label)).toEqual(['Pipeline1', 'Pipeline2', 'Pipeline3']);
  });

  it('a new pipeline starts with three nodes', () => {
    expect(DEFAULT_CHAIN).toEqual(['node1', 'node2', 'node3']);
  });
});
