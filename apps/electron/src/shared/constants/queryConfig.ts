export const QUERY_CONFIG = {
  STALE_TIME: {
    FAST: 5000,
    MEDIUM: 30000,
    SLOW: 60000,
    LONG: 5 * 60 * 1000,
    PERMANENT: Infinity,
  },

  REFETCH_INTERVAL: {
    REALTIME: 5000,
    FAST: 10000,
    NORMAL: 30000,
    SLOW: 60000,
  },

  BACKUP_POLLING_INTERVAL: 30000,
} as const;

export type QueryConfigType = typeof QUERY_CONFIG;
