import type { PositionSide } from '@marketmind/types';
import { AUTO_TRADING_LIQUIDATION } from '../../constants';

export const LIQUIDATION_THRESHOLDS = {
  WARNING: AUTO_TRADING_LIQUIDATION.WARNING_THRESHOLD,
  DANGER: AUTO_TRADING_LIQUIDATION.DANGER_THRESHOLD,
  CRITICAL: AUTO_TRADING_LIQUIDATION.CRITICAL_THRESHOLD,
} as const;

export type LiquidationRiskLevel = 'safe' | 'warning' | 'danger' | 'critical';

export interface LiquidationRiskCheck {
  executionId: string;
  symbol: string;
  side: PositionSide;
  markPrice: number;
  liquidationPrice: number;
  distancePercent: number;
  riskLevel: LiquidationRiskLevel;
}

export interface PositionCheckResult {
  executionId: string;
  symbol: string;
  action: 'STOP_LOSS' | 'TAKE_PROFIT' | 'NONE';
  currentPrice: number;
  triggerPrice?: number;
}
