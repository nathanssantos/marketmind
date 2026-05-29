import { USDMClient } from 'binance';
import { TIME_MS } from '../constants';
import { logger, serializeError } from './logger';

/**
 * Process-wide Binance server-time offset.
 *
 * Binance rejects any signed request whose `timestamp` is ahead of the
 * exchange's clock (error -1021), and `recvWindow` does NOT help in that
 * direction — it only widens the *behind* tolerance. A dev/prod machine
 * whose NTP clock has drifted even ~1s ahead therefore fails every
 * private futures call (observed 2026-05-29: `getPositions` →
 * "Timestamp for this request was 1000ms ahead of the server's time").
 *
 * The `binance` SDK can self-correct via its own time sync, but only by
 * firing a `/time` call + registering an hourly `setInterval` *per client
 * instance*. Our factories mint a fresh client on every call (34 call
 * sites), so enabling the SDK's sync would leak one timer per request and
 * race the first signed call before the async offset resolves.
 *
 * Instead we keep ONE offset for the whole process: bootstrapped at
 * startup, refreshed on an interval, and stamped onto every freshly
 * created client via `client.setTimeOffset(...)`. Each client keeps
 * `disableTimeSync: true` so it never spins up its own timer.
 */

const REFRESH_INTERVAL_MS = 5 * TIME_MS.MINUTE;

let currentOffset = 0;
let refreshTimer: ReturnType<typeof setInterval> | null = null;
// A keyless public client purely for `/fapi/v1/time`. The endpoint needs
// no auth and is weight 1, so a single shared instance is plenty. Built
// lazily on first sync so merely importing this module has no side effect
// (keeps tests that partially mock `binance` from needing a USDMClient
// export just to load an unrelated suite).
let timeClient: USDMClient | null = null;
const getTimeClient = (): USDMClient => {
  timeClient ??= new USDMClient({ disableTimeSync: true });
  return timeClient;
};

/**
 * Offset (ms) to add to `Date.now()` so the resulting timestamp matches
 * Binance server time. Positive when the local clock is behind, negative
 * when ahead. Mirrors the SDK's own `fetchTimeOffset` drift estimate.
 */
export const getBinanceTimeOffset = (): number => currentOffset;

/**
 * Stamp the current offset onto a newly created client. No-op safe: when
 * the offset is still 0 (sync hasn't run yet) the client behaves exactly
 * as before.
 */
export const applyBinanceTimeOffset = (client: { setTimeOffset: (v: number) => void }): void => {
  client.setTimeOffset(currentOffset);
};

const fetchOffset = async (): Promise<number> => {
  const start = Date.now();
  const serverTime = await getTimeClient().getServerTime();
  const end = Date.now();
  // Round-trip-aware estimate, same formula the SDK uses: assume the
  // server stamped its time at the midpoint of our request latency.
  const avgDrift = (end - start) / 2;
  return Math.ceil(serverTime - end + avgDrift);
};

const refresh = async (): Promise<void> => {
  try {
    const next = await fetchOffset();
    const previous = currentOffset;
    currentOffset = next;
    if (Math.abs(next - previous) > 500) {
      logger.warn(
        { previousOffsetMs: previous, newOffsetMs: next },
        '[binance-time-sync] Clock offset shifted >500ms — local clock drifting vs Binance',
      );
    } else {
      logger.trace({ offsetMs: next }, '[binance-time-sync] Offset refreshed');
    }
  } catch (error) {
    // Keep the last known offset on failure — a transient /time outage
    // shouldn't reset us to 0 and reintroduce the drift.
    logger.warn({ error: serializeError(error) }, '[binance-time-sync] Offset refresh failed — keeping last value');
  }
};

/**
 * Bootstrap the offset (awaited so the first authed client minted after
 * this resolves already carries a correct offset) and arm the periodic
 * refresh. Idempotent — a second call is a no-op.
 */
export const startBinanceTimeSync = async (): Promise<void> => {
  if (refreshTimer) return;
  await refresh();
  refreshTimer = setInterval(() => {
    void refresh();
  }, REFRESH_INTERVAL_MS);
  refreshTimer.unref();
  logger.info({ offsetMs: currentOffset, refreshIntervalMs: REFRESH_INTERVAL_MS }, '[binance-time-sync] Started');
};

export const stopBinanceTimeSync = (): void => {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
};
