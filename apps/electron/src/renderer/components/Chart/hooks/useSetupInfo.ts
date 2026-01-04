import type { TradingSetup } from '@marketmind/types';

export type UrgencyLevel = 'immediate' | 'wait_for_pullback' | 'wait_for_confirmation';
export type UrgencyColor = 'red' | 'orange' | 'green';

export interface SetupInfo {
  isLong: boolean;
  riskRewardRatio: number | null;
}

export const calculateRiskRewardRatio = (
  entryPrice: number,
  stopLoss: number | undefined | null,
  takeProfit: number | undefined | null
): number | null => {
  if (!stopLoss || !takeProfit) return null;

  const risk = Math.abs(entryPrice - stopLoss);
  if (risk === 0) return null;

  const reward = Math.abs(takeProfit - entryPrice);
  return reward / risk;
};

export const getSetupInfo = (setup: TradingSetup | null | undefined): SetupInfo => {
  if (!setup) {
    return {
      isLong: false,
      riskRewardRatio: null,
    };
  }

  return {
    isLong: setup.direction === 'LONG',
    riskRewardRatio: calculateRiskRewardRatio(
      setup.entryPrice,
      setup.stopLoss,
      setup.takeProfit
    ),
  };
};

export const getUrgencyColor = (urgency: string | undefined): UrgencyColor => {
  if (urgency === 'immediate') return 'red';
  if (urgency === 'wait_for_pullback') return 'orange';
  return 'green';
};

export const getUrgencyLabel = (urgency: string | undefined): string => {
  if (urgency === 'immediate') return 'Immediate';
  if (urgency === 'wait_for_pullback') return 'Wait for Pullback';
  return 'Wait for Confirmation';
};
