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

  it('covers RSI 2, RSI 14, and Stoch 14 across 15m/1h/4h/1d', () => {
    const seedLabels = DEFAULT_CHECKLIST_TEMPLATE.map((e) => e.seedLabel);
    expect(seedLabels).toContain('RSI 2');
    expect(seedLabels).toContain('RSI 14');
    expect(seedLabels).toContain('Stoch 14');

    const timeframes = new Set(DEFAULT_CHECKLIST_TEMPLATE.map((e) => e.timeframe));
    expect(timeframes).toEqual(new Set(['15m', '1h', '4h', '1d']));
  });

  it('pairs LONG and SHORT entries for direction-aware ops', () => {
    const longEntries = DEFAULT_CHECKLIST_TEMPLATE.filter((e) => e.side === 'LONG');
    const shortEntries = DEFAULT_CHECKLIST_TEMPLATE.filter((e) => e.side === 'SHORT');
    expect(longEntries.length).toBe(shortEntries.length);
  });

  it('weights scale with both indicator base and timeframe (1d > 4h > 1h > 15m)', () => {
    for (const seedLabel of ['RSI 14', 'RSI 2', 'Stoch 14']) {
      const byTf = (tf: string) =>
        DEFAULT_CHECKLIST_TEMPLATE.find((e) => e.seedLabel === seedLabel && e.timeframe === tf && e.side === 'LONG')!.weight;
      expect(byTf('15m')).toBeLessThan(byTf('1h'));
      expect(byTf('1h')).toBeLessThan(byTf('4h'));
      expect(byTf('4h')).toBeLessThan(byTf('1d'));
    }
    // RSI 2 premium-weighted over RSI 14 at every timeframe
    for (const tf of ['15m', '1h', '4h', '1d']) {
      const rsi14 = DEFAULT_CHECKLIST_TEMPLATE.find((e) => e.seedLabel === 'RSI 14' && e.timeframe === tf && e.side === 'LONG')!.weight;
      const rsi2 = DEFAULT_CHECKLIST_TEMPLATE.find((e) => e.seedLabel === 'RSI 2' && e.timeframe === tf && e.side === 'LONG')!.weight;
      expect(rsi2).toBeGreaterThan(rsi14);
    }
  });

  it('contains 24 entries (3 indicators × 4 timeframes × 2 sides)', () => {
    expect(DEFAULT_CHECKLIST_TEMPLATE).toHaveLength(24);
  });
});
