import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFLUENCE_TEMPLATE } from '../../indicators/confluenceDefaults';
import { DEFAULT_USER_INDICATOR_SEEDS } from '../../indicators/defaults';
import { INDICATOR_CATALOG } from '../../indicators/catalog';

describe('DEFAULT_CONFLUENCE_TEMPLATE', () => {
  it('every template entry resolves to a default seed', () => {
    const seedLabels = new Set(DEFAULT_USER_INDICATOR_SEEDS.map((s) => s.label));
    for (const entry of DEFAULT_CONFLUENCE_TEMPLATE) {
      expect(seedLabels.has(entry.seedLabel), `missing seed: ${entry.seedLabel}`).toBe(true);
    }
  });

  it('every referenced seed has a valid catalog entry supporting the op', () => {
    const seedByLabel = new Map(DEFAULT_USER_INDICATOR_SEEDS.map((s) => [s.label, s]));
    for (const entry of DEFAULT_CONFLUENCE_TEMPLATE) {
      const seed = seedByLabel.get(entry.seedLabel)!;
      const def = INDICATOR_CATALOG[seed.catalogType]!;
      expect(def, `no catalog entry for ${seed.catalogType}`).toBeDefined();
      expect(def.conditionOps).toContain(entry.op);
    }
  });

  it('all entries are disabled by default (opt-in)', () => {
    for (const entry of DEFAULT_CONFLUENCE_TEMPLATE) {
      expect(entry.enabled).toBe(false);
    }
  });

  it('orders are unique', () => {
    const orders = DEFAULT_CONFLUENCE_TEMPLATE.map((e) => e.order);
    expect(new Set(orders).size).toBe(orders.length);
  });

  it('covers RSI 2 and Stoch 14 across the full 1m..1M ladder', () => {
    const seedLabels = DEFAULT_CONFLUENCE_TEMPLATE.map((e) => e.seedLabel);
    expect(seedLabels).toContain('RSI 2');
    expect(seedLabels).toContain('Stoch 14');
    // RSI 14 was dropped from the seed in v1.13.x — see confluenceDefaults.ts
    expect(seedLabels).not.toContain('RSI 14');

    const timeframes = new Set(DEFAULT_CONFLUENCE_TEMPLATE.map((e) => e.timeframe));
    expect(timeframes).toEqual(new Set(['1m', '5m', '15m', '1h', '4h', '1d', '1w', '1M']));

    for (const seedLabel of ['RSI 2', 'Stoch 14']) {
      const tfs = new Set(
        DEFAULT_CONFLUENCE_TEMPLATE.filter((e) => e.seedLabel === seedLabel).map((e) => e.timeframe),
      );
      expect(tfs).toEqual(new Set(['1m', '5m', '15m', '1h', '4h', '1d', '1w', '1M']));
    }
  });

  it('ships EMA 21 trend filter for 15m..1M only, with priceAbove (LONG) / priceBelow (SHORT)', () => {
    const ema21 = DEFAULT_CONFLUENCE_TEMPLATE.filter((e) => e.seedLabel === 'EMA 21');
    // 6 TFs × 2 sides = 12 entries
    expect(ema21).toHaveLength(12);

    // EMA 21 is excluded on 1m / 5m — 21 candles of MA at those TFs is noise, not a trend.
    const ema21Tfs = new Set(ema21.map((e) => e.timeframe));
    expect(ema21Tfs).toEqual(new Set(['15m', '1h', '4h', '1d', '1w', '1M']));

    // LONG side uses priceAbove (price ABOVE the moving average = bullish trend filter).
    // SHORT side uses priceBelow.
    for (const entry of ema21) {
      if (entry.side === 'LONG') expect(entry.op).toBe('priceAbove');
      else expect(entry.op).toBe('priceBelow');
      // EMA 21 entries don't carry a numeric threshold — the catalog op
      // compares against live price, not a configured value.
      expect(entry.threshold).toBeUndefined();
    }

    // Weights mirror the same TF ladder: base 2.0 + TF_WEIGHTS[tf]
    //   15m=3.0, 1h=3.5, 4h=4.0, 1d=4.5, 1w=5.0, 1M=5.5
    const expectedWeights: Record<string, number> = {
      '15m': 3.0, '1h': 3.5, '4h': 4.0, '1d': 4.5, '1w': 5.0, '1M': 5.5,
    };
    for (const [tf, expected] of Object.entries(expectedWeights)) {
      const long = ema21.find((e) => e.timeframe === tf && e.side === 'LONG')!;
      expect(long.weight).toBeCloseTo(expected, 5);
    }
  });

  it('pairs LONG and SHORT entries for direction-aware ops', () => {
    const longEntries = DEFAULT_CONFLUENCE_TEMPLATE.filter((e) => e.side === 'LONG');
    const shortEntries = DEFAULT_CONFLUENCE_TEMPLATE.filter((e) => e.side === 'SHORT');
    expect(longEntries.length).toBe(shortEntries.length);
  });

  it('weights scale strictly monotonically, +0.5 per TF step, with 1m as the floor', () => {
    const TF_ORDER: Record<string, number> = { '1m': 0, '5m': 1, '15m': 2, '1h': 3, '4h': 4, '1d': 5, '1w': 6, '1M': 7 };
    const ALL_TFS = ['1m', '5m', '15m', '1h', '4h', '1d', '1w', '1M'];

    for (const seedLabel of ['RSI 2', 'Stoch 14']) {
      const entries = DEFAULT_CONFLUENCE_TEMPLATE.filter((e) => e.seedLabel === seedLabel && e.side === 'LONG');
      const sorted = [...entries].sort((a, b) => TF_ORDER[a.timeframe]! - TF_ORDER[b.timeframe]!);
      for (let i = 1; i < sorted.length; i += 1) {
        expect(sorted[i]!.weight).toBeCloseTo(sorted[i - 1]!.weight + 0.5, 5);
      }
      const w = (tf: string) => entries.find((e) => e.timeframe === tf)!.weight;
      // 1m is the floor at the indicator's base weight.
      const expectedBase = seedLabel === 'RSI 2' ? 2.0 : 1.0;
      expect(w('1m')).toBe(expectedBase);
      // 1M caps the ladder at base + 3.5 (1m=0 .. 1M=+3.5, 8 steps total).
      expect(w('1M')).toBeCloseTo(expectedBase + 3.5, 5);
    }
    // RSI 2 premium-weighted over Stoch 14 at every timeframe — that's
    // the invariant the matrix exists to preserve, including on the new
    // 1w/1M extensions.
    for (const tf of ALL_TFS) {
      const stoch = DEFAULT_CONFLUENCE_TEMPLATE.find((e) => e.seedLabel === 'Stoch 14' && e.timeframe === tf && e.side === 'LONG')!.weight;
      const rsi2 = DEFAULT_CONFLUENCE_TEMPLATE.find((e) => e.seedLabel === 'RSI 2' && e.timeframe === tf && e.side === 'LONG')!.weight;
      expect(rsi2).toBeGreaterThan(stoch);
    }
  });

  it('contains 44 entries (2 oscillator indicators × 8 TFs × 2 sides + EMA 21 × 6 TFs × 2 sides)', () => {
    expect(DEFAULT_CONFLUENCE_TEMPLATE).toHaveLength(44);
  });

  it('RSI 2 ships tight thresholds (7 oversold / 93 overbought); Stoch 14 + EMA 21 use evaluator/op defaults', () => {
    for (const entry of DEFAULT_CONFLUENCE_TEMPLATE) {
      if (entry.seedLabel === 'RSI 2') {
        expect(entry.threshold).toBe(entry.op === 'oversold' ? 7 : 93);
      } else {
        expect(entry.threshold).toBeUndefined();
      }
    }
  });

  it('orders are logically grouped: RSI 2 → Stoch 14 → EMA 21, TFs ascending within each block', () => {
    const sorted = [...DEFAULT_CONFLUENCE_TEMPLATE].sort((a, b) => a.order - b.order);
    const blocks = sorted.reduce<string[]>((acc, e) => {
      if (acc[acc.length - 1] !== e.seedLabel) acc.push(e.seedLabel);
      return acc;
    }, []);
    expect(blocks).toEqual(['RSI 2', 'Stoch 14', 'EMA 21']);

    const tfOrder: Record<string, number> = { '1m': 0, '5m': 1, '15m': 2, '1h': 3, '4h': 4, '1d': 5, '1w': 6, '1M': 7 };
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
