export const QUERY_CONFIG = {
  STALE_TIME: {
    FAST: 5000,
    MEDIUM: 30000,
    SLOW: 60000,
    LONG: 5 * 60 * 1000,
    PERMANENT: Infinity,
  },

  REFETCH_INTERVAL: {
    REALTIME: 30000,
    FAST: 30000,
    NORMAL: 60000,
    SLOW: 120000,
  },

  /**
   * Backup polling for active executions / orders / positions when the
   * WebSocket signal misses. Tight (5s) so a missed `position:closed`
   * surfaces as a stale chart line for at most ~5s instead of 30s.
   *
   * v1.6 Track F.3 — was 30s; user reported ~1 min lag on SL closes
   * because the WebSocket path missed and the 30s backup doubled the
   * perceived latency. WebSocket is still the primary signal; this is
   * the safety net.
   */
  BACKUP_POLLING_INTERVAL: 5000,
} as const;

export type QueryConfigType = typeof QUERY_CONFIG;
