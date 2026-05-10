import { describe, expect, it } from 'vitest';
import type { Kline } from '@marketmind/types';
import { BUILTIN_PATTERNS, BUILTIN_PATTERN_MAP, DEFAULT_ENABLED_PATTERN_IDS } from '../builtin';
import { compilePattern, detectPatterns } from '../detect';

const k = (open: number, high: number, low: number, close: number): Kline => ({
  openTime: 0, open, high, low, close, volume: 100,
  closeTime: 0, quoteVolume: 0, trades: 0, buyVolume: 0, buyQuoteVolume: 0,
});

const detect = (id: string, bars: Kline[]): number =>
  detectPatterns([...bars, k(100, 101, 99, 100)], [compilePattern(BUILTIN_PATTERN_MAP[id]!)])
    .filter((h) => h.patternId === id).length;

describe('BUILTIN_PATTERNS', () => {
  it('exposes 25 patterns with unique ids', () => {
    expect(BUILTIN_PATTERNS).toHaveLength(25);
    const ids = new Set(BUILTIN_PATTERNS.map((p) => p.id));
    expect(ids.size).toBe(25);
  });

  it('every pattern compiles cleanly', () => {
    for (const def of BUILTIN_PATTERNS) {
      expect(() => compilePattern(def)).not.toThrow();
    }
  });

  it('default-enabled ids all reference real patterns', () => {
    for (const id of DEFAULT_ENABLED_PATTERN_IDS) {
      expect(BUILTIN_PATTERN_MAP[id]).toBeDefined();
    }
  });

  it('every pattern has at least one constraint', () => {
    for (const def of BUILTIN_PATTERNS) {
      expect(def.constraints.length).toBeGreaterThan(0);
    }
  });
});

describe('detection — single-bar patterns', () => {
  it('hammer: long lower wick, small body near top', () => {
    // body=5, lowerWick=10 (≥2*body), upperWick=1 (≤0.3*body)
    expect(detect('hammer', [k(100, 106, 90, 105)])).toBe(1);
    // Near-miss: lower wick too short
    expect(detect('hammer', [k(100, 106, 99, 105)])).toBe(0);
  });

  it('inverted-hammer: long upper wick, small body near bottom', () => {
    // body=5, upperWick=10 (≥2*body), lowerWick=1 (≤0.3*body)
    expect(detect('inverted-hammer', [k(105, 115, 99, 100)])).toBe(1);
    expect(detect('inverted-hammer', [k(105, 107, 99, 100)])).toBe(0);
  });

  it('hanging-man: same shape as hammer', () => {
    expect(detect('hanging-man', [k(100, 106, 90, 105)])).toBe(1);
  });

  it('shooting-star: same shape as inverted-hammer', () => {
    expect(detect('shooting-star', [k(105, 115, 99, 100)])).toBe(1);
  });

  it('doji: open ≈ close', () => {
    expect(detect('doji', [k(100, 105, 95, 100.1)])).toBe(1);
    expect(detect('doji', [k(100, 105, 95, 104)])).toBe(0);
  });

  it('dragonfly-doji: no upper wick, long lower wick', () => {
    expect(detect('dragonfly-doji', [k(100, 100, 90, 100)])).toBe(1);
  });

  it('gravestone-doji: long upper wick, no lower wick', () => {
    expect(detect('gravestone-doji', [k(100, 110, 100, 100)])).toBe(1);
  });

  it('spinning-top: small body, long wicks both sides', () => {
    expect(detect('spinning-top', [k(100, 110, 90, 101)])).toBe(1);
  });

  it('marubozu-white: bullish, near-zero wicks', () => {
    expect(detect('marubozu-white', [k(100, 110.1, 99.9, 110)])).toBe(1);
    expect(detect('marubozu-white', [k(100, 115, 95, 110)])).toBe(0);
  });

  it('marubozu-black: bearish, near-zero wicks', () => {
    expect(detect('marubozu-black', [k(110, 110.1, 99.9, 100)])).toBe(1);
  });
});

describe('detection — two-bar patterns', () => {
  it('bullish-engulfing: bear then bull engulfing', () => {
    // b1 (older, idx 0) is down; b0 (newer, idx 1) is up engulfing.
    const bars = [k(105, 106, 99, 100), k(99, 108, 98, 107)];
    expect(detect('bullish-engulfing', bars)).toBe(1);
  });

  it('bearish-engulfing: bull then bear engulfing', () => {
    const bars = [k(100, 101, 94, 105), k(106, 107, 92, 93)];
    expect(detect('bearish-engulfing', bars)).toBe(1);
  });

  it('bullish-harami: bear then small bull inside body', () => {
    const bars = [k(110, 112, 95, 96), k(100, 103, 99, 102)];
    expect(detect('bullish-harami', bars)).toBe(1);
  });

  it('bearish-harami: bull then small bear inside body', () => {
    const bars = [k(95, 110, 94, 109), k(102, 105, 99, 100)];
    expect(detect('bearish-harami', bars)).toBe(1);
  });

  it('piercing-line: bear then bull recovering past midpoint', () => {
    const bars = [k(110, 111, 99, 100), k(98, 108, 97, 106)];
    expect(detect('piercing-line', bars)).toBe(1);
  });

  it('dark-cloud-cover: bull then bear closing past midpoint', () => {
    const bars = [k(100, 110, 99, 109), k(112, 113, 102, 103)];
    expect(detect('dark-cloud-cover', bars)).toBe(1);
  });

  it('tweezer-bottom: matching lows, down then up', () => {
    const bars = [k(110, 112, 100, 102), k(102, 108, 100, 107)];
    expect(detect('tweezer-bottom', bars)).toBe(1);
  });

  it('tweezer-top: matching highs, up then down', () => {
    const bars = [k(100, 110, 99, 108), k(108, 110, 100, 101)];
    expect(detect('tweezer-top', bars)).toBe(1);
  });
});

describe('detection — three-bar patterns', () => {
  it('morning-star: bear, gap-down star, bull recovers', () => {
    // b2 (oldest) bear, b1 small star gapping below, b0 bull closing past midpoint.
    const bars = [k(110, 111, 95, 96), k(94, 95, 93, 94.2), k(95, 105, 94.5, 104)];
    expect(detect('morning-star', bars)).toBe(1);
  });

  it('evening-star: bull, gap-up star, bear recovers down', () => {
    const bars = [k(95, 110, 94, 109), k(112, 113, 111, 112.2), k(111, 112, 100, 101)];
    expect(detect('evening-star', bars)).toBe(1);
  });

  it('three-white-soldiers: three rising bull bars', () => {
    const bars = [k(100, 105, 99, 104), k(102, 108, 101, 107), k(105, 111, 104, 110)];
    expect(detect('three-white-soldiers', bars)).toBe(1);
  });

  it('three-black-crows: three falling bear bars', () => {
    const bars = [k(110, 111, 105, 106), k(108, 109, 102, 103), k(105, 106, 99, 100)];
    expect(detect('three-black-crows', bars)).toBe(1);
  });

  it('three-inside-up: harami confirmed by third bull bar', () => {
    // b2 bear (110→96), b1 small bull inside body (100→102), b0 closes above topBody(b2)=110
    const bars = [k(110, 112, 95, 96), k(100, 103, 99, 102), k(102, 112, 101, 111)];
    expect(detect('three-inside-up', bars)).toBe(1);
  });
});

describe('detection — five-bar continuation patterns', () => {
  it('rising-three-methods: long bull, three small inside, bull closes higher', () => {
    const bars = [
      k(100, 110, 99, 109),
      k(106, 108, 102, 103),
      k(105, 107, 102, 104),
      k(104, 106, 101, 102),
      k(103, 112, 102, 111),
    ];
    expect(detect('rising-three-methods', bars)).toBe(1);
  });

  it('falling-three-methods: long bear, three small inside, bear closes lower', () => {
    const bars = [
      k(110, 111, 100, 101),
      k(103, 108, 102, 107),
      k(105, 107, 102, 106),
      k(106, 108, 103, 105),
      k(106, 107, 99, 100),
    ];
    expect(detect('falling-three-methods', bars)).toBe(1);
  });
});

describe('detect()', () => {
  it('skips the in-flight (last) bar', () => {
    // A clear hammer placed at the very last index should NOT be detected.
    const bars = [k(100, 102, 90, 101)];
    const compiled = [compilePattern(BUILTIN_PATTERN_MAP['hammer']!)];
    expect(detectPatterns(bars, compiled)).toEqual([]);
  });

  it('returns hits sorted by index', () => {
    const bars = [
      k(100, 106, 90, 105),       // hammer @ 0
      k(102, 108, 92, 107),       // hammer @ 1
      k(100, 100.1, 90, 100),     // dragonfly-doji @ 2
      k(100, 101, 99, 100),       // in-flight, skipped
    ];
    const compiled = [
      compilePattern(BUILTIN_PATTERN_MAP['hammer']!),
      compilePattern(BUILTIN_PATTERN_MAP['dragonfly-doji']!),
    ];
    const hits = detectPatterns(bars, compiled);
    expect(hits.map((h) => h.index)).toEqual([0, 1, 2]);
  });
});
