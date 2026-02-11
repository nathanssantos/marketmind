import { serializeError } from '../utils/errors';
import {
  calculateDynamicExposure,
  calculatePositionExposure,
  calculateDrawdownPercent,
  type ExposureInfo,
  type RiskValidationResult,
  type DailyPnLInfo,
} from '@marketmind/risk';
import { and, eq, gte } from 'drizzle-orm';
import { RISK_MANAGER } from '../constants';
import { db } from '../db';
import type { AutoTradingConfig } from '../db/schema';
import { tradeExecutions, wallets } from '../db/schema';
import { logger } from './logger';
import { walletLockService } from './wallet-lock';
import { getWebSocketService } from './websocket';

export type { ExposureInfo, RiskValidationResult, DailyPnLInfo, PositionLike } from '@marketmind/risk';

export {
  calculatePositionExposure,
  calculateMaxPositionValue,
  calculateMaxTotalExposure,
  calculateMaxDailyLoss,
  calculateDrawdownPercent,
  validateOrderSizePure,
  calculateExposureUtilization,
  calculateDynamicExposure,
} from '@marketmind/risk';

interface DbPositionLike {
  entryPrice: string;
  quantity: string;
}

const mapDbPositionsToNumeric = (positions: DbPositionLike[]) =>
  positions.map((p) => ({
    entryPrice: parseFloat(p.entryPrice),
    quantity: parseFloat(p.quantity),
  }));

export class RiskManagerService {
  async validateNewPositionLocked(
    walletId: string,
    config: AutoTradingConfig,
    positionValue: number,
    activeWatchersCount?: number
  ): Promise<RiskValidationResult> {
    const release = await walletLockService.acquire(walletId);
    try {
      return await this.validateNewPosition(walletId, config, positionValue, activeWatchersCount);
    } finally {
      release();
    }
  }

  async validateNewPosition(
    walletId: string,
    config: AutoTradingConfig,
    positionValue: number,
    activeWatchersCount?: number
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
      const leverage = config.leverage ?? 1;

      const openPositions = await this.getOpenPositions(walletId);

      const effectiveMaxPositions = activeWatchersCount ?? config.maxConcurrentPositions;

      if (openPositions.length >= effectiveMaxPositions) {
        return {
          isValid: false,
          reason: `Maximum concurrent positions reached (${effectiveMaxPositions})`,
          details: {
            openPositions: openPositions.length,
            maxPositions: effectiveMaxPositions,
          },
        };
      }

      const maxPositionSize = parseFloat(config.maxPositionSize);
      const positionSizePercent = parseFloat(config.positionSizePercent ?? '10');
      const maxGlobalExposurePercent = parseFloat(config.maxGlobalExposurePercent ?? '100');

      const { maxTotalExposure: dynamicMaxExposure } = calculateDynamicExposure(
        walletBalance,
        activeWatchersCount ?? 0,
        {
          positionSizePercent,
          maxPositionSizePercent: maxPositionSize,
          maxConcurrentPositions: config.maxConcurrentPositions,
        }
      );

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

      const currentExposure = calculatePositionExposure(mapDbPositionsToNumeric(openPositions));
      const totalExposure = currentExposure + positionValue;

      const globalExposureLimit = (walletBalance * maxGlobalExposurePercent) / 100;
      const leveragedMaxExposure = leverage > 1 ? walletBalance * leverage : globalExposureLimit;
      const absoluteMaxExposure = Math.min(globalExposureLimit, leveragedMaxExposure);

      const maxTotalExposure = Math.min(dynamicMaxExposure, absoluteMaxExposure);

      if (totalExposure > maxTotalExposure) {
        const leverageInfo = leverage > 1 ? ` with ${leverage}x leverage` : '';
        return {
          isValid: false,
          reason: `Total exposure would exceed maximum (${maxTotalExposure.toFixed(2)} ${wallet.currency}${leverageInfo})`,
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

      const maxDrawdownPercent = parseFloat(config.maxDrawdownPercent || '15');
      const drawdownResult = await this.validateDrawdownForNewPosition(walletId, maxDrawdownPercent);
      if (!drawdownResult.isValid) {
        return drawdownResult;
      }

      return { isValid: true };
    } catch (error) {
      logger.error({
        walletId,
        error: serializeError(error),
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
      const totalValue = calculatePositionExposure(mapDbPositionsToNumeric(openPositions));
      const walletBalance = parseFloat(wallet.currentBalance || '0');

      const maxAllowed = walletBalance * (RISK_MANAGER.MAX_EXPOSURE_PERCENT / 100);

      return {
        totalValue,
        maxAllowed,
        utilizationPercent: maxAllowed > 0 ? (totalValue / maxAllowed) * 100 : 0,
        openPositionsCount: openPositions.length,
      };
    } catch (error) {
      logger.error({
        walletId,
        error: serializeError(error),
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
        error: serializeError(error),
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

      const drawdown = calculateDrawdownPercent(initialBalance, currentBalance);

      return {
        currentDrawdown: drawdown,
        maxDrawdown: maxDrawdownPercent,
        isExceeded: drawdown > maxDrawdownPercent,
      };
    } catch (error) {
      logger.error({
        walletId,
        error: serializeError(error),
      }, 'Error checking drawdown');
      return {
        currentDrawdown: 0,
        maxDrawdown: maxDrawdownPercent,
        isExceeded: false,
      };
    }
  }

  async validateDrawdownForNewPosition(
    walletId: string,
    maxDrawdownPercent: number
  ): Promise<RiskValidationResult> {
    const drawdownCheck = await this.checkDrawdown(walletId, maxDrawdownPercent);

    if (drawdownCheck.isExceeded) {
      const wsService = getWebSocketService();
      if (wsService) {
        wsService.emitRiskAlert(walletId, {
          type: 'MAX_DRAWDOWN',
          level: 'critical',
          message: `Max drawdown exceeded: ${drawdownCheck.currentDrawdown.toFixed(2)}% (limit: ${maxDrawdownPercent}%)`,
          data: {
            currentDrawdown: drawdownCheck.currentDrawdown,
            maxDrawdown: maxDrawdownPercent,
          },
          timestamp: Date.now(),
        });
      }

      logger.warn(
        {
          walletId,
          currentDrawdown: drawdownCheck.currentDrawdown.toFixed(2),
          maxDrawdown: maxDrawdownPercent,
        },
        '[RiskManager] Max drawdown exceeded - blocking new positions'
      );

      return {
        isValid: false,
        reason: `Maximum drawdown limit exceeded (${drawdownCheck.currentDrawdown.toFixed(2)}% > ${maxDrawdownPercent}%)`,
        details: {
          currentExposure: drawdownCheck.currentDrawdown,
          maxExposure: maxDrawdownPercent,
        },
      };
    }

    return { isValid: true };
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
