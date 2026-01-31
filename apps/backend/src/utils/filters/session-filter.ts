import type { SessionFilterResult } from '@marketmind/types';

const DEFAULT_SESSION_START_UTC = 13;
const DEFAULT_SESSION_END_UTC = 16;

export const SESSION_FILTER = {
  DEFAULT_START_UTC: DEFAULT_SESSION_START_UTC,
  DEFAULT_END_UTC: DEFAULT_SESSION_END_UTC,
} as const;

export type { SessionFilterResult };

export const checkSessionCondition = (
  timestamp: number,
  startUtc: number = DEFAULT_SESSION_START_UTC,
  endUtc: number = DEFAULT_SESSION_END_UTC,
): SessionFilterResult => {
  const date = new Date(timestamp);
  const currentHourUtc = date.getUTCHours();

  const normalizedStart = ((startUtc % 24) + 24) % 24;
  const normalizedEnd = ((endUtc % 24) + 24) % 24;

  let isInSession: boolean;

  if (normalizedStart <= normalizedEnd) {
    isInSession = currentHourUtc >= normalizedStart && currentHourUtc < normalizedEnd;
  } else {
    isInSession = currentHourUtc >= normalizedStart || currentHourUtc < normalizedEnd;
  }

  if (!isInSession) {
    return {
      isAllowed: false,
      currentHourUtc,
      isInSession,
      reason: `Trade blocked: current hour ${currentHourUtc}:00 UTC outside session window (${normalizedStart}:00-${normalizedEnd}:00 UTC)`,
    };
  }

  return {
    isAllowed: true,
    currentHourUtc,
    isInSession,
    reason: `Trade allowed: current hour ${currentHourUtc}:00 UTC within session window (${normalizedStart}:00-${normalizedEnd}:00 UTC)`,
  };
};
