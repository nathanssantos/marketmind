import { and, eq } from 'drizzle-orm';
import { db } from '../db';
import { autoTradingConfig, tradeExecutions, wallets, type Wallet } from '../db/schema';
import {
  createBinanceFuturesClient,
  getPosition,
  modifyIsolatedPositionMargin,
  isPaperWallet,
} from './binance-futures-client';
import { logger, serializeError } from './logger';
import { getWebSocketService } from './websocket';

interface MarginTopUpConfig {
  enabled: boolean;
  threshold: number;
  topUpPercent: number;
  maxTopUps: number;
}

interface MarginCheckResult {
  executionId: string;
  symbol: string;
  marginRatio: number;
  needsTopUp: boolean;
  topUpAmount?: number;
  currentTopUpCount: number;
  maxTopUps: number;
}

export class MarginManagerService {
  private checkInterval: ReturnType<typeof setInterval> | null = null;
  private readonly CHECK_INTERVAL_MS = 30000;
  private isRunning = false;
  private processingExecutions: Set<string> = new Set();

  start(): void {
    if (this.isRunning) {
      logger.warn('[MarginManager] Service already running');
      return;
    }

    this.isRunning = true;
    logger.info('[MarginManager] Starting Margin Manager service');

    this.checkInterval = setInterval(() => {
      void this.checkAllIsolatedMargins();
    }, this.CHECK_INTERVAL_MS);

    void this.checkAllIsolatedMargins();
  }

  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.isRunning = false;
    logger.info('[MarginManager] Service stopped');
  }

  private async getMarginTopUpConfig(walletId: string): Promise<MarginTopUpConfig | null> {
    try {
      const [config] = await db
        .select()
        .from(autoTradingConfig)
        .where(eq(autoTradingConfig.walletId, walletId))
        .limit(1);

      if (!config || !config.marginTopUpEnabled) {
        return null;
      }

      return {
        enabled: config.marginTopUpEnabled ?? false,
        threshold: parseFloat(config.marginTopUpThreshold || '30') / 100,
        topUpPercent: parseFloat(config.marginTopUpPercent || '10') / 100,
        maxTopUps: config.marginTopUpMaxCount ?? 3,
      };
    } catch (error) {
      logger.error(
        { walletId, error: serializeError(error) },
        '[MarginManager] Error getting margin top-up config'
      );
      return null;
    }
  }

  async checkAllIsolatedMargins(): Promise<void> {
    try {
      const openFuturesExecutions = await db
        .select()
        .from(tradeExecutions)
        .where(
          and(
            eq(tradeExecutions.status, 'open'),
            eq(tradeExecutions.marketType, 'FUTURES')
          )
        );

      if (openFuturesExecutions.length === 0) {
        return;
      }

      const walletIds = [...new Set(openFuturesExecutions.map(e => e.walletId))];

      for (const walletId of walletIds) {
        try {
          const config = await this.getMarginTopUpConfig(walletId);
          if (!config || !config.enabled) continue;

          const [wallet] = await db
            .select()
            .from(wallets)
            .where(eq(wallets.id, walletId))
            .limit(1);

          if (!wallet || isPaperWallet(wallet)) continue;

          const walletExecutions = openFuturesExecutions.filter(e => e.walletId === walletId);

          for (const execution of walletExecutions) {
            await this.checkAndTopUpMargin(wallet, execution, config);
          }
        } catch (error) {
          logger.error(
            { walletId, error: serializeError(error) },
            '[MarginManager] Error checking wallet margins'
          );
        }
      }
    } catch (error) {
      logger.error(
        { error: serializeError(error) },
        '[MarginManager] Error in checkAllIsolatedMargins'
      );
    }
  }

  private async checkAndTopUpMargin(
    wallet: Wallet,
    execution: typeof tradeExecutions.$inferSelect,
    config: MarginTopUpConfig
  ): Promise<MarginCheckResult | null> {
    if (this.processingExecutions.has(execution.id)) {
      return null;
    }

    this.processingExecutions.add(execution.id);

    try {
      const currentTopUpCount = execution.marginTopUpCount ?? 0;

      if (currentTopUpCount >= config.maxTopUps) {
        logger.debug(
          { executionId: execution.id, currentTopUpCount, maxTopUps: config.maxTopUps },
          '[MarginManager] Max top-ups reached for this position'
        );
        return {
          executionId: execution.id,
          symbol: execution.symbol,
          marginRatio: 0,
          needsTopUp: false,
          currentTopUpCount,
          maxTopUps: config.maxTopUps,
        };
      }

      const client = createBinanceFuturesClient(wallet);
      const position = await getPosition(client, execution.symbol);

      if (!position) {
        return null;
      }

      if (position.marginType !== 'ISOLATED') {
        return null;
      }

      const isolatedWallet = parseFloat(position.isolatedWallet || '0');
      const notional = parseFloat(position.notional || '0');
      const maintMargin = this.calculateMaintenanceMargin(notional);

      if (isolatedWallet <= 0 || maintMargin <= 0) {
        return null;
      }

      const marginRatio = maintMargin / isolatedWallet;

      const result: MarginCheckResult = {
        executionId: execution.id,
        symbol: execution.symbol,
        marginRatio,
        needsTopUp: marginRatio >= config.threshold,
        currentTopUpCount,
        maxTopUps: config.maxTopUps,
      };

      if (result.needsTopUp) {
        const walletBalance = parseFloat(wallet.currentBalance || '0');
        const topUpAmount = walletBalance * config.topUpPercent;

        if (topUpAmount < 1) {
          logger.warn(
            { executionId: execution.id, topUpAmount, walletBalance },
            '[MarginManager] Top-up amount too small'
          );
          return result;
        }

        result.topUpAmount = topUpAmount;

        logger.info(
          {
            executionId: execution.id,
            symbol: execution.symbol,
            marginRatio: (marginRatio * 100).toFixed(2) + '%',
            threshold: (config.threshold * 100).toFixed(2) + '%',
            topUpAmount: topUpAmount.toFixed(2),
            currentTopUpCount,
          },
          '[MarginManager] ⚠️ Margin ratio exceeded threshold - initiating top-up'
        );

        try {
          await modifyIsolatedPositionMargin(
            client,
            execution.symbol,
            topUpAmount,
            '1',
            execution.positionSide as 'LONG' | 'SHORT' | 'BOTH' | undefined
          );

          await db
            .update(tradeExecutions)
            .set({
              marginTopUpCount: currentTopUpCount + 1,
              updatedAt: new Date(),
            })
            .where(eq(tradeExecutions.id, execution.id));

          const newBalance = walletBalance - topUpAmount;
          await db
            .update(wallets)
            .set({
              currentBalance: newBalance.toString(),
              updatedAt: new Date(),
            })
            .where(eq(wallets.id, wallet.id));

          const wsService = getWebSocketService();
          if (wsService) {
            wsService.emitRiskAlert(wallet.id, {
              type: 'MARGIN_TOP_UP',
              level: 'warning',
              positionId: execution.id,
              symbol: execution.symbol,
              message: `Added ${topUpAmount.toFixed(2)} USDT margin to ${execution.symbol} position`,
              data: {
                amount: topUpAmount,
                newTopUpCount: currentTopUpCount + 1,
                maxTopUps: config.maxTopUps,
                marginRatio: marginRatio * 100,
              },
              timestamp: Date.now(),
            });

            wsService.emitWalletUpdate(wallet.id, {
              reason: 'MARGIN_TOP_UP',
              newBalance,
            });
          }

          logger.info(
            {
              executionId: execution.id,
              symbol: execution.symbol,
              topUpAmount,
              newTopUpCount: currentTopUpCount + 1,
              newWalletBalance: newBalance.toFixed(2),
            },
            '[MarginManager] ✅ Margin top-up completed successfully'
          );
        } catch (topUpError) {
          logger.error(
            {
              executionId: execution.id,
              symbol: execution.symbol,
              topUpAmount,
              error: serializeError(topUpError),
            },
            '[MarginManager] Failed to add margin'
          );
        }
      }

      return result;
    } catch (error) {
      logger.error(
        {
          executionId: execution.id,
          error: serializeError(error),
        },
        '[MarginManager] Error checking margin for execution'
      );
      return null;
    } finally {
      this.processingExecutions.delete(execution.id);
    }
  }

  private calculateMaintenanceMargin(notional: number): number {
    const absNotional = Math.abs(notional);
    const maintMarginRate = this.getMaintenanceMarginRate(absNotional);
    return absNotional * maintMarginRate;
  }

  private getMaintenanceMarginRate(notional: number): number {
    if (notional <= 10000) return 0.004;
    if (notional <= 50000) return 0.005;
    if (notional <= 250000) return 0.01;
    if (notional <= 1000000) return 0.025;
    if (notional <= 5000000) return 0.05;
    if (notional <= 20000000) return 0.10;
    if (notional <= 50000000) return 0.125;
    if (notional <= 100000000) return 0.15;
    return 0.25;
  }
}

export const marginManagerService = new MarginManagerService();
