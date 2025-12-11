import type { Kline } from '@marketmind/types';
import type { TemporalFeatureSet } from '../types';
import {
  TEMPORAL_FEATURE_NAMES,
  MARKET_SESSION_HOURS,
  BITCOIN_HALVINGS,
  NEXT_HALVING_ESTIMATE,
} from '../constants/featureConfig';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export class TemporalFeatures {
  constructor(_config?: unknown) {}

  extract(kline: Kline): TemporalFeatureSet {
    const timestamp = kline.openTime;
    const date = new Date(timestamp);

    const hour = date.getUTCHours();
    const dayOfWeek = date.getUTCDay();
    const dayOfMonth = date.getUTCDate();
    const month = date.getUTCMonth();

    const hourSin = Math.sin((2 * Math.PI * hour) / 24);
    const hourCos = Math.cos((2 * Math.PI * hour) / 24);
    const dayOfWeekSin = Math.sin((2 * Math.PI * dayOfWeek) / 7);
    const dayOfWeekCos = Math.cos((2 * Math.PI * dayOfWeek) / 7);
    const dayOfMonthSin = Math.sin((2 * Math.PI * dayOfMonth) / 31);
    const dayOfMonthCos = Math.cos((2 * Math.PI * dayOfMonth) / 31);
    const monthSin = Math.sin((2 * Math.PI * month) / 12);
    const monthCos = Math.cos((2 * Math.PI * month) / 12);

    const isAsianSession = this.isInSession(hour, MARKET_SESSION_HOURS.asian) ? 1 : 0;
    const isEuropeanSession = this.isInSession(hour, MARKET_SESSION_HOURS.european) ? 1 : 0;
    const isUsSession = this.isInSession(hour, MARKET_SESSION_HOURS.us) ? 1 : 0;

    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6 ? 1 : 0;

    const daysInMonth = new Date(date.getUTCFullYear(), month + 1, 0).getUTCDate();
    const isMonthEnd = dayOfMonth >= daysInMonth - 2 ? 1 : 0;

    const isQuarterEnd =
      (month === 2 || month === 5 || month === 8 || month === 11) &&
      dayOfMonth >= daysInMonth - 6
        ? 1
        : 0;

    const halvingInfo = this.getHalvingCycleInfo(date);

    return {
      hour_sin: hourSin,
      hour_cos: hourCos,
      day_of_week_sin: dayOfWeekSin,
      day_of_week_cos: dayOfWeekCos,
      day_of_month_sin: dayOfMonthSin,
      day_of_month_cos: dayOfMonthCos,
      month_sin: monthSin,
      month_cos: monthCos,
      is_asian_session: isAsianSession,
      is_european_session: isEuropeanSession,
      is_us_session: isUsSession,
      is_weekend: isWeekend,
      is_month_end: isMonthEnd,
      is_quarter_end: isQuarterEnd,
      halving_cycle_progress: halvingInfo.progress,
      days_from_halving: halvingInfo.daysFromHalving,
      days_to_next_halving: halvingInfo.daysToNextHalving,
    };
  }

  getFeatureNames(): string[] {
    return [...TEMPORAL_FEATURE_NAMES];
  }

  private isInSession(hour: number, session: { start: number; end: number }): boolean {
    if (session.start <= session.end) {
      return hour >= session.start && hour < session.end;
    }
    return hour >= session.start || hour < session.end;
  }

  private getHalvingCycleInfo(date: Date): {
    progress: number;
    daysFromHalving: number;
    daysToNextHalving: number;
  } {
    const currentTime = date.getTime();

    let lastHalving: Date | null = null;
    let nextHalving: Date = NEXT_HALVING_ESTIMATE;

    for (let i = BITCOIN_HALVINGS.length - 1; i >= 0; i--) {
      const halving = BITCOIN_HALVINGS[i];
      if (halving && halving.getTime() <= currentTime) {
        lastHalving = halving;
        if (i < BITCOIN_HALVINGS.length - 1) {
          const next = BITCOIN_HALVINGS[i + 1];
          if (next) nextHalving = next;
        }
        break;
      }
    }

    if (!lastHalving) {
      lastHalving = BITCOIN_HALVINGS[0] ?? new Date('2012-11-28');
    }

    const daysFromHalving = Math.floor(
      (currentTime - lastHalving.getTime()) / MS_PER_DAY
    );
    const daysToNextHalving = Math.max(
      0,
      Math.floor((nextHalving.getTime() - currentTime) / MS_PER_DAY)
    );

    const cycleLength = Math.floor(
      (nextHalving.getTime() - lastHalving.getTime()) / MS_PER_DAY
    );
    const progress = cycleLength > 0 ? daysFromHalving / cycleLength : 0;

    return {
      progress: Math.min(1, Math.max(0, progress)),
      daysFromHalving,
      daysToNextHalving,
    };
  }
}
