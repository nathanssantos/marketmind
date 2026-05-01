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

  it('covers RSI 2, RSI 14, and Stoch 14 across the full 1m..1d ladder', () => {
    const seedLabels = DEFAULT_CHECKLIST_TEMPLATE.map((e) => e.seedLabel);
    expect(seedLabels).toContain('RSI 2');
    expect(seedLabels).toContain('RSI 14');
    expect(seedLabels).toContain('Stoch 14');

    const timeframes = new Set(DEFAULT_CHECKLIST_TEMPLATE.map((e) => e.timeframe));
    expect(timeframes).toEqual(new Set(['1m', '5m', '15m', '1h', '4h', '1d']));

    for (const seedLabel of ['RSI 14', 'RSI 2', 'Stoch 14']) {
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

  it('weights scale strictly monotonically, +0.5 per TF step, with 1m as the floor', () => {
    for (const seedLabel of ['RSI 14', 'RSI 2', 'Stoch 14']) {
      const entries = DEFAULT_CHECKLIST_TEMPLATE.filter((e) => e.seedLabel === seedLabel && e.side === 'LONG');
      const tfOrder: Record<string, number> = { '1m': 0, '5m': 1, '15m': 2, '1h': 3, '4h': 4, '1d': 5 };
      const sorted = [...entries].sort((a, b) => tfOrder[a.timeframe]! - tfOrder[b.timeframe]!);
      for (let i = 1; i < sorted.length; i += 1) {
        expect(sorted[i]!.weight).toBeCloseTo(sorted[i - 1]!.weight + 0.5, 5);
      }
      const w = (tf: string) => entries.find((e) => e.timeframe === tf)!.weight;
      // 1m is the floor at the indicator's base weight.
      const expectedBase = seedLabel === 'RSI 2' ? 2.0 : 1.0;
      expect(w('1m')).toBe(expectedBase);
    }
    // RSI 2 premium-weighted over RSI 14 at every timeframe
    for (const tf of ['1m', '5m', '15m', '1h', '4h', '1d']) {
      const rsi14 = DEFAULT_CHECKLIST_TEMPLATE.find((e) => e.seedLabel === 'RSI 14' && e.timeframe === tf && e.side === 'LONG')!.weight;
      const rsi2 = DEFAULT_CHECKLIST_TEMPLATE.find((e) => e.seedLabel === 'RSI 2' && e.timeframe === tf && e.side === 'LONG')!.weight;
      expect(rsi2).toBeGreaterThan(rsi14);
    }
  });

  it('contains 36 entries (3 indicators × 6 timeframes × 2 sides)', () => {
    expect(DEFAULT_CHECKLIST_TEMPLATE).toHaveLength(36);
  });

  it('RSI 2 ships tight thresholds (7 oversold / 93 overbought) — RSI 14 and Stoch 14 use evaluator defaults', () => {
    for (const entry of DEFAULT_CHECKLIST_TEMPLATE) {
      if (entry.seedLabel === 'RSI 2') {
        expect(entry.threshold).toBe(entry.op === 'oversold' ? 7 : 93);
      } else {
        expect(entry.threshold).toBeUndefined();
      }
    }
  });

  it('orders are logically grouped: RSI 14 block → RSI 2 block → Stoch 14 block, TFs ascending within each', () => {
    const sorted = [...DEFAULT_CHECKLIST_TEMPLATE].sort((a, b) => a.order - b.order);
    const blocks = sorted.reduce<string[]>((acc, e) => {
      if (acc[acc.length - 1] !== e.seedLabel) acc.push(e.seedLabel);
      return acc;
    }, []);
    expect(blocks).toEqual(['RSI 14', 'RSI 2', 'Stoch 14']);

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
