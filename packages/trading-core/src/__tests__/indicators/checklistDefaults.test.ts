import { describe, expect, it } from 'vitest';
import { DEFAULT_CHECKLIST_TEMPLATE } from '../../indicators/checklistDefaults';
import { DEFAULT_USER_INDICATOR_SEEDS } from '../../indicators/defaults';
import { INDICATOR_CATALOG } from '../../indicators/catalog';

describe('DEFAULT_CHECKLIST_TEMPLATE', () => {
  it('every template entry resolves to a default seed', () => {
    const seedLabels = new Set(DEFAULT_USER_INDICATOR_SEEDS.map((s) => s.label));
    for (const entry of DEFAULT_CHECKLIST_TEMPLATE) {
      expect(seedLabels.has(entry.seedLabel), `missing seed: ${entry.seedLabel}`).toBe(true);
    }
  });

  it('every referenced seed has a valid catalog entry supporting the op', () => {
    const seedByLabel = new Map(DEFAULT_USER_INDICATOR_SEEDS.map((s) => [s.label, s]));
    for (const entry of DEFAULT_CHECKLIST_TEMPLATE) {
      const seed = seedByLabel.get(entry.seedLabel)!;
      const def = INDICATOR_CATALOG[seed.catalogType]!;
      expect(def, `no catalog entry for ${seed.catalogType}`).toBeDefined();
      expect(def.conditionOps).toContain(entry.op);
    }
  });

  it('all entries are enabled by default', () => {
    for (const entry of DEFAULT_CHECKLIST_TEMPLATE) {
      expect(entry.enabled).toBe(true);
    }
  });

  it('orders are unique', () => {
    const orders = DEFAULT_CHECKLIST_TEMPLATE.map((e) => e.order);
    expect(new Set(orders).size).toBe(orders.length);
  });

  it('mirrors autotrade default filters (ADX, trend, choppiness, VWAP)', () => {
    const seedLabels = DEFAULT_CHECKLIST_TEMPLATE.map((e) => e.seedLabel);
    expect(seedLabels).toContain('ADX 14');
    expect(seedLabels).toContain('EMA 21');
    expect(seedLabels).toContain('CHOP 14');
    expect(seedLabels).toContain('VWAP');
  });
});
