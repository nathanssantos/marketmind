/**
 * Timezone-aware day/period bucketing helpers.
 *
 * `Date.setDate(now.getDate() - N)` uses the server's local timezone — wrong
 * for any user not in the server's TZ. Analytics period filters
 * ("Today's PnL", "7D", "30D") need to respect the user's local midnight
 * so a user in BRT clicking "Today" sees BRT-midnight to now, not
 * server-midnight to now.
 *
 * Implementation uses `Intl.DateTimeFormat` to extract the calendar day in
 * a target TZ, then computes the offset at noon-UTC of that same day to
 * convert back to a UTC instant. Handles DST correctly because the offset
 * is recomputed for each call.
 */

const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_MIN = 60 * 1000;
const MS_PER_DAY = 24 * MS_PER_HOUR;

/**
 * Returns the UTC `Date` corresponding to 00:00 local time of `instant`'s
 * calendar day in `tz`.
 *
 * Examples:
 * - tz='UTC', instant='2026-05-06T15:30:00Z' → '2026-05-06T00:00:00Z'
 * - tz='America/Sao_Paulo' (UTC-3), instant='2026-05-06T15:30:00Z' →
 *   '2026-05-06T03:00:00Z' (since 03:00 UTC is 00:00 BRT on May 6)
 * - tz='Europe/Berlin' (UTC+2 in summer DST), instant='2026-05-06T15:30:00Z' →
 *   '2026-05-05T22:00:00Z' (since 22:00 UTC May 5 is 00:00 CEST May 6)
 */
export const startOfDayInTz = (instant: Date, tz: string): Date => {
  const dayKey = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
  const [y, m, d] = dayKey.split('-').map(Number);

  // Probe noon UTC on (y, m, d) — read the wall-clock hour/minute in tz
  // to derive the offset for that calendar day (DST-safe).
  const probeUtc = Date.UTC(y!, m! - 1, d!, 12, 0, 0);
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(probeUtc);
  const tzHour = parseInt(parts.find((p) => p.type === 'hour')!.value, 10) % 24;
  const tzMin = parseInt(parts.find((p) => p.type === 'minute')!.value, 10);

  // offsetMin = how far ahead tz is from UTC at noon-UTC.
  // If tz shows 14:00 when UTC is 12:00 → tz is +2h (CEST).
  // If tz shows 09:00 when UTC is 12:00 → tz is -3h (BRT).
  const offsetMin = tzHour * 60 + tzMin - 720;

  // UTC instant of midnight on the calendar day (year, month, day) in tz
  // = UTC midnight of the same calendar day MINUS the tz offset.
  return new Date(Date.UTC(y!, m! - 1, d!) - offsetMin * MS_PER_MIN);
};

/**
 * Returns the UTC `Date` for the start of `daysAgo` calendar days before
 * the current day in `tz`. `daysAgo=0` returns today's start, `daysAgo=1`
 * yesterday's start, etc.
 */
export const startOfDayAgoInTz = (daysAgo: number, tz: string, now = new Date()): Date => {
  const todayStart = startOfDayInTz(now, tz);
  return new Date(todayStart.getTime() - daysAgo * MS_PER_DAY);
};

/**
 * Returns the UTC `Date` for the start of the calendar month that
 * `instant` falls in, expressed in `tz`.
 */
export const startOfMonthInTz = (instant: Date, tz: string): Date => {
  const dayKey = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
  const [y, m] = dayKey.split('-').map(Number);
  // Same offset trick — anchor at noon UTC on day 1 of the month.
  const probeUtc = Date.UTC(y!, m! - 1, 1, 12, 0, 0);
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(probeUtc);
  const tzHour = parseInt(parts.find((p) => p.type === 'hour')!.value, 10) % 24;
  const tzMin = parseInt(parts.find((p) => p.type === 'minute')!.value, 10);
  const offsetMin = tzHour * 60 + tzMin - 720;
  return new Date(Date.UTC(y!, m! - 1, 1) - offsetMin * MS_PER_MIN);
};

/**
 * Returns the UTC `Date` for `monthsAgo` calendar months before the
 * current month, in `tz`. `monthsAgo=0` is current month start, `1` is
 * previous month start.
 */
export const startOfMonthAgoInTz = (monthsAgo: number, tz: string, now = new Date()): Date => {
  const dayKey = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  const [y, m] = dayKey.split('-').map(Number);
  // Calendar arithmetic in tz space: subtract months, then anchor.
  const target = new Date(y!, m! - 1 - monthsAgo, 1);
  return startOfMonthInTz(target, tz);
};
