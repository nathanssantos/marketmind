import { and, eq, gte } from 'drizzle-orm';
import { db } from '../db';
import type { AutoTradingConfig } from '../db/schema';
import { tradeExecutions, wallets } from '../db/schema';
import { logger } from './logger';

export interface PositionLike {
  entryPrice: string;
  quantity: string;
}

export const calculatePositionExposure = (positions: PositionLike[]): number => {
  return positions.reduce((total, position) => {
    const entryPrice = parseFloat(position.entryPrice);
    const quantity = parseFloat(position.quantity);
    return total + entryPrice * quantity;
  }, 0);
};

export const calculateMaxPositionValue = (
  walletBalance: number,
  maxPositionSizePercent: number
): number => {
  return (walletBalance * maxPositionSizePercent) / 100;
};

export const calculateMaxTotalExposure = (
  walletBalance: number,
  maxPositionSizePercent: number,
  maxConcurrentPositions: number
): number => {
  return (walletBalance * maxPositionSizePercent * maxConcurrentPositions) / 100;
};

export const calculateMaxDailyLoss = (
  walletBalance: number,
  dailyLossLimitPercent: number
): number => {
  return (walletBalance * dailyLossLimitPercent) / 100;
};

export const calculateDrawdownPercent = (
  initialBalance: number,
  currentBalance: number
): number => {
  if (initialBalance <= 0) return 0;
  return ((initialBalance - currentBalance) / initialBalance) * 100;
};

export const validateOrderSizePure = (
  walletBalance: number,
  orderValue: number,
  maxPositionSizePercent: number
): { isValid: boolean; reason?: string; maxAllowed: number } => {
  const maxAllowed = (walletBalance * maxPositionSizePercent) / 100;

  if (orderValue > maxAllowed) {
    return {
      isValid: false,
      reason: `Order size ${orderValue.toFixed(2)} exceeds maximum ${maxAllowed.toFixed(2)}`,
      maxAllowed,
    };
  }

  return { isValid: true, maxAllowed };
};

export const calculateExposureUtilization = (
  totalValue: number,
  maxAllowed: number
): number => {
  return maxAllowed > 0 ? (totalValue / maxAllowed) * 100 : 0;
};

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

export class RiskManagerService {
  async validateNewPosition(
    walletId: string,
    config: AutoTradingConfig,
    positionValue: number
  ): Promise<RiskValidationResult> {
    try {
      const [wallet] = await db
        .select()
        .from(wallets)
        .where(eq(wallets.id, walletId))
        .limit(1);

      if (!wallet) {
        return {
          isValid: false,
          reason: 'Wallet not found',
        };
      }

      const walletBalance = parseFloat(wallet.currentBalance || '0');

      const openPositions = await this.getOpenPositions(walletId);
      if (openPositions.length >= config.maxConcurrentPositions) {
        return {
          isValid: false,
          reason: `Maximum concurrent positions reached (${config.maxConcurrentPositions})`,
          details: {
            openPositions: openPositions.length,
            maxPositions: config.maxConcurrentPositions,
          },
        };
      }

      const maxPositionSize = parseFloat(config.maxPositionSize);
      const maxPositionValue = (walletBalance * maxPositionSize) / 100;

      if (positionValue > maxPositionValue) {
        return {
          isValid: false,
          reason: `Position size exceeds maximum allowed (${maxPositionValue.toFixed(2)} ${wallet.currency})`,
          details: {
            currentExposure: positionValue,
            maxExposure: maxPositionValue,
          },
        };
      }

      const currentExposure = this.calculateTotalExposure(openPositions);
      const totalExposure = currentExposure + positionValue;
      const maxTotalExposure =
        (walletBalance * maxPositionSize * config.maxConcurrentPositions) / 100;

      if (totalExposure > maxTotalExposure) {
        return {
          isValid: false,
          reason: `Total exposure would exceed maximum (${maxTotalExposure.toFixed(2)} ${wallet.currency})`,
          details: {
            currentExposure: totalExposure,
            maxExposure: maxTotalExposure,
          },
        };
      }

      const dailyPnL = await this.calculateDailyPnL(walletId);
      const dailyLossLimit = parseFloat(config.dailyLossLimit);
      const maxDailyLoss = (walletBalance * dailyLossLimit) / 100;

      if (dailyPnL < -maxDailyLoss) {
        return {
          isValid: false,
          reason: `Daily loss limit reached (-${maxDailyLoss.toFixed(2)} ${wallet.currency})`,
          details: {
            dailyPnL,
            dailyLimit: -maxDailyLoss,
          },
        };
      }

      return { isValid: true };
    } catch (error) {
      logger.error({
        walletId,
        error: error instanceof Error ? error.message : String(error),
      }, 'Error validating new position');
      return {
        isValid: false,
        reason: 'Error validating position',
      };
    }
  }

  async getCurrentExposure(walletId: string): Promise<ExposureInfo> {
    try {
      const [wallet] = await db
        .select()
        .from(wallets)
        .where(eq(wallets.id, walletId))
        .limit(1);

      if (!wallet) {
        return {
          totalValue: 0,
          maxAllowed: 0,
          utilizationPercent: 0,
          openPositionsCount: 0,
        };
      }

      const openPositions = await this.getOpenPositions(walletId);
      const totalValue = this.calculateTotalExposure(openPositions);
      const walletBalance = parseFloat(wallet.currentBalance || '0');

      const maxAllowed = walletBalance * 0.5;

      return {
        totalValue,
        maxAllowed,
        utilizationPercent: maxAllowed > 0 ? (totalValue / maxAllowed) * 100 : 0,
        openPositionsCount: openPositions.length,
      };
    } catch (error) {
      logger.error({
        walletId,
        error: error instanceof Error ? error.message : String(error),
      }, 'Error getting current exposure');
      return {
        totalValue: 0,
        maxAllowed: 0,
        utilizationPercent: 0,
        openPositionsCount: 0,
      };
    }
  }

  async getDailyPnL(walletId: string): Promise<DailyPnLInfo> {
    try {
      const [wallet] = await db
        .select()
        .from(wallets)
        .where(eq(wallets.id, walletId))
        .limit(1);

      if (!wallet) {
        return {
          pnl: 0,
          limit: 0,
          percentUsed: 0,
        };
      }

      const dailyPnL = await this.calculateDailyPnL(walletId);
      const walletBalance = parseFloat(wallet.currentBalance || '0');
      const limit = walletBalance * 0.05;

      return {
        pnl: dailyPnL,
        limit: -limit,
        percentUsed: limit > 0 ? Math.abs(dailyPnL / limit) * 100 : 0,
      };
    } catch (error) {
      logger.error({
        walletId,
        error: error instanceof Error ? error.message : String(error),
      }, 'Error getting daily PnL');
      return {
        pnl: 0,
        limit: 0,
        percentUsed: 0,
      };
    }
  }

  private async getOpenPositions(walletId: string) {
    return db
      .select()
      .from(tradeExecutions)
      .where(
        and(eq(tradeExecutions.walletId, walletId), eq(tradeExecutions.status, 'open'))
      );
  }

  private calculateTotalExposure(positions: typeof tradeExecutions.$inferSelect[]): number {
    return positions.reduce((total, position) => {
      const entryPrice = parseFloat(position.entryPrice);
      const quantity = parseFloat(position.quantity);
      return total + entryPrice * quantity;
    }, 0);
  }

  private async calculateDailyPnL(walletId: string): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const closedToday = await db
      .select()
      .from(tradeExecutions)
      .where(
        and(
          eq(tradeExecutions.walletId, walletId),
          eq(tradeExecutions.status, 'closed'),
          gte(tradeExecutions.closedAt, today)
        )
      );

    return closedToday.reduce((total, execution) => {
      const pnl = execution.pnl ? parseFloat(execution.pnl) : 0;
      return total + pnl;
    }, 0);
  }

  async checkDrawdown(walletId: string, maxDrawdownPercent: number): Promise<{
    currentDrawdown: number;
    maxDrawdown: number;
    isExceeded: boolean;
  }> {
    try {
      const [wallet] = await db
        .select()
        .from(wallets)
        .where(eq(wallets.id, walletId))
        .limit(1);

      if (!wallet) {
        return {
          currentDrawdown: 0,
          maxDrawdown: 0,
          isExceeded: false,
        };
      }

      const initialBalance = parseFloat(wallet.initialBalance || '0');
      const currentBalance = parseFloat(wallet.currentBalance || '0');

      const drawdown =
        initialBalance > 0 ? ((initialBalance - currentBalance) / initialBalance) * 100 : 0;

      return {
        currentDrawdown: drawdown,
        maxDrawdown: maxDrawdownPercent,
        isExceeded: drawdown > maxDrawdownPercent,
      };
    } catch (error) {
      logger.error({
        walletId,
        error: error instanceof Error ? error.message : String(error),
      }, 'Error checking drawdown');
      return {
        currentDrawdown: 0,
        maxDrawdown: maxDrawdownPercent,
        isExceeded: false,
      };
    }
  }

  async validateOrderSize(
    walletBalance: number,
    orderValue: number,
    maxPositionSizePercent: number
  ): Promise<RiskValidationResult> {
    const maxAllowed = (walletBalance * maxPositionSizePercent) / 100;

    if (orderValue > maxAllowed) {
      return {
        isValid: false,
        reason: `Order size ${orderValue.toFixed(2)} exceeds maximum ${maxAllowed.toFixed(2)}`,
      };
    }

    return { isValid: true };
  }
}

export const riskManagerService = new RiskManagerService();
