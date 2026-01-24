import type { RiskRewardInput, RiskRewardResult } from './types';

const DEFAULT_MIN_RISK_REWARD_RATIO = 1.0;

export const validateRiskReward = (input: RiskRewardInput): RiskRewardResult => {
  const { entryPrice, stopLoss, takeProfit, direction, minRiskRewardRatio = DEFAULT_MIN_RISK_REWARD_RATIO } = input;

  if (!stopLoss || !takeProfit) {
    return {
      isValid: true,
      riskRewardRatio: null,
      risk: null,
      reward: null,
      reason: 'No SL/TP defined - skipping R:R check',
    };
  }

  let risk: number;
  let reward: number;

  if (direction === 'LONG') {
    risk = entryPrice - stopLoss;
    reward = takeProfit - entryPrice;
  } else {
    risk = stopLoss - entryPrice;
    reward = entryPrice - takeProfit;
  }

  if (risk <= 0) {
    return {
      isValid: true,
      riskRewardRatio: null,
      risk,
      reward,
      reason: 'Invalid risk value (non-positive)',
    };
  }

  const riskRewardRatio = reward / risk;

  if (riskRewardRatio < minRiskRewardRatio) {
    return {
      isValid: false,
      riskRewardRatio,
      risk,
      reward,
      reason: `R:R ${riskRewardRatio.toFixed(2)}:1 below minimum ${minRiskRewardRatio}:1`,
    };
  }

  return {
    isValid: true,
    riskRewardRatio,
    risk,
    reward,
  };
};
