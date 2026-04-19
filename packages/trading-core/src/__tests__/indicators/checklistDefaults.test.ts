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

  it('all entries are disabled by default (opt-in)', () => {
    for (const entry of DEFAULT_CHECKLIST_TEMPLATE) {
      expect(entry.enabled).toBe(false);
    }
  });

  it('orders are unique', () => {
    const orders = DEFAULT_CHECKLIST_TEMPLATE.map((e) => e.order);
    expect(new Set(orders).size).toBe(orders.length);
  });

  it('covers EMA 200, EMA 21, RSI 14, and Volume seeds', () => {
    const seedLabels = DEFAULT_CHECKLIST_TEMPLATE.map((e) => e.seedLabel);
    expect(seedLabels).toContain('EMA 200');
    expect(seedLabels).toContain('EMA 21');
    expect(seedLabels).toContain('RSI 14');
    expect(seedLabels).toContain('Volume');
  });

  it('pairs LONG and SHORT entries for direction-aware ops', () => {
    const longEntries = DEFAULT_CHECKLIST_TEMPLATE.filter((e) => e.side === 'LONG');
    const shortEntries = DEFAULT_CHECKLIST_TEMPLATE.filter((e) => e.side === 'SHORT');
    expect(longEntries.length).toBe(shortEntries.length);
  });
});
