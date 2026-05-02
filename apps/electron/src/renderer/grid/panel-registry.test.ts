import { describe, expect, it } from 'vitest';
import { PANEL_GROUP_ORDER, PANEL_REGISTRY, getPanelDef, groupedPanelDefs } from './panel-registry';

describe('panel-registry', () => {
  it('registers exactly one chart kind with multi cardinality', () => {
    const charts = Object.values(PANEL_REGISTRY).filter((d) => d.cardinality === 'multi');
    expect(charts).toHaveLength(1);
    expect(charts[0]?.kind).toBe('chart');
    expect(charts[0]?.shellMode).toBe('chart');
  });

  it('every non-chart panel is single-instance with bare shell', () => {
    const others = Object.values(PANEL_REGISTRY).filter((d) => d.kind !== 'chart');
    for (const def of others) {
      expect(def.cardinality).toBe('single');
      expect(def.shellMode).toBe('bare');
    }
  });

  it('every panel def has a non-empty title key', () => {
    for (const def of Object.values(PANEL_REGISTRY)) {
      expect(def.titleKey.length).toBeGreaterThan(0);
      expect(def.titleKey.startsWith('panels.')).toBe(true);
    }
  });

  it('default layout sizes are positive', () => {
    for (const def of Object.values(PANEL_REGISTRY)) {
      expect(def.defaultLayout.w).toBeGreaterThan(0);
      expect(def.defaultLayout.h).toBeGreaterThan(0);
    }
  });

  it('getPanelDef throws for unknown kind', () => {
    // @ts-expect-error — testing runtime behavior with bad input
    expect(() => getPanelDef('not-a-kind')).toThrow(/Unknown panel kind/);
  });

  it('groupedPanelDefs returns groups in PANEL_GROUP_ORDER order', () => {
    const groups = groupedPanelDefs().map((g) => g.group);
    expect(groups).toEqual(PANEL_GROUP_ORDER);
  });

  it('groupedPanelDefs covers every registered panel exactly once', () => {
    const allDefs = groupedPanelDefs().flatMap((g) => g.defs);
    expect(allDefs).toHaveLength(Object.keys(PANEL_REGISTRY).length);
    const kinds = new Set(allDefs.map((d) => d.kind));
    expect(kinds.size).toBe(allDefs.length);
  });
});
