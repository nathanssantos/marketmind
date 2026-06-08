import { describe, expect, it } from 'vitest';
import { mergeORBZones, orbColorForSession, ORB_PALETTE_COLORS, type ORBZone } from './renderORB';

const makeZone = (overrides: Partial<ORBZone>): ORBZone => ({
  sessionId: 'tse',
  high: 100,
  low: 90,
  mid: 95,
  orbEndTimestamp: 1_000,
  sessionCloseTimestamp: 5_000,
  color: '#3B82F6',
  shortName: 'TSE',
  ...overrides,
});

describe('mergeORBZones', () => {
  it('merges zones with the same price band and overlapping window into one', () => {
    const zones = [
      makeZone({ sessionId: 'tse', shortName: 'TSE', color: '#3B82F6' }),
      makeZone({ sessionId: 'asx', shortName: 'ASX', color: '#EF4444' }),
    ];

    const merged = mergeORBZones(zones);

    expect(merged).toHaveLength(1);
    expect(merged[0]!.names).toEqual(['TSE', 'ASX']);
  });

  it('gives the merged zone a single color (area and label can never disagree)', () => {
    const merged = mergeORBZones([
      makeZone({ sessionId: 'tse', shortName: 'TSE', color: '#3B82F6' }),
      makeZone({ sessionId: 'asx', shortName: 'ASX', color: '#EF4444' }),
    ]);

    // One color drives both the fill and the label in the renderer.
    expect(merged[0]!.color).toBe('#3B82F6');
  });

  it('keeps zones with different price bands separate', () => {
    const merged = mergeORBZones([
      makeZone({ high: 100, low: 90, shortName: 'TSE' }),
      makeZone({ high: 200, low: 180, shortName: 'NYSE' }),
    ]);

    expect(merged).toHaveLength(2);
  });

  it('keeps same-price zones in non-overlapping windows separate', () => {
    const merged = mergeORBZones([
      makeZone({ orbEndTimestamp: 1_000, sessionCloseTimestamp: 2_000, shortName: 'TSE' }),
      makeZone({ orbEndTimestamp: 9_000, sessionCloseTimestamp: 10_000, shortName: 'LATE' }),
    ]);

    expect(merged).toHaveLength(2);
  });

  it('expands the merged window to the union of both sessions', () => {
    const merged = mergeORBZones([
      makeZone({ orbEndTimestamp: 2_000, sessionCloseTimestamp: 6_000 }),
      makeZone({ orbEndTimestamp: 1_000, sessionCloseTimestamp: 5_000, shortName: 'ASX' }),
    ]);

    expect(merged[0]!.orbEndTimestamp).toBe(1_000);
    expect(merged[0]!.sessionCloseTimestamp).toBe(6_000);
  });
});

describe('orbColorForSession', () => {
  it('never returns red or green so ORB cannot be confused with FVG', () => {
    const forbidden = new Set(['#ef4444', '#22c55e', '#16a34a', '#ff0000', '#00ff00']);
    for (const color of ORB_PALETTE_COLORS) {
      expect(forbidden.has(color.toLowerCase())).toBe(false);
    }
  });

  it('is deterministic per session id', () => {
    expect(orbColorForSession('tse')).toBe(orbColorForSession('tse'));
    expect(ORB_PALETTE_COLORS).toContain(orbColorForSession('nyse'));
  });
});
