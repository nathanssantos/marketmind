import { calculateSwingPoints } from '../lib/indicators';
import type { FibonacciProjectionData, Interval, Kline as KlineType, TrailingStopOptimizationConfig } from '@marketmind/types';
import { PineIndicatorService } from './pine/PineIndicatorService';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from '../db';
import type { SymbolTrailingStopOverride, TradeExecution } from '../db/schema';
import { autoTradingConfig, klines, setupDetections, symbolTrailingStopOverrides, tradeExecutions } from '../db/schema';
import { serializeError } from '../utils/errors';
import { formatPrice } from '../utils/formatters';
import { logger } from './logger';
import { applyStopLossUpdate } from './trailing-stop-apply';
import {
    calculateProfitPercent,
    shouldUpdateStopLoss,
} from './trailing-stop-core';
import {
    calculateAutoStopOffset,
    computeTrailingStop,
    DEFAULT_TRAILING_STOP_CONFIG,
    resolveTrailingStopConfig,
    type TrailingStopInput,
    type TrailingStopUpdate,
} from './trailing-stop-config';
import { getCurrentPrice } from './trailing-stop-price';
import { calculateATRPercent, getVolatilityProfile } from './volatility-profile';
import { getWebSocketService } from './websocket';

export class TrailingStopService {
  private config: TrailingStopOptimizationConfig;

  constructor(config?: Partial<TrailingStopOptimizationConfig>) {
    this.config = { ...DEFAULT_TRAILING_STOP_CONFIG, ...config };
  }

  updateConfig(config: Partial<TrailingStopOptimizationConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): TrailingStopOptimizationConfig {
    return { ...this.config };
  }

  private getCurrentPrice = getCurrentPrice;
  private applyStopLossUpdate = applyStopLossUpdate;

  async updateTrailingStops(): Promise<TrailingStopUpdate[]> {
    const updates: TrailingStopUpdate[] = [];

    const openExecutions = await db
      .select()
      .from(tradeExecutions)
      .where(eq(tradeExecutions.status, 'open'));

    if (openExecutions.length === 0) return updates;

    const enabledExecutions = await this.filterByTrailingStopEnabled(openExecutions);

    if (enabledExecutions.length === 0) return updates;

    const executionGroups = this.groupExecutionsBySymbol(enabledExecutions);

    for (const [symbol, executions] of executionGroups) {
      try {
        const groupUpdates = await this.processSymbolGroup(symbol, executions);
        updates.push(...groupUpdates);
      } catch (error) {
        logger.error({
          symbol,
          error: serializeError(error),
        }, 'Error processing trailing stops for symbol');
      }
    }

    return updates;
  }

  private async filterByTrailingStopEnabled(executions: TradeExecution[]): Promise<TradeExecution[]> {
    const walletIds = [...new Set(executions.map(e => e.walletId))];

    if (walletIds.length === 0) return executions;

    const configs = await db
      .select({ walletId: autoTradingConfig.walletId, trailingStopEnabled: autoTradingConfig.trailingStopEnabled })
      .from(autoTradingConfig)
      .where(inArray(autoTradingConfig.walletId, walletIds));

    const overrides = await db
      .select()
      .from(symbolTrailingStopOverrides)
      .where(inArray(symbolTrailingStopOverrides.walletId, walletIds));

    const overrideMap = new Map<string, SymbolTrailingStopOverride>();
    for (const override of overrides) {
      overrideMap.set(`${override.walletId}:${override.symbol}`, override);
    }

    const enabledWallets = new Set<string>();
    for (const config of configs) {
      if (config.trailingStopEnabled !== false) {
        enabledWallets.add(config.walletId);
      }
    }

    for (const walletId of walletIds) {
      if (!configs.some(c => c.walletId === walletId)) {
        enabledWallets.add(walletId);
      }
    }

    const filtered = executions.filter(e => {
      const override = overrideMap.get(`${e.walletId}:${e.symbol}`);
      if (override?.useIndividualConfig && override.trailingStopEnabled !== null) {
        return override.trailingStopEnabled;
      }
      return enabledWallets.has(e.walletId);
    });

    return filtered;
  }

  private groupExecutionsBySymbol(executions: TradeExecution[]): Map<string, TradeExecution[]> {
    const groups = new Map<string, TradeExecution[]>();

    for (const execution of executions) {
      const existing = groups.get(execution.symbol) ?? [];
      existing.push(execution);
      groups.set(execution.symbol, existing);
    }

    return groups;
  }

  private async processSymbolGroup(
    symbol: string,
    executions: TradeExecution[]
  ): Promise<TrailingStopUpdate[]> {
    const updates: TrailingStopUpdate[] = [];

    const executionsByInterval = new Map<string, TradeExecution[]>();

    for (const execution of executions) {
      const walletId = execution.walletId;
      const override = await db.query.symbolTrailingStopOverrides.findFirst({
        where: and(
          eq(symbolTrailingStopOverrides.walletId, walletId),
          eq(symbolTrailingStopOverrides.symbol, symbol)
        ),
      });
      const walletCfg = await db.query.autoTradingConfig.findFirst({
        where: eq(autoTradingConfig.walletId, walletId),
      });

      const configuredInterval = override?.useIndividualConfig && override.indicatorInterval
        ? override.indicatorInterval
        : walletCfg?.trailingStopIndicatorInterval ?? null;

      let interval: string;

      if (configuredInterval) {
        interval = configuredInterval;
      } else if (!execution.setupId) {
        interval = '30m';
      } else {
        const setup = await db.query.setupDetections.findFirst({
          where: eq(setupDetections.id, execution.setupId),
        });

        if (!setup) {
          logger.warn({ executionId: execution.id, setupId: execution.setupId }, 'Setup not found for execution');
          continue;
        }

        interval = setup.interval;
      }

      const existing = executionsByInterval.get(interval) ?? [];
      existing.push(execution);
      executionsByInterval.set(interval, existing);
    }

    for (const [interval, groupExecutions] of executionsByInterval) {
      const execMarketType = groupExecutions[0]?.marketType === 'FUTURES' ? 'FUTURES' : 'SPOT';
      const klinesData = await db.query.klines.findMany({
        where: and(
          eq(klines.symbol, symbol),
          eq(klines.interval, interval),
          eq(klines.marketType, execMarketType)
        ),
        orderBy: [desc(klines.openTime)],
        limit: 100,
      });

      if (klinesData.length < 20) continue;

      klinesData.reverse();

      const mappedKlines: KlineType[] = klinesData.map((k) => ({
        symbol: k.symbol,
        interval: k.interval as Interval,
        openTime: k.openTime.getTime(),
        closeTime: k.closeTime.getTime(),
        open: k.open,
        high: k.high,
        low: k.low,
        close: k.close,
        volume: k.volume,
        quoteVolume: k.quoteVolume ?? '0',
        trades: k.trades ?? 0,
        takerBuyBaseVolume: k.takerBuyBaseVolume ?? '0',
        takerBuyQuoteVolume: k.takerBuyQuoteVolume ?? '0',
      }));

      const currentPrice = await this.getCurrentPrice(symbol, execMarketType);
      const { swingPoints } = calculateSwingPoints(mappedKlines, this.config.swingLookback);

      let currentATR: number | undefined;
      if (this.config.useATRMultiplier) {
        const pineService = new PineIndicatorService();
        const atrValues = await pineService.compute('atr', mappedKlines, { period: 14 });
        const lastAtr = atrValues.length > 0 ? atrValues[atrValues.length - 1] : null;
        currentATR = lastAtr !== null ? lastAtr : undefined;
      }

      let effectiveConfig = this.config;
      if (this.config.useVolatilityBasedThresholds && currentATR && currentATR > 0 && currentPrice > 0) {
        const atrPercent = calculateATRPercent(currentATR, currentPrice);
        const marketType = this.config.marketType ?? 'FUTURES';
        const useBnbDiscount = this.config.useBnbDiscount ?? false;
        const profile = getVolatilityProfile(atrPercent, { marketType, useBnbDiscount });

        effectiveConfig = {
          ...this.config,
          atrMultiplier: profile.atrMultiplier,
          minTrailingDistancePercent: profile.minTrailingDistance,
          marketType,
          useBnbDiscount,
        };
      }

      const groupWalletId = groupExecutions[0]?.walletId;
      const symbolOverride = groupWalletId
        ? await db.query.symbolTrailingStopOverrides.findFirst({
            where: and(
              eq(symbolTrailingStopOverrides.walletId, groupWalletId),
              eq(symbolTrailingStopOverrides.symbol, symbol)
            ),
          })
        : null;

      for (const execution of groupExecutions) {
        const walletConfig = await db.query.autoTradingConfig.findFirst({
          where: eq(autoTradingConfig.walletId, execution.walletId),
        });

        const useOverride = symbolOverride?.useIndividualConfig === true;
        const activationMode = execution.side === 'LONG'
          ? (useOverride && symbolOverride?.trailingActivationModeLong !== null
              ? symbolOverride.trailingActivationModeLong
              : walletConfig?.trailingActivationModeLong ?? 'auto')
          : (useOverride && symbolOverride?.trailingActivationModeShort !== null
              ? symbolOverride.trailingActivationModeShort
              : walletConfig?.trailingActivationModeShort ?? 'auto');

        if (activationMode === 'manual') {
          const isLong = execution.side === 'LONG';
          const manualFlag = isLong
            ? (symbolOverride?.manualTrailingActivatedLong ?? false)
            : (symbolOverride?.manualTrailingActivatedShort ?? false);

          if (!manualFlag) {
            const activationPercent = isLong
              ? (symbolOverride?.trailingActivationPercentLong ? parseFloat(symbolOverride.trailingActivationPercentLong) : null)
              : (symbolOverride?.trailingActivationPercentShort ? parseFloat(symbolOverride.trailingActivationPercentShort) : null);

            if (activationPercent && activationPercent > 0 && symbolOverride) {
              const entryPrice = parseFloat(execution.entryPrice);
              const activationPrice = entryPrice * activationPercent;
              const crossed = isLong ? currentPrice >= activationPrice : currentPrice <= activationPrice;

              if (crossed) {
                const flagField = isLong ? 'manualTrailingActivatedLong' : 'manualTrailingActivatedShort';
                await db.update(symbolTrailingStopOverrides)
                  .set({ [flagField]: true, updatedAt: new Date() })
                  .where(eq(symbolTrailingStopOverrides.id, symbolOverride.id));

                logger.info({
                  symbol,
                  side: execution.side,
                  activationPrice,
                  currentPrice,
                  activationPercent,
                }, 'Trailing stop auto-activated: price crossed activation line');

                const wsService = getWebSocketService();
                wsService?.emitRiskAlert(execution.walletId, {
                  type: 'TRAILING_ACTIVATED',
                  level: 'info',
                  symbol,
                  message: `Trailing stop ${execution.side} activated for ${symbol} — price crossed ${formatPrice(activationPrice)}`,
                  data: { side: execution.side, activationPrice, currentPrice },
                  timestamp: Date.now(),
                });
              } else {
                continue;
              }
            } else {
              continue;
            }
          }
        }

        let fibonacciProjection: FibonacciProjectionData | null = null;
        if (execution.fibonacciProjection) {
          try {
            fibonacciProjection = JSON.parse(execution.fibonacciProjection) as FibonacciProjectionData;
          } catch {
            logger.warn({ executionId: execution.id }, 'Failed to parse Fibonacci projection data');
          }
        }

        const useFibonacciThresholds = !!fibonacciProjection?.levels?.length;

        const resolved = resolveTrailingStopConfig(
          execution.side,
          symbolOverride ?? null,
          walletConfig ?? null,
          effectiveConfig
        );

        const executionConfig: TrailingStopOptimizationConfig = {
          ...resolved,
          useFibonacciThresholds,
        };

        const update = this.calculateTrailingStopWithConfig(
          execution,
          currentPrice,
          swingPoints,
          mappedKlines,
          currentATR,
          executionConfig,
          fibonacciProjection
        );

        if (update) {
          let offsetPercent = resolved.trailingStopOffsetPercent ?? 0;
          if (resolved.trailingDistanceMode === 'auto' && currentATR && currentATR > 0 && currentPrice > 0) {
            const atrPct = calculateATRPercent(currentATR, currentPrice);
            offsetPercent = calculateAutoStopOffset(atrPct);
          }

          if (offsetPercent > 0) {
            const isLong = execution.side === 'LONG';
            update.newStopLoss = isLong
              ? update.newStopLoss * (1 - offsetPercent)
              : update.newStopLoss * (1 + offsetPercent);
          }

          const currentStopLoss = execution.stopLoss ? parseFloat(execution.stopLoss) : null;
          if (!shouldUpdateStopLoss(update.newStopLoss, currentStopLoss, execution.side === 'LONG')) continue;

          const profitPct = calculateProfitPercent(parseFloat(execution.entryPrice), currentPrice, execution.side === 'LONG');
          logger.info({
            executionId: execution.id,
            symbol: execution.symbol,
            side: execution.side,
            entryPrice: parseFloat(execution.entryPrice),
            currentPrice,
            profitPercent: `${(profitPct * 100).toFixed(2)}%`,
            oldStopLoss: currentStopLoss,
            newStopLoss: update.newStopLoss,
            reason: update.reason,
            isFirstActivation: update.isFirstActivation,
            offsetPercent: offsetPercent > 0 ? `${(offsetPercent * 100).toFixed(2)}%` : undefined,
          }, 'Trailing stop updated');

          await this.applyStopLossUpdate(execution, update.newStopLoss, update.oldStopLoss, update.isFirstActivation, update.currentExtremePrice);
          updates.push(update);
        }
      }
    }

    return updates;
  }

  private calculateTrailingStopWithConfig(
    execution: TradeExecution,
    currentPrice: number,
    swingPoints: Array<{ index: number; type: 'high' | 'low'; price: number; timestamp: number }>,
    _klines: KlineType[],
    atr: number | undefined,
    config: TrailingStopOptimizationConfig,
    fibonacciProjection: FibonacciProjectionData | null = null
  ): TrailingStopUpdate | null {
    const entryPrice = parseFloat(execution.entryPrice);
    const currentStopLoss = execution.stopLoss ? parseFloat(execution.stopLoss) : null;
    const isLong = execution.side === 'LONG';

    const entryTime = new Date(execution.openedAt).getTime();
    const now = Date.now();

    const klinesFromEntry = _klines.filter(k => k.closeTime > entryTime);

    if (klinesFromEntry.length === 0) return null;

    const entryCandle = klinesFromEntry[0]!;

    if (now < entryCandle.closeTime) return null;

    const klinesForTrailing = klinesFromEntry.slice(1);
    const firstKlineAfterTrailingStarts = klinesForTrailing[0];

    const swingPointsAfterEntry = swingPoints.filter(sp =>
      firstKlineAfterTrailingStarts ? sp.timestamp >= firstKlineAfterTrailingStarts.openTime : sp.timestamp >= entryCandle.closeTime
    );

    let highestPrice: number | undefined;
    let lowestPrice: number | undefined;

    if (execution.trailingActivatedAt) {
      highestPrice = execution.highestPriceSinceTrailingActivation
        ? parseFloat(execution.highestPriceSinceTrailingActivation)
        : currentPrice;
      lowestPrice = execution.lowestPriceSinceTrailingActivation
        ? parseFloat(execution.lowestPriceSinceTrailingActivation)
        : currentPrice;

      if (isLong && currentPrice > highestPrice) {
        highestPrice = currentPrice;
      } else if (!isLong && currentPrice < lowestPrice) {
        lowestPrice = currentPrice;
      }
    } else {
      highestPrice = currentPrice;
      lowestPrice = currentPrice;
    }

    const takeProfit = execution.takeProfit ? parseFloat(execution.takeProfit) : null;

    const input: TrailingStopInput = {
      entryPrice,
      currentPrice,
      currentStopLoss,
      side: execution.side,
      takeProfit,
      swingPoints: swingPointsAfterEntry.map(sp => ({ price: sp.price, type: sp.type })),
      atr,
      highestPrice: isLong ? highestPrice : undefined,
      lowestPrice: isLong ? undefined : lowestPrice,
      fibonacciProjection,
    };

    const result = computeTrailingStop(input, config);

    if (!result) return null;

    const isFirstActivation = !execution.trailingActivatedAt;

    const profitPercent = calculateProfitPercent(entryPrice, currentPrice, execution.side === 'LONG');

    logger.trace({
      executionId: execution.id,
      symbol: execution.symbol,
      side: execution.side,
      entryPrice,
      currentPrice,
      profitPercent: `${(profitPercent * 100).toFixed(2)}%`,
      oldStopLoss: currentStopLoss,
      newStopLoss: result.newStopLoss,
      reason: result.reason,
      isFirstActivation,
    }, 'Trailing stop candidate computed (pre-offset)');

    return {
      executionId: execution.id,
      oldStopLoss: currentStopLoss,
      newStopLoss: result.newStopLoss,
      reason: result.reason,
      isFirstActivation,
      currentExtremePrice: isLong ? highestPrice : lowestPrice,
    };
  }

}

export const trailingStopService = new TrailingStopService();
