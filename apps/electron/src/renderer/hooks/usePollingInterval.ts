import { useApiBanStore } from '../store/apiBanStore';
import { useConnectionStore } from '../store/connectionStore';

const WS_CONNECTED_POLLING_MS = 5_000;

interface PollingOptions {
  /**
   * When true, polling is suspended entirely while the WS is connected.
   * The query relies on socket-driven cache patches
   * (RealtimeTradingSyncContext) for freshness; polling only fires as a
   * fallback when WS drops. Eliminates redundant refetches that would
   * otherwise trigger React re-render cascades during pan / steady use.
   *
   * Use only when there's an authoritative socket event covering every
   * field the consumer reads. For queries with no socket counterpart
   * (external APIs, periodic backend computations), leave undefined.
   */
  wsBacked?: boolean;
}

export const usePollingInterval = (
  fallbackMs: number,
  options?: PollingOptions,
): number | false => {
  const wsConnected = useConnectionStore((s) => s.wsConnected);
  const banExpiresAt = useApiBanStore((s) => s.banExpiresAt);
  if (banExpiresAt > Date.now()) return false;
  if (wsConnected && options?.wsBacked) return false;
  return wsConnected ? WS_CONNECTED_POLLING_MS : fallbackMs;
};
