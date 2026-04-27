import { describe, expect, it } from 'vitest';
import {
  formatFundingRate,
  formatLargeNumber,
  formatTooltipDate,
  formatUsd,
  getAdxColor,
  getAltSeasonColor,
  getFearGreedColor,
  getFearGreedLevel,
  getMvrvColor,
  getOrderBookPressureColor,
  getRefreshIntervals,
} from './marketIndicatorUtils';

describe('getRefreshIntervals', () => {
  it('clamps every interval to its individual minimum when the half-interval is too small', () => {
    const out = getRefreshIntervals(1_000); // 1s
    expect(out.fearGreed).toBe(30 * 60 * 1000);
    expect(out.btcDominance).toBe(5 * 60 * 1000);
    expect(out.onChain).toBe(30 * 60 * 1000);
    expect(out.openInterest).toBe(5 * 60 * 1000);
    expect(out.longShortRatio).toBe(5 * 60 * 1000);
    expect(out.fundingRates).toBe(5 * 60 * 1000);
    expect(out.altcoinSeason).toBe(5 * 60 * 1000);
    expect(out.adxTrendStrength).toBe(5 * 60 * 1000);
    expect(out.orderBook).toBe(60 * 1000);
  });

  it('lets the half-interval win when it exceeds every minimum', () => {
    const halfInterval = 60 * 60 * 1000; // 1h
    const out = getRefreshIntervals(halfInterval);
    expect(out.fearGreed).toBe(halfInterval);
    expect(out.onChain).toBe(halfInterval);
    expect(out.btcDominance).toBe(halfInterval);
    expect(out.orderBook).toBe(Math.floor(halfInterval / 4));
  });

  it('orderBook is half-interval / 4, but never below 60s', () => {
    expect(getRefreshIntervals(60 * 1000).orderBook).toBe(60 * 1000);
    expect(getRefreshIntervals(8 * 60 * 1000).orderBook).toBe(2 * 60 * 1000);
  });
});

describe('formatTooltipDate', () => {
  it('formats the first payload entry timestamp as a locale date', () => {
    const ts = new Date('2026-04-26T10:00:00Z').getTime();
    const out = formatTooltipDate(null, [{ payload: { timestamp: ts } }]);
    expect(out).toBe(new Date(ts).toLocaleDateString());
  });

  it('returns empty string when payload is empty', () => {
    expect(formatTooltipDate(null, [])).toBe('');
  });

  it('returns empty string when timestamp is missing', () => {
    expect(formatTooltipDate(null, [{ payload: {} }])).toBe('');
  });

  it('returns empty string when payload itself is missing', () => {
    expect(formatTooltipDate(null, [{}])).toBe('');
  });
});

describe('formatFundingRate', () => {
  it('returns "-" for null', () => {
    expect(formatFundingRate(null)).toBe('-');
  });

  it('multiplies by 100 and formats with 4 decimals', () => {
    expect(formatFundingRate(0.0001)).toBe('0.0100%');
    expect(formatFundingRate(0.00012345)).toBe('0.0123%');
  });

  it('handles negative funding rates', () => {
    expect(formatFundingRate(-0.0005)).toBe('-0.0500%');
  });

  it('handles zero', () => {
    expect(formatFundingRate(0)).toBe('0.0000%');
  });
});

describe('formatLargeNumber', () => {
  it('formats >= 1B with B suffix', () => {
    expect(formatLargeNumber(1.5e9)).toBe('1.50B');
    expect(formatLargeNumber(1e9)).toBe('1.00B');
  });

  it('formats >= 1M with M suffix', () => {
    expect(formatLargeNumber(2.34e6)).toBe('2.34M');
    expect(formatLargeNumber(1e6)).toBe('1.00M');
  });

  it('formats >= 1K with K suffix', () => {
    expect(formatLargeNumber(7_500)).toBe('7.50K');
    expect(formatLargeNumber(1_000)).toBe('1.00K');
  });

  it('formats < 1K plain (2 decimals)', () => {
    expect(formatLargeNumber(999)).toBe('999.00');
    expect(formatLargeNumber(0.5)).toBe('0.50');
    expect(formatLargeNumber(0)).toBe('0.00');
  });

  it('threshold boundary: 1B wins over 1M', () => {
    expect(formatLargeNumber(1e9)).toContain('B');
  });
});

describe('getFearGreedLevel + getFearGreedColor', () => {
  it.each([
    [0, 'extremeFear', 'red'],
    [25, 'extremeFear', 'red'],
    [26, 'fear', 'orange'],
    [45, 'fear', 'orange'],
    [50, 'neutral', 'gray'],
    [55, 'neutral', 'gray'],
    [56, 'greed', 'green'],
    [75, 'greed', 'green'],
    [76, 'extremeGreed', 'green'],
    [100, 'extremeGreed', 'green'],
  ])('value %i → %s / %s', (value, expectedLabel, expectedColor) => {
    expect(getFearGreedLevel(value).labelKey).toContain(expectedLabel);
    expect(getFearGreedColor(value)).toBe(expectedColor);
  });

  it('values above 100 fall back to extremeGreed (no out-of-bounds)', () => {
    expect(getFearGreedColor(150)).toBe('green');
    expect(getFearGreedLevel(150).labelKey).toContain('extremeGreed');
  });
});

describe('getAltSeasonColor', () => {
  it('ALT_SEASON → green', () => {
    expect(getAltSeasonColor('ALT_SEASON')).toBe('green');
  });

  it('BTC_SEASON → orange', () => {
    expect(getAltSeasonColor('BTC_SEASON')).toBe('orange');
  });

  it('anything else → gray', () => {
    expect(getAltSeasonColor('NEUTRAL')).toBe('gray');
    expect(getAltSeasonColor('')).toBe('gray');
    expect(getAltSeasonColor('UNKNOWN')).toBe('gray');
  });
});

describe('getAdxColor', () => {
  it('null → gray', () => {
    expect(getAdxColor(null)).toBe('gray');
  });

  it('>= 25 → green (strong trend)', () => {
    expect(getAdxColor(25)).toBe('green');
    expect(getAdxColor(40)).toBe('green');
  });

  it('20 ≤ x < 25 → yellow', () => {
    expect(getAdxColor(20)).toBe('yellow');
    expect(getAdxColor(24.9)).toBe('yellow');
  });

  it('< 20 → red (weak/no trend)', () => {
    expect(getAdxColor(19.9)).toBe('red');
    expect(getAdxColor(0)).toBe('red');
  });
});

describe('getOrderBookPressureColor', () => {
  it('BUYING → green', () => {
    expect(getOrderBookPressureColor('BUYING')).toBe('green');
  });

  it('SELLING → red', () => {
    expect(getOrderBookPressureColor('SELLING')).toBe('red');
  });

  it('anything else → gray', () => {
    expect(getOrderBookPressureColor('BALANCED')).toBe('gray');
    expect(getOrderBookPressureColor('')).toBe('gray');
  });
});

describe('getMvrvColor', () => {
  it('null → gray', () => {
    expect(getMvrvColor(null)).toBe('gray');
  });

  it('>= 3.5 → red (overheated)', () => {
    expect(getMvrvColor(3.5)).toBe('red');
    expect(getMvrvColor(10)).toBe('red');
  });

  it('1 ≤ x < 3.5 → green (fair value range)', () => {
    expect(getMvrvColor(1)).toBe('green');
    expect(getMvrvColor(3.49)).toBe('green');
  });

  it('< 1 → blue (undervalued)', () => {
    expect(getMvrvColor(0.99)).toBe('blue');
    expect(getMvrvColor(0)).toBe('blue');
  });
});

describe('formatUsd', () => {
  it('>= 1000 → $X.XK', () => {
    expect(formatUsd(1000)).toBe('$1.0K');
    expect(formatUsd(2500)).toBe('$2.5K');
    expect(formatUsd(99_999)).toBe('$100.0K');
  });

  it('< 1000 → $XXX (no decimals)', () => {
    expect(formatUsd(999)).toBe('$999');
    expect(formatUsd(50.7)).toBe('$51');
    expect(formatUsd(0)).toBe('$0');
  });
});
