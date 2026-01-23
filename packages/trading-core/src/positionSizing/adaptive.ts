import type { AdaptiveConditions, AdaptiveSizeResult } from './types';

const ADAPTIVE_MULTIPLIERS = {
  DRAWDOWN: {
    SEVERE: { threshold: 20, multiplier: 0.25 },
    HIGH: { threshold: 15, multiplier: 0.50 },
    MODERATE: { threshold: 10, multiplier: 0.75 },
  },
  VOLATILITY: {
    low: 1.15,
    normal: 1.0,
    high: 0.75,
    extreme: 0.50,
  },
  LOSS_STREAK: {
    SEVERE: { threshold: 4, multiplier: 0.50 },
    HIGH: { threshold: 3, multiplier: 0.75 },
  },
  WIN_STREAK: {
    threshold: 4,
    multiplier: 1.1,
    maxDrawdown: 5,
  },
  WIN_RATE: {
    LOW: { threshold: 0.35, multiplier: 0.75 },
    HIGH: { threshold: 0.65, multiplier: 1.15, maxDrawdown: 10 },
  },
  BOUNDS: {
    MIN: 0.25,
    MAX: 1.5,
  },
  POSITION: {
    MIN: 1,
    MAX: 100,
  },
} as const;

export const calculateAdaptiveSize = (
  basePositionPercent: number,
  conditions: AdaptiveConditions
): AdaptiveSizeResult => {
  let multiplier = 1.0;
  const adjustments: string[] = [];

  if (conditions.drawdownPercent >= ADAPTIVE_MULTIPLIERS.DRAWDOWN.SEVERE.threshold) {
    multiplier *= ADAPTIVE_MULTIPLIERS.DRAWDOWN.SEVERE.multiplier;
    adjustments.push(`DD≥20%: ×0.25`);
  } else if (conditions.drawdownPercent >= ADAPTIVE_MULTIPLIERS.DRAWDOWN.HIGH.threshold) {
    multiplier *= ADAPTIVE_MULTIPLIERS.DRAWDOWN.HIGH.multiplier;
    adjustments.push(`DD≥15%: ×0.50`);
  } else if (conditions.drawdownPercent >= ADAPTIVE_MULTIPLIERS.DRAWDOWN.MODERATE.threshold) {
    multiplier *= ADAPTIVE_MULTIPLIERS.DRAWDOWN.MODERATE.multiplier;
    adjustments.push(`DD≥10%: ×0.75`);
  }

  const volMult = ADAPTIVE_MULTIPLIERS.VOLATILITY[conditions.volatilityLevel] ?? 1.0;
  if (volMult !== 1.0) {
    multiplier *= volMult;
    adjustments.push(`Vol=${conditions.volatilityLevel}: ×${volMult}`);
  }

  if (conditions.consecutiveLosses >= ADAPTIVE_MULTIPLIERS.LOSS_STREAK.SEVERE.threshold) {
    multiplier *= ADAPTIVE_MULTIPLIERS.LOSS_STREAK.SEVERE.multiplier;
    adjustments.push(`LossStreak≥4: ×0.50`);
  } else if (conditions.consecutiveLosses >= ADAPTIVE_MULTIPLIERS.LOSS_STREAK.HIGH.threshold) {
    multiplier *= ADAPTIVE_MULTIPLIERS.LOSS_STREAK.HIGH.multiplier;
    adjustments.push(`LossStreak≥3: ×0.75`);
  }

  if (
    conditions.consecutiveWins >= ADAPTIVE_MULTIPLIERS.WIN_STREAK.threshold &&
    conditions.drawdownPercent < ADAPTIVE_MULTIPLIERS.WIN_STREAK.maxDrawdown
  ) {
    multiplier *= ADAPTIVE_MULTIPLIERS.WIN_STREAK.multiplier;
    adjustments.push(`WinStreak≥4: ×1.10`);
  }

  if (conditions.recentWinRate !== undefined) {
    if (conditions.recentWinRate < ADAPTIVE_MULTIPLIERS.WIN_RATE.LOW.threshold) {
      multiplier *= ADAPTIVE_MULTIPLIERS.WIN_RATE.LOW.multiplier;
      adjustments.push(`WR<35%: ×0.75`);
    } else if (
      conditions.recentWinRate > ADAPTIVE_MULTIPLIERS.WIN_RATE.HIGH.threshold &&
      conditions.drawdownPercent < ADAPTIVE_MULTIPLIERS.WIN_RATE.HIGH.maxDrawdown
    ) {
      multiplier *= ADAPTIVE_MULTIPLIERS.WIN_RATE.HIGH.multiplier;
      adjustments.push(`WR>65%: ×1.15`);
    }
  }

  multiplier = Math.max(
    ADAPTIVE_MULTIPLIERS.BOUNDS.MIN,
    Math.min(ADAPTIVE_MULTIPLIERS.BOUNDS.MAX, multiplier)
  );

  const adjustedPercent = basePositionPercent * multiplier;
  const finalPercent = Math.max(
    ADAPTIVE_MULTIPLIERS.POSITION.MIN,
    Math.min(ADAPTIVE_MULTIPLIERS.POSITION.MAX, adjustedPercent)
  );

  const rationale = adjustments.length > 0
    ? `Base: ${basePositionPercent.toFixed(1)}% | ${adjustments.join(' | ')} | Final: ${finalPercent.toFixed(1)}%`
    : `No adjustments needed: ${basePositionPercent.toFixed(1)}%`;

  return {
    adjustedPercent: finalPercent,
    multiplier,
    rationale,
  };
};
