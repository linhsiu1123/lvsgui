import {
  DEFAULT_THEME,
  DARK_THEME,
  THEMES,
  RISK,
  PRECHECKS,
  SUGGESTIONS,
  TRACES,
  NEW_CASE,
  FEED_STEPS,
  INITIAL_CASES,
  INITIAL_ROUTE_DEFS,
  APPROVER_TITLES,
  APPROVER_PERSONS,
  SKILL_DEFS,
  SKILL_NAMES,
  NODE_SKILL_NAMES,
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

describe('case + feed fixtures', () => {
  it('ships six initial cases with unique ids', () => {
    const ids = INITIAL_CASES.map((c) => c.id);
    expect(ids).toHaveLength(6);
    expect(new Set(ids).size).toBe(6);
  });

  it('NEW_CASE is a low-risk auto-approved report', () => {
    expect(NEW_CASE.id).toBe('QC-2608');
    expect(NEW_CASE.risk).toBe('Low');
    expect(NEW_CASE.status).toBe('auto');
  });

  it('the feed pipeline adds exactly one case at the end', () => {
    expect(FEED_STEPS).toHaveLength(5);
    expect(FEED_STEPS.filter((s) => s.addCase)).toHaveLength(1);
    expect(FEED_STEPS[FEED_STEPS.length - 1].addCase).toBe(true);
  });
});

describe('pre-review / suggestion / trace maps', () => {
  it('provides a default and a QC-2605-specific override for each', () => {
    expect(PRECHECKS.default.length).toBeGreaterThan(0);
    expect(PRECHECKS['QC-2605'].some((c) => !c.ok)).toBe(true);
    expect(SUGGESTIONS.default.ok).toBe(true);
    expect(SUGGESTIONS['QC-2605'].ok).toBe(false);
    expect(TRACES.default).toHaveLength(4);
    expect(TRACES['QC-2605']).toHaveLength(4);
  });
});

describe('routing definitions', () => {
  it('is keyed by pipeline, one per product type', () => {
    expect(Object.keys(INITIAL_ROUTE_DEFS)).toEqual(TYPE_DEFS.map((t) => t.label));
  });

  it('defines mid/high approval chains per pipeline', () => {
    Object.values(INITIAL_ROUTE_DEFS).forEach((def) => {
      expect(def.mid.length).toBeGreaterThan(0);
      expect(def.high.length).toBeGreaterThanOrEqual(def.mid.length);
    });
  });

  it('every chain key resolves to a title and a person', () => {
    const keys = new Set<string>();
    Object.values(INITIAL_ROUTE_DEFS).forEach((d) => [...d.mid, ...d.high].forEach((k) => keys.add(k)));
    keys.forEach((k) => {
      expect(APPROVER_TITLES[k]).toBeTruthy();
      expect(APPROVER_PERSONS[k]).toBeTruthy();
    });
  });
});

describe('skills + types', () => {
  it('skill defs align with the skill-name lookup', () => {
    SKILL_DEFS.forEach((d) => expect(SKILL_NAMES[d.key]).toBe(d.name));
  });

  it('offers every skill but Anomaly Detection to flow nodes', () => {
    expect(Object.keys(NODE_SKILL_NAMES)).toEqual(['route', 'precheck', 'auto']);
    Object.entries(NODE_SKILL_NAMES).forEach(([k, name]) => expect(SKILL_NAMES[k]).toBe(name));
  });

  it('exposes the three product types and their pipelines', () => {
    expect(TYPE_DEFS.map((t) => t.name)).toEqual([
      'Rule Deck Change',
      'LVS Verification Report',
      'Waiver Request',
    ]);
    expect(TYPE_DEFS.map((t) => t.label)).toEqual(['Pipeline1', 'Pipeline2', 'Pipeline3']);
  });
});

describe('alert-type chips', () => {
  it('leaves low risk unbadged and maps Medium/High to Warning/Error', () => {
    expect(riskChip('Low').label).toBe('');
    expect(riskChip('Medium')).toMatchObject({ label: 'Warning', fg: RISK.Medium.fgVar });
    expect(riskChip('High')).toMatchObject({ label: 'Error', fg: RISK.High.fgVar });
  });
});
