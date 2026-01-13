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

  BACKUP_POLLING_INTERVAL: 30000,
} as const;

export type QueryConfigType = typeof QUERY_CONFIG;
