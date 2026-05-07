import type { ServerToClientEvents } from '@marketmind/types';
import { useEffect, useRef, useState } from 'react';
import { isPanActive } from '../store/panActivityStore';
import { getPolicyFor, type LiveStreamEvent, type LiveStreamPolicy } from '../services/liveStreamPolicies';
import { perfMonitor } from '../utils/canvas/perfMonitor';
import { shallowEqual } from '../utils/equality';
import { useSocketEvent } from './socket';

export interface UseLiveStreamOptions<E extends LiveStreamEvent> {
  /** When false, no subscription happens and the hook returns the initial value. */
  enabled?: boolean;
  /** Initial value before any event fires. */
  initialValue?: Parameters<ServerToClientEvents[E]>[0] | null;
  /** Optional override of the registry policy. Useful for tests or
   *  one-off panels that need a different cadence. */
  policyOverride?: Partial<LiveStreamPolicy>;
  /**
   * Imperative tap fired on EVERY raw payload — before throttle and
   * coalesce decisions. Use for ref-only side effects that must capture
   * every event (e.g. a metrics history buffer that's polled separately
   * from the React render path). Returning a value is ignored.
   *
   * The hook still publishes to React state on its throttled cadence.
   * If you only need ref-only access to every payload (no React state
   * at all), prefer `useSocketEvent` directly — `onRawTick` is for
   * the hybrid case where you want both.
   */
  onRawTick?: (payload: Parameters<ServerToClientEvents[E]>[0]) => void;
}

/**
 * Subscribe to a typed server event with built-in throttling, coalescing,
 * and pan-aware backpressure. Replaces the per-hook ad-hoc throttle code.
 *
 * Behavior:
 *  - The handler stores incoming payloads in a ref AND schedules a state
 *    update on a `setTimeout(throttleMs)` boundary. Within the throttle
 *    window, additional payloads update only the ref, so the latest value
 *    wins on flush — no event queue, no stale data.
 *  - When `coalesce` is set, the throttled flush bails if the new payload
 *    is shallow/strict-equal to what we last published — saves a render.
 *  - When `isPanActive()` returns true, throttle stretches by
 *    `panMultiplier`. The intent is to free the main thread for the
 *    canvas paint and pan handler. Streams with `panMultiplier=1` (or
 *    unset) ignore pan state.
 *  - On unmount / disabled / event change, all timers are cancelled.
 *
 * The returned value is the freshest published payload (or the initial /
 * null). Reads are O(1) — same as `useState`.
 */
export const useLiveStream = <E extends LiveStreamEvent>(
  event: E,
  options: UseLiveStreamOptions<E> = {},
): Parameters<ServerToClientEvents[E]>[0] | null => {
  const { enabled = true, initialValue = null, policyOverride, onRawTick } = options;
  const onRawTickRef = useRef(onRawTick);
  onRawTickRef.current = onRawTick;

  const policy = useRef<LiveStreamPolicy>({ ...getPolicyFor(event), ...policyOverride });
  policy.current = { ...getPolicyFor(event), ...policyOverride };

  type Payload = Parameters<ServerToClientEvents[E]>[0];
  const [value, setValue] = useState<Payload | null>(initialValue);
  const lastPublishedRef = useRef<Payload | null>(initialValue);
  const pendingPayloadRef = useRef<Payload | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // `null` = "never flushed yet" — distinguishes the cold-start path
  // (always publish first payload immediately) from the steady-state
  // throttle-window check. Using a numeric 0 as the sentinel is unsafe
  // when `performance.now()` itself starts near zero (fake-timer envs).
  const lastFlushAtRef = useRef<number | null>(null);

  // Reset published value when the event changes (rare — but keeps the
  // contract clean: a fresh subscription starts from initialValue).
  useEffect(() => {
    setValue(initialValue);
    lastPublishedRef.current = initialValue;
    pendingPayloadRef.current = null;
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    lastFlushAtRef.current = null;
    // initialValue is intentionally excluded: changing initialValue
    // shouldn't reset a live subscription.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event]);

  useSocketEvent(
    event,
    ((payload: Payload) => {
      perfMonitor.recordLiveStreamReceived(event);
      // Imperative side effect (e.g. ref-only history buffer) BEFORE
      // throttle decisions. Errors here don't abort the throttle path.
      if (onRawTickRef.current) {
        try { onRawTickRef.current(payload); } catch { /* best-effort */ }
      }
      pendingPayloadRef.current = payload;

      const { throttleMs, panMultiplier = 1 } = policy.current;
      const effectiveThrottle = isPanActive() && panMultiplier > 1
        ? throttleMs * panMultiplier
        : throttleMs;

      // Pass-through path: zero throttle and no pan slowdown — just
      // publish the payload synchronously so action-driven streams
      // (position:update, autoTrading:log) reach React with no delay.
      if (effectiveThrottle === 0) {
        flush();
        return;
      }

      // Cold-start: never flushed before → publish synchronously so the
      // very first payload of an idle stream paints without waiting a
      // `throttleMs` window. After this, the steady-state throttle takes
      // over.
      if (lastFlushAtRef.current === null) {
        flush();
        return;
      }

      const now = performance.now();
      const sinceLastFlush = now - lastFlushAtRef.current;
      if (sinceLastFlush >= effectiveThrottle && timerRef.current === null) {
        // Past the window AND no flush queued — publish immediately.
        flush();
        return;
      }

      // Inside the window — coalesce: just keep updating the pending
      // ref. Schedule a flush at the window edge if not already queued.
      if (timerRef.current === null) {
        const delay = Math.max(0, effectiveThrottle - sinceLastFlush);
        timerRef.current = setTimeout(flush, delay);
      }
    }) as ServerToClientEvents[E],
    enabled,
  );

  function flush(): void {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const next = pendingPayloadRef.current;
    pendingPayloadRef.current = null;
    if (next === null) return;

    const { coalesce = 'off' } = policy.current;
    if (coalesce !== 'off' && lastPublishedRef.current !== null) {
      const same = coalesce === 'shallow'
        ? shallowEqual(next, lastPublishedRef.current)
        : next === lastPublishedRef.current;
      if (same) {
        lastFlushAtRef.current = performance.now();
        return;
      }
    }

    lastPublishedRef.current = next;
    lastFlushAtRef.current = performance.now();
    perfMonitor.recordLiveStreamFlushed(event);
    setValue(next);
  }

  // Final flush on unmount avoids dropping a pending payload on a
  // remount — but since lifecycle deps would resubscribe anyway, we
  // simply cancel the timer.
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  return value;
};
