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
   * WebSocket signal misses. With the WS user-data stream reliable
   * again (SDK 3.5.5→3.5.8 fix wired `usdmPrivate` correctly), tight
   * 5s polling was burning refetches the WS now covers in ms. 30s is
   * a reasonable safety-net cadence — still well under the user-
   * perceptible "the app feels frozen" threshold for the rare WS gap.
   */
  BACKUP_POLLING_INTERVAL: 30000,
} as const;

export type QueryConfigType = typeof QUERY_CONFIG;
