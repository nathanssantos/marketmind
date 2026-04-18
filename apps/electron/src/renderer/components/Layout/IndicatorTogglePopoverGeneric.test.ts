import type { UserIndicator } from '@marketmind/trading-core';
import { describe, expect, it } from 'vitest';
import { CATEGORY_ORDER, groupByCategory } from './IndicatorTogglePopoverGeneric';

const mk = (id: string, catalogType: string, label: string): UserIndicator => ({
  id,
  catalogType,
  label,
  params: {},
  isCustom: false,
});

describe('groupByCategory', () => {
  it('returns empty when indicators list empty', () => {
    expect(groupByCategory([])).toEqual([]);
  });

  it('skips indicators whose catalogType is not in catalog', () => {
    const groups = groupByCategory([mk('u1', 'not-a-real-type', 'X')]);
    expect(groups).toEqual([]);
  });

  it('groups indicators by their catalog category', () => {
    const groups = groupByCategory([
      mk('u1', 'rsi', 'RSI'),
      mk('u2', 'sma', 'SMA'),
      mk('u3', 'ema', 'EMA'),
    ]);
    const categories = groups.map((g) => g.category);
    expect(categories).toContain('oscillators');
    expect(categories).toContain('movingAverages');
    const ma = groups.find((g) => g.category === 'movingAverages')!;
    expect(ma.items.map((i) => i.id).sort()).toEqual(['u2', 'u3']);
  });

  it('emits groups in CATEGORY_ORDER', () => {
    const groups = groupByCategory([
      mk('u1', 'macd', 'MACD'),
      mk('u2', 'rsi', 'RSI'),
      mk('u3', 'sma', 'SMA'),
    ]);
    const cats = groups.map((g) => g.category);
    const expectedOrder = CATEGORY_ORDER.filter((c) => cats.includes(c));
    expect(cats).toEqual(expectedOrder);
  });

  it('skips empty categories (no items)', () => {
    const groups = groupByCategory([mk('u1', 'rsi', 'RSI')]);
    expect(groups.every((g) => g.items.length > 0)).toBe(true);
    expect(groups.find((g) => g.category === 'volatility')).toBeUndefined();
  });

  it('builds titleKey using i18n category convention', () => {
    const groups = groupByCategory([mk('u1', 'rsi', 'RSI')]);
    expect(groups[0]?.titleKey).toBe('chart.indicators.categories.oscillators');
  });
});
