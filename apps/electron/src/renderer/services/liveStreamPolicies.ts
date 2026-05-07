import type { ServerToClientEvents } from '@marketmind/types';

export type LiveStreamEvent = keyof ServerToClientEvents;

export interface LiveStreamPolicy {
  /** Minimum gap between React state updates, in milliseconds. 0 = pass-through. */
  throttleMs: number;
  /**
   * Multiplier applied to `throttleMs` while a chart is being panned/zoomed.
   * 4 means a 100ms throttle becomes 400ms during pan, freeing the main
   * thread for the canvas paint and mousemove. 1 = no change.
   */
  panMultiplier?: number;
  /**
   * Coalesce strategy:
   * - `off` — fire on every update, regardless of value equality
   * - `shallow` — drop updates where the new payload reference equals the prev
   * - `deep` — drop updates where shallow-equal field-by-field (one level)
   *
   * Default: 'off'. Most streams want every update because their payloads
   * carry monotonic numeric data; shallow/deep helps when payloads
   * occasionally repeat (e.g. depth snapshots that didn't change).
   */
  coalesce?: 'off' | 'shallow' | 'deep';
}

/**
 * Default factor by which all stream throttle windows stretch while a
 * chart is panning. Exported so non-`useLiveStream` throttle paths
 * (`priceStore`'s own per-store timers) can apply the same multiplier
 * — keeping perf behavior consistent across all live data, not just
 * the registry-managed streams.
 */
export const DEFAULT_PAN_MULTIPLIER = 4;

// Single source of truth for live-stream pacing. Tweak here to globally
// tune perf — every consumer that uses `useLiveStream` inherits the
// policy automatically. Add new entries when you wire a new event.
//
// Choosing throttle values:
//   * 0–16ms: critical path (per-frame). Reserved for kline ticks; we
//     already pace those via rAF in useKlineLiveStream.
//   * 100ms (10Hz): bid/ask, microprice — fast enough for human eye on
//     a price button, slow enough that we don't burn CPU on every
//     bookTicker burst.
//   * 200–250ms: order book ladder, scalping metrics, daily change.
//     Visually indistinguishable from realtime at this cadence and
//     drastically cheaper.
//   * 0 (no throttle): user-action-driven events (position:closed,
//     order:update, autoTrading:log) — these are rare and need to be
//     surfaced immediately.
export const LIVE_STREAM_POLICIES: Partial<Record<LiveStreamEvent, LiveStreamPolicy>> = {
  'bookTicker:update':         { throttleMs: 100, panMultiplier: DEFAULT_PAN_MULTIPLIER, coalesce: 'shallow' },
  'depth:update':              { throttleMs: 250, panMultiplier: DEFAULT_PAN_MULTIPLIER, coalesce: 'shallow' },
  'scalpingMetrics:update':    { throttleMs: 200, panMultiplier: DEFAULT_PAN_MULTIPLIER, coalesce: 'shallow' },
  'liquidityHeatmap:bucket':   { throttleMs: 250, panMultiplier: DEFAULT_PAN_MULTIPLIER, coalesce: 'shallow' },
  'aggTrade:update':           { throttleMs: 100, panMultiplier: DEFAULT_PAN_MULTIPLIER, coalesce: 'shallow' },
  // 250ms is fast enough to feel realtime in the activity log while
  // collapsing burst windows (active auto-trading sessions can fire 10+
  // log entries/sec when watchers all evaluate at once). The hook
  // accumulates EVERY entry via `onRawTick` — only the React state
  // setLogs call is throttled.
  'autoTrading:log':           { throttleMs: 250, panMultiplier: DEFAULT_PAN_MULTIPLIER, coalesce: 'off' },
  // Events left out of this table fall back to no-throttle, no-coalesce
  // — that's the right default for action-driven events.
};

export const DEFAULT_POLICY: LiveStreamPolicy = {
  throttleMs: 0,
  panMultiplier: 1,
  coalesce: 'off',
};

export const getPolicyFor = (event: LiveStreamEvent): LiveStreamPolicy => {
  return LIVE_STREAM_POLICIES[event] ?? DEFAULT_POLICY;
};
