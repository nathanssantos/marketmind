import type { Kline } from '@marketmind/types';
import { getKlineClose, getKlineHigh, getKlineLow, getKlineVolume } from '@marketmind/types';

const TYPICAL_PRICE_DIVISOR = 3;
const MS_PER_DAY = 86_400_000;

const getUTCDayKey = (ts: number): number => {
  const d = new Date(ts);
  return d.getUTCFullYear() * 10000 + d.getUTCMonth() * 100 + d.getUTCDate();
};

const getUTCWeekKey = (ts: number): number => {
  const d = new Date(ts);
  const utcMs = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const day = new Date(utcMs).getUTCDay();
  return Math.floor((utcMs - day * MS_PER_DAY) / (7 * MS_PER_DAY));
};

const getUTCMonthKey = (ts: number): number => {
  const d = new Date(ts);
  return d.getUTCFullYear() * 100 + d.getUTCMonth();
};

const accumulateVWAP = (
  kline: Kline,
  state: { tpv: number; vol: number },
): number => {
  const typicalPrice =
    (getKlineHigh(kline) + getKlineLow(kline) + getKlineClose(kline)) / TYPICAL_PRICE_DIVISOR;
  state.tpv += typicalPrice * getKlineVolume(kline);
  state.vol += getKlineVolume(kline);
  return state.vol === 0 ? getKlineClose(kline) : state.tpv / state.vol;
};

const calculatePeriodicVWAP = (
  klines: Kline[],
  getPeriodKey: (ts: number) => number,
): number[] => {
  if (klines.length === 0) return [];
  const firstKline = klines[0];
  if (!firstKline) return [];

  const vwap: number[] = [];
  const state = { tpv: 0, vol: 0 };
  let currentPeriod = getPeriodKey(firstKline.openTime);

  for (const kline of klines) {
    const period = getPeriodKey(kline.openTime);
    if (period !== currentPeriod) {
      state.tpv = 0;
      state.vol = 0;
      currentPeriod = period;
    }
    vwap.push(accumulateVWAP(kline, state));
  }

  return vwap;
};

export const calculateVWAP = (klines: Kline[]): number[] => {
  const vwap: number[] = [];
  const state = { tpv: 0, vol: 0 };
  for (const kline of klines) vwap.push(accumulateVWAP(kline, state));
  return vwap;
};

export const calculateIntradayVWAP = (klines: Kline[]): number[] =>
  calculatePeriodicVWAP(klines, getUTCDayKey);

export const calculateWeeklyVWAP = (klines: Kline[]): number[] =>
  calculatePeriodicVWAP(klines, getUTCWeekKey);

export const calculateMonthlyVWAP = (klines: Kline[]): number[] =>
  calculatePeriodicVWAP(klines, getUTCMonthKey);
