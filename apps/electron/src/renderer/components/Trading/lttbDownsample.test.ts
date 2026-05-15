import { describe, expect, it } from 'vitest';
import { lttbDownsample } from './lttbDownsample';

interface P { x: number; y: number }
const getX = (p: P) => p.x;
const getY = (p: P) => p.y;

describe('lttbDownsample', () => {
  it('returns the input unchanged when threshold >= data length', () => {
    const data = [{ x: 0, y: 1 }, { x: 1, y: 2 }, { x: 2, y: 3 }];
    expect(lttbDownsample(data, 5, getX, getY)).toEqual(data);
    expect(lttbDownsample(data, 3, getX, getY)).toEqual(data);
  });

  it('returns the input unchanged when threshold < 3 (algorithm needs 3 buckets)', () => {
    const data = Array.from({ length: 100 }, (_, i) => ({ x: i, y: i }));
    expect(lttbDownsample(data, 0, getX, getY)).toEqual(data);
    expect(lttbDownsample(data, 1, getX, getY)).toEqual(data);
    expect(lttbDownsample(data, 2, getX, getY)).toEqual(data);
  });

  it('preserves the first and last input points', () => {
    const data = Array.from({ length: 1000 }, (_, i) => ({ x: i, y: Math.sin(i / 10) * 50 }));
    const out = lttbDownsample(data, 60, getX, getY);
    expect(out[0]).toBe(data[0]);
    expect(out[out.length - 1]).toBe(data[data.length - 1]);
  });

  it('caps output at the threshold', () => {
    const data = Array.from({ length: 1000 }, (_, i) => ({ x: i, y: Math.random() * 100 }));
    const out = lttbDownsample(data, 60, getX, getY);
    expect(out.length).toBeLessThanOrEqual(60);
  });

  it('preserves a sharp peak that uniform decimation would miss', () => {
    // 100 points of mostly-zero with one tall spike at index 50.
    const data: P[] = Array.from({ length: 100 }, (_, i) => ({ x: i, y: i === 50 ? 100 : 0 }));
    const out = lttbDownsample(data, 10, getX, getY);
    // LTTB must preserve the spike — that's its whole reason for being.
    // A naive every-Nth decimation at stride 10 would skip index 50.
    expect(out.some((p) => p.y === 100)).toBe(true);
  });

  it('output is monotonically increasing in x (sort order preserved)', () => {
    const data = Array.from({ length: 500 }, (_, i) => ({ x: i, y: Math.cos(i / 5) }));
    const out = lttbDownsample(data, 50, getX, getY);
    for (let i = 1; i < out.length; i += 1) {
      expect(out[i]!.x).toBeGreaterThan(out[i - 1]!.x);
    }
  });

  it('does not mutate the input array', () => {
    const data = Array.from({ length: 100 }, (_, i) => ({ x: i, y: i * 2 }));
    const snapshot = [...data];
    lttbDownsample(data, 20, getX, getY);
    expect(data).toEqual(snapshot);
  });

  it('preserves both extremes of a v-shaped trough', () => {
    // 60 points: descend to a single min at index 30, then ascend.
    const data: P[] = Array.from({ length: 60 }, (_, i) => ({
      x: i, y: i === 30 ? -100 : Math.abs(i - 30) * 2,
    }));
    const out = lttbDownsample(data, 20, getX, getY);
    expect(out.some((p) => p.y === -100)).toBe(true);
  });
});
