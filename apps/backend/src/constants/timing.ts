import { TIME_MS } from '@marketmind/types';

export const FUNDING = {
  INTERVAL_MS: 8 * TIME_MS.HOUR,
} as const;

export const SESSION_SCANNER = {
  SCAN_INTERVAL_MS: 5 * TIME_MS.MINUTE,
  RESULT_CACHE_TTL_MS: 10 * TIME_MS.MINUTE,
} as const;
