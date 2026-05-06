import { describe, expect, it } from 'vitest';
import {
  startOfDayAgoInTz,
  startOfDayInTz,
  startOfMonthAgoInTz,
  startOfMonthInTz,
} from './tz-bucket';

describe('startOfDayInTz', () => {
  it('UTC: returns same calendar day at 00:00Z', () => {
    const result = startOfDayInTz(new Date('2026-05-06T15:30:00Z'), 'UTC');
    expect(result.toISOString()).toBe('2026-05-06T00:00:00.000Z');
  });

  it('America/Sao_Paulo (UTC-3): returns 03:00Z of the BRT calendar day', () => {
    // 15:30 UTC on May 6 = 12:30 BRT on May 6, so the BRT day is May 6,
    // and midnight BRT on May 6 = 03:00 UTC on May 6.
    const result = startOfDayInTz(new Date('2026-05-06T15:30:00Z'), 'America/Sao_Paulo');
    expect(result.toISOString()).toBe('2026-05-06T03:00:00.000Z');
  });

  it('America/Sao_Paulo: instant just before BRT midnight rolls back a day', () => {
    // 02:00 UTC on May 6 = 23:00 BRT on May 5 → BRT day is May 5
    // → midnight BRT on May 5 = 03:00 UTC on May 5.
    const result = startOfDayInTz(new Date('2026-05-06T02:00:00Z'), 'America/Sao_Paulo');
    expect(result.toISOString()).toBe('2026-05-05T03:00:00.000Z');
  });

  it('Asia/Tokyo (UTC+9): instant 14:00 UTC May 6 = 23:00 JST May 6', () => {
    // JST day is May 6, midnight JST = 15:00 UTC May 5.
    const result = startOfDayInTz(new Date('2026-05-06T14:00:00Z'), 'Asia/Tokyo');
    expect(result.toISOString()).toBe('2026-05-05T15:00:00.000Z');
  });

  it('Asia/Tokyo: instant 16:00 UTC May 6 = 01:00 JST May 7', () => {
    // JST day is May 7, midnight JST = 15:00 UTC May 6.
    const result = startOfDayInTz(new Date('2026-05-06T16:00:00Z'), 'Asia/Tokyo');
    expect(result.toISOString()).toBe('2026-05-06T15:00:00.000Z');
  });

  it('Europe/Berlin in summer (DST, UTC+2): 22:00 UTC of prior day', () => {
    // Mid-June is firmly in CEST (UTC+2). 12:00 UTC June 15 = 14:00 CEST.
    // Midnight CEST June 15 = 22:00 UTC June 14.
    const result = startOfDayInTz(new Date('2026-06-15T12:00:00Z'), 'Europe/Berlin');
    expect(result.toISOString()).toBe('2026-06-14T22:00:00.000Z');
  });

  it('Europe/Berlin in winter (CET, UTC+1): 23:00 UTC of prior day', () => {
    // Mid-January is CET (UTC+1). Midnight CET = 23:00 UTC of prior day.
    const result = startOfDayInTz(new Date('2026-01-15T12:00:00Z'), 'Europe/Berlin');
    expect(result.toISOString()).toBe('2026-01-14T23:00:00.000Z');
  });
});

describe('startOfDayAgoInTz', () => {
  it('daysAgo=0 returns today start in tz', () => {
    const now = new Date('2026-05-06T15:00:00Z');
    expect(startOfDayAgoInTz(0, 'UTC', now).toISOString()).toBe('2026-05-06T00:00:00.000Z');
  });

  it('daysAgo=1 returns yesterday start in tz', () => {
    const now = new Date('2026-05-06T15:00:00Z');
    expect(startOfDayAgoInTz(1, 'UTC', now).toISOString()).toBe('2026-05-05T00:00:00.000Z');
  });

  it('daysAgo=7 in BRT returns May -1 = April 29 03:00Z', () => {
    const now = new Date('2026-05-06T15:00:00Z');
    expect(startOfDayAgoInTz(7, 'America/Sao_Paulo', now).toISOString()).toBe(
      '2026-04-29T03:00:00.000Z',
    );
  });

  it('handles month boundary correctly in BRT', () => {
    const now = new Date('2026-05-02T15:00:00Z');
    // 5 days ago in BRT = April 27 → midnight BRT = 03:00 UTC April 27
    expect(startOfDayAgoInTz(5, 'America/Sao_Paulo', now).toISOString()).toBe(
      '2026-04-27T03:00:00.000Z',
    );
  });
});

describe('startOfMonthInTz', () => {
  it('UTC: returns first of month at 00:00Z', () => {
    const result = startOfMonthInTz(new Date('2026-05-15T15:00:00Z'), 'UTC');
    expect(result.toISOString()).toBe('2026-05-01T00:00:00.000Z');
  });

  it('BRT (UTC-3): returns first of month at 03:00Z', () => {
    const result = startOfMonthInTz(new Date('2026-05-15T15:00:00Z'), 'America/Sao_Paulo');
    expect(result.toISOString()).toBe('2026-05-01T03:00:00.000Z');
  });

  it('BRT: instant just before BRT month boundary rolls back', () => {
    // May 1 02:00 UTC = April 30 23:00 BRT → April month
    const result = startOfMonthInTz(new Date('2026-05-01T02:00:00Z'), 'America/Sao_Paulo');
    expect(result.toISOString()).toBe('2026-04-01T03:00:00.000Z');
  });
});

describe('startOfMonthAgoInTz', () => {
  it('monthsAgo=0 returns this month start in tz', () => {
    const now = new Date('2026-05-15T15:00:00Z');
    expect(startOfMonthAgoInTz(0, 'UTC', now).toISOString()).toBe('2026-05-01T00:00:00.000Z');
  });

  it('monthsAgo=1 returns previous month start', () => {
    const now = new Date('2026-05-15T15:00:00Z');
    expect(startOfMonthAgoInTz(1, 'UTC', now).toISOString()).toBe('2026-04-01T00:00:00.000Z');
  });

  it('handles year boundary (Jan → Dec previous year)', () => {
    const now = new Date('2026-01-15T15:00:00Z');
    expect(startOfMonthAgoInTz(1, 'UTC', now).toISOString()).toBe('2025-12-01T00:00:00.000Z');
  });
});
