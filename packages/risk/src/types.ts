export interface ExposureConfig {
  exposureMultiplier: number;
  maxPositionSizePercent: number;
  maxConcurrentPositions: number;
}

export interface ExposureCalculation {
  exposurePerWatcher: number;
  maxPositionValue: number;
  maxTotalExposure: number;
}

export interface PositionLike {
  entryPrice: number;
  quantity: number;
}

export interface OrderSizeValidation {
  isValid: boolean;
  reason?: string;
  maxAllowed: number;
}

export interface RiskValidationResult {
  isValid: boolean;
  reason?: string;
  details?: {
    currentExposure?: number;
    maxExposure?: number;
    dailyPnL?: number;
    dailyLimit?: number;
    openPositions?: number;
    maxPositions?: number;
  };
}

export interface ExposureInfo {
  totalValue: number;
  maxAllowed: number;
  utilizationPercent: number;
  openPositionsCount: number;
}

export interface DailyPnLInfo {
  pnl: number;
  limit: number;
  percentUsed: number;
}
