import { KELLY_CRITERION } from '../constants';
import type { HistoricalStats, KellyResult } from './types';

export const calculateKellyPercentage = (
  winRate: number,
  avgRiskReward: number
): number => {
  const p = winRate;
  const q = 1 - winRate;
  const b = avgRiskReward;

  return ((p * b - q) / b) * 100;
};

export const calculateKellyCriterion = (
  stats?: HistoricalStats,
  kellyFraction: number = KELLY_CRITERION.FRACTIONAL_KELLY
): KellyResult => {
  const winRate = stats?.winRate ?? KELLY_CRITERION.DEFAULT_WIN_RATE;
  const avgRR = stats?.avgRiskReward ?? KELLY_CRITERION.DEFAULT_AVG_RR;
  const tradeCount = stats?.tradeCount ?? 0;

  const hasEnoughTrades = tradeCount >= KELLY_CRITERION.MIN_TRADES_FOR_STATS;

  const effectiveWinRate = hasEnoughTrades ? winRate : KELLY_CRITERION.DEFAULT_WIN_RATE;
  const effectiveRR = hasEnoughTrades ? avgRR : KELLY_CRITERION.DEFAULT_AVG_RR;

  const rawKelly = calculateKellyPercentage(effectiveWinRate, effectiveRR);

  const constrainedKelly = Math.max(0, Math.min(rawKelly, KELLY_CRITERION.MAX_KELLY_FRACTION * 100));
  const fractionalKelly = constrainedKelly * kellyFraction;

  const isValid = rawKelly > 0;

  const rationale = hasEnoughTrades
    ? `Kelly: WR=${(effectiveWinRate * 100).toFixed(1)}%, R:R=${effectiveRR.toFixed(2)}, Raw=${rawKelly.toFixed(1)}%, Adjusted=${fractionalKelly.toFixed(1)}% (${kellyFraction}x Kelly)`
    : `Using default Kelly values (${tradeCount}/${KELLY_CRITERION.MIN_TRADES_FOR_STATS} trades)`;

  return {
    kellyPercent: fractionalKelly,
    fractionalKelly,
    rawKelly,
    isValid,
    rationale,
  };
};

export const calculateOptimalKellyFraction = (
  winRate: number,
  profitFactor: number,
  maxDrawdownPercent: number
): number => {
  let kellyFraction = KELLY_CRITERION.FRACTIONAL_KELLY;

  if (winRate > 0.5) {
    kellyFraction += 0.05;
  }

  if (profitFactor > 2.0) {
    kellyFraction += 0.1;
  } else if (profitFactor < 1.2) {
    kellyFraction -= 0.1;
  }

  if (maxDrawdownPercent > 20) {
    kellyFraction -= 0.15;
  } else if (maxDrawdownPercent < 5) {
    kellyFraction += 0.05;
  }

  return Math.max(0.1, Math.min(0.5, kellyFraction));
};
