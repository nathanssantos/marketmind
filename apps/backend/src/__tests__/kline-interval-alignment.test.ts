import { describe, expect, it } from 'vitest';
import {
  alignToIntervalStart,
  countOpenTimesBetween,
  getNextOpenTime,
  getPreviousOpenTime,
  TIME_MS,
} from '@marketmind/types';

const JAN_1_2028 = Date.UTC(2028, 0, 1);
const FEB_1_2028 = Date.UTC(2028, 1, 1);
const MAR_1_2028 = Date.UTC(2028, 2, 1);
const APR_1_2028 = Date.UTC(2028, 3, 1);
const DEC_1_2027 = Date.UTC(2027, 11, 1);
const WEDNESDAY_2026_09_23_15H = Date.UTC(2026, 8, 23, 15, 0, 0);
const MONDAY_2026_09_21 = Date.UTC(2026, 8, 21);

describe('alignToIntervalStart', () => {
  it('floors fixed-length intervals', () => {
    const t = Date.UTC(2026, 8, 26, 12, 7, 37);
    expect(alignToIntervalStart(t, '1m')).toBe(Date.UTC(2026, 8, 26, 12, 7, 0));
    expect(alignToIntervalStart(t, '15m')).toBe(Date.UTC(2026, 8, 26, 12, 0, 0));
    expect(alignToIntervalStart(t, '1d')).toBe(Date.UTC(2026, 8, 26));
  });

  it('aligns months and years to the first day in UTC', () => {
    expect(alignToIntervalStart(Date.UTC(2028, 1, 29, 23, 59), '1M')).toBe(FEB_1_2028);
    expect(alignToIntervalStart(Date.UTC(2028, 6, 4), '1y')).toBe(JAN_1_2028);
  });

  it('aligns weeks to Monday 00:00 UTC like Binance', () => {
    expect(alignToIntervalStart(WEDNESDAY_2026_09_23_15H, '1w')).toBe(MONDAY_2026_09_21);
    expect(alignToIntervalStart(MONDAY_2026_09_21, '1w')).toBe(MONDAY_2026_09_21);
    expect(alignToIntervalStart(MONDAY_2026_09_21 + 6 * TIME_MS.DAY, '1w')).toBe(MONDAY_2026_09_21);
  });
});

describe('getNextOpenTime / getPreviousOpenTime', () => {
  it('steps months by calendar length, including leap February', () => {
    expect(getNextOpenTime(JAN_1_2028, '1M')).toBe(FEB_1_2028);
    expect(getNextOpenTime(FEB_1_2028, '1M')).toBe(MAR_1_2028);
    expect(getNextOpenTime(DEC_1_2027, '1M')).toBe(JAN_1_2028);
    expect(getPreviousOpenTime(MAR_1_2028, '1M')).toBe(FEB_1_2028);
    expect(getPreviousOpenTime(JAN_1_2028, '1M')).toBe(DEC_1_2027);
  });

  it('steps fixed intervals by their length', () => {
    expect(getNextOpenTime(MONDAY_2026_09_21, '1w')).toBe(MONDAY_2026_09_21 + TIME_MS.WEEK);
    expect(getNextOpenTime(0, '1m')).toBe(TIME_MS.MINUTE);
    expect(getPreviousOpenTime(TIME_MS.MINUTE, '1m')).toBe(0);
  });
});

describe('countOpenTimesBetween', () => {
  it('counts calendar months without drifting on 30 and 31 day months', () => {
    expect(countOpenTimesBetween(JAN_1_2028, APR_1_2028, '1M')).toBe(3);
    expect(countOpenTimesBetween(Date.UTC(2026, 0, 1), Date.UTC(2027, 0, 1), '1M')).toBe(12);
  });

  it('counts fixed intervals arithmetically', () => {
    expect(countOpenTimesBetween(0, 5 * TIME_MS.MINUTE, '1m')).toBe(5);
    expect(countOpenTimesBetween(5 * TIME_MS.MINUTE, 0, '1m')).toBe(0);
  });
});
