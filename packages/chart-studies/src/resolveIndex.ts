import type { CoordinateMapper } from './types';

/**
 * Resolve a stored drawing anchor to its current array index. When the
 * drawing was saved with a `*Time` field, prefer the timestamp — that
 * way pagination prepends, partial-window reloads, and any other event
 * that shifts the klines array can't drift the drawing on the X axis.
 *
 * `mapper.timeToIndex` is a best-effort lookup that silently snaps to
 * bar 0 / N-1 when the timestamp falls outside the loaded range, so we
 * verify the resolved bar's openTime matches what was stored. On any
 * mismatch — out of range, mapper has no klines yet, snapped edge — we
 * fall back to the stored index. Legacy drawings persisted before the
 * `*Time` field was added still work via the same fallback.
 *
 * This is the per-call resolver consumed by every drawing renderer +
 * the hit-tester so both agree on the on-screen X every frame. There
 * is a companion bulk-resolve step (`resolveDrawingIndices`) that
 * runs once per cache miss in `useDrawingsRenderer`; this helper is
 * the safety net that guarantees alignment even when the bulk cache
 * lags a kline-array change for one frame.
 */
export const resolveDrawingIndex = (
  storedIndex: number,
  storedTime: number | undefined,
  mapper: CoordinateMapper,
): number => {
  if (storedTime === undefined) return storedIndex;
  const resolved = mapper.timeToIndex(storedTime);
  if (resolved < 0) return storedIndex;
  const resolvedTime = mapper.getKlineTime(resolved);
  if (resolvedTime !== storedTime) return storedIndex;
  return resolved;
};
