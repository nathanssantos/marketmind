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

  it('covers RSI 2, RSI 14, Stoch 2, and Stoch 14', () => {
    const seedLabels = DEFAULT_CHECKLIST_TEMPLATE.map((e) => e.seedLabel);
    expect(seedLabels).toContain('RSI 2');
    expect(seedLabels).toContain('RSI 14');
    expect(seedLabels).toContain('Stoch 2');
    expect(seedLabels).toContain('Stoch 14');

    const timeframes = new Set(DEFAULT_CHECKLIST_TEMPLATE.map((e) => e.timeframe));
    expect(timeframes).toEqual(new Set(['1m', '5m', '15m', '1h', '4h', '1d']));
  });

  it('RSI indicators cover only 15m..1d (1m/5m too noisy for slow oscillators)', () => {
    for (const seedLabel of ['RSI 14', 'RSI 2']) {
      const tfs = new Set(
        DEFAULT_CHECKLIST_TEMPLATE.filter((e) => e.seedLabel === seedLabel).map((e) => e.timeframe),
      );
      expect(tfs).toEqual(new Set(['15m', '1h', '4h', '1d']));
    }
  });

  it('Stoch indicators cover the full 1m..1d ladder (fast scalping signals)', () => {
    for (const seedLabel of ['Stoch 14', 'Stoch 2']) {
      const tfs = new Set(
        DEFAULT_CHECKLIST_TEMPLATE.filter((e) => e.seedLabel === seedLabel).map((e) => e.timeframe),
      );
      expect(tfs).toEqual(new Set(['1m', '5m', '15m', '1h', '4h', '1d']));
    }
  });

  it('pairs LONG and SHORT entries for direction-aware ops', () => {
    const longEntries = DEFAULT_CHECKLIST_TEMPLATE.filter((e) => e.side === 'LONG');
    const shortEntries = DEFAULT_CHECKLIST_TEMPLATE.filter((e) => e.side === 'SHORT');
    expect(longEntries.length).toBe(shortEntries.length);
  });

  it('weights scale with both indicator base and timeframe (higher TF > lower TF)', () => {
    for (const seedLabel of ['RSI 14', 'RSI 2', 'Stoch 14', 'Stoch 2']) {
      const entries = DEFAULT_CHECKLIST_TEMPLATE.filter((e) => e.seedLabel === seedLabel && e.side === 'LONG');
      const tfOrder: Record<string, number> = { '1m': 0, '5m': 1, '15m': 2, '1h': 3, '4h': 4, '1d': 5 };
      const sorted = [...entries].sort((a, b) => tfOrder[a.timeframe]! - tfOrder[b.timeframe]!);
      for (let i = 1; i < sorted.length; i += 1) {
        expect(sorted[i]!.weight).toBeGreaterThan(sorted[i - 1]!.weight);
      }
    }
    // Period-2 oscillators premium-weighted over period-14 at every shared TF.
    for (const tf of ['15m', '1h', '4h', '1d']) {
      const rsi14 = DEFAULT_CHECKLIST_TEMPLATE.find((e) => e.seedLabel === 'RSI 14' && e.timeframe === tf && e.side === 'LONG')!.weight;
      const rsi2 = DEFAULT_CHECKLIST_TEMPLATE.find((e) => e.seedLabel === 'RSI 2' && e.timeframe === tf && e.side === 'LONG')!.weight;
      expect(rsi2).toBeGreaterThan(rsi14);
    }
    for (const tf of ['1m', '5m', '15m', '1h', '4h', '1d']) {
      const stoch14 = DEFAULT_CHECKLIST_TEMPLATE.find((e) => e.seedLabel === 'Stoch 14' && e.timeframe === tf && e.side === 'LONG')!.weight;
      const stoch2 = DEFAULT_CHECKLIST_TEMPLATE.find((e) => e.seedLabel === 'Stoch 2' && e.timeframe === tf && e.side === 'LONG')!.weight;
      expect(stoch2).toBeGreaterThan(stoch14);
    }
  });

  it('contains 40 entries (RSI×4TF×2sides + RSI×4TF×2sides + Stoch×6TF×2sides + Stoch×6TF×2sides = 8+8+12+12)', () => {
    expect(DEFAULT_CHECKLIST_TEMPLATE).toHaveLength(40);
  });

  it('period-2 oscillators ship tight thresholds (7/93) — period-14 use evaluator defaults', () => {
    for (const entry of DEFAULT_CHECKLIST_TEMPLATE) {
      if (entry.seedLabel === 'RSI 2' || entry.seedLabel === 'Stoch 2') {
        expect(entry.threshold).toBe(entry.op === 'oversold' ? 7 : 93);
      } else {
        expect(entry.threshold).toBeUndefined();
      }
    }
  });

  it('orders are logically grouped: RSI 14 → RSI 2 → Stoch 14 → Stoch 2, TFs ascending within each block', () => {
    const sorted = [...DEFAULT_CHECKLIST_TEMPLATE].sort((a, b) => a.order - b.order);
    const blocks = sorted.reduce<string[]>((acc, e) => {
      if (acc[acc.length - 1] !== e.seedLabel) acc.push(e.seedLabel);
      return acc;
    }, []);
    expect(blocks).toEqual(['RSI 14', 'RSI 2', 'Stoch 14', 'Stoch 2']);

    const tfOrder: Record<string, number> = { '1m': 0, '5m': 1, '15m': 2, '1h': 3, '4h': 4, '1d': 5 };
    for (const seedLabel of blocks) {
      const block = sorted.filter((e) => e.seedLabel === seedLabel);
      for (let i = 1; i < block.length; i += 1) {
        const prev = tfOrder[block[i - 1]!.timeframe]!;
        const curr = tfOrder[block[i]!.timeframe]!;
        expect(curr).toBeGreaterThanOrEqual(prev);
      }
    }
  });
});
