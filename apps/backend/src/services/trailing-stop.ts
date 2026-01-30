import { calculateATR, calculateSwingPoints } from '@marketmind/indicators';
import type { FibonacciProjectionData, Interval, Kline as KlineType, MarketType, TrailingStopOptimizationConfig } from '@marketmind/types';
import { getRoundTripFee } from '@marketmind/types';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { TRAILING_STOP } from '../constants';
import { db } from '../db';
import type { TradeExecution } from '../db/schema';
import { autoTradingConfig, klines, priceCache, setupDetections, tradeExecutions, wallets } from '../db/schema';
import { serializeError } from '../utils/errors';
import { formatPrice } from '../utils/formatters';
import { logger } from './logger';
import { updateStopLossOrder } from './protection-orders';
import {
    calculateProfitPercent,
    computeTrailingStopCore,
    type TrailingStopReason,
} from './trailing-stop-core';
import { calculateATRPercent, getVolatilityProfile } from './volatility-profile';
import { getWebSocketService } from './websocket';

export { getRoundTripFee } from '@marketmind/types';

export const getFeesThresholdForMarketType = (
  marketType: MarketType,
  useBnbDiscount: boolean = false
): number => {
  const roundTripFee = getRoundTripFee({ marketType, useBnbDiscount });
  return roundTripFee + 0.005;
};

export const DEFAULT_TRAILING_STOP_CONFIG: TrailingStopOptimizationConfig = {
  breakevenProfitThreshold: TRAILING_STOP.BREAKEVEN_THRESHOLD,
  breakevenWithFeesThreshold: TRAILING_STOP.FEES_COVERAGE_THRESHOLD,
  minTrailingDistancePercent: 0.002,
  swingLookback: 3,
  useATRMultiplier: true,
  atrMultiplier: 2.0,
  feePercent: getRoundTripFee({ marketType: 'SPOT' }),
  trailingDistancePercent: TRAILING_STOP.PEAK_PROFIT_FLOOR,
  useVolatilityBasedThresholds: true,
  marketType: 'SPOT',
  useBnbDiscount: false,
};

export interface TrailingStopUpdate {
  executionId: string;
  oldStopLoss: number | null;
  newStopLoss: number;
  reason: TrailingStopReason;
  isFirstActivation?: boolean;
  currentExtremePrice?: number;
}

export interface TrailingStopInput {
  entryPrice: number;
  currentPrice: number;
  currentStopLoss: number | null;
  side: 'LONG' | 'SHORT';
  takeProfit?: number | null;
  swingPoints: Array<{ price: number; type: 'high' | 'low' }>;
  atr?: number;
  highestPrice?: number;
  lowestPrice?: number;
  fibonacciProjection?: FibonacciProjectionData | null;
}

export interface TrailingStopResult {
  newStopLoss: number;
  reason: TrailingStopReason;
}

export { calculateATRTrailingStop, calculateProfitPercent, calculateProgressiveFloor, findBestSwingStop, shouldUpdateStopLoss } from './trailing-stop-core';

export const calculateBreakevenPrice = (
  entryPrice: number,
  isLong: boolean,
  buffer: number = 0
): number => {
  return entryPrice * (isLong ? 1 + buffer : 1 - buffer);
};

export const calculateFeesCoveredPrice = (
  entryPrice: number,
  isLong: boolean,
  feePercent?: number,
  marketType: MarketType = 'SPOT',
  useBnbDiscount: boolean = false
): number => {
  const effectiveFee = feePercent ?? getRoundTripFee({ marketType, useBnbDiscount });
  return entryPrice * (isLong ? 1 + effectiveFee : 1 - effectiveFee);
};

export const calculateNewStopLoss = (
  breakevenPrice: number,
  swingStop: number | null,
  isLong: boolean
): number => {
  if (swingStop === null) return breakevenPrice;
  return isLong
    ? Math.max(breakevenPrice, swingStop)
    : Math.min(breakevenPrice, swingStop);
};

export const computeTrailingStop = (
  input: TrailingStopInput,
  config: TrailingStopOptimizationConfig
): TrailingStopResult | null => {
  const { entryPrice, currentPrice, currentStopLoss, side, takeProfit, swingPoints, highestPrice, lowestPrice, atr, fibonacciProjection } = input;
  const isLong = side === 'LONG';
  const marketType = config.marketType ?? 'SPOT';
  const useBnbDiscount = config.useBnbDiscount ?? false;
  const useFibonacciThresholds = config.useFibonacciThresholds ?? false;

  const result = computeTrailingStopCore(
    {
      entryPrice,
      currentPrice,
      currentStopLoss,
      side,
      takeProfit,
      swingPoints,
      atr,
      highestPrice: isLong ? highestPrice : undefined,
      lowestPrice: isLong ? undefined : lowestPrice,
      fibonacciProjection,
    },
    {
      feePercent: config.feePercent,
      marketType,
      useBnbDiscount,
      minTrailingDistancePercent: config.minTrailingDistancePercent,
      atrMultiplier: config.atrMultiplier,
      trailingDistancePercent: config.trailingDistancePercent,
      useFibonacciThresholds,
    }
  );

  if (!result) return null;

  const profitPercent = calculateProfitPercent(entryPrice, currentPrice, isLong);
  logger.debug({
    entryPrice,
    currentPrice,
    profitPercent: `${(profitPercent * 100).toFixed(2)}%`,
    takeProfit,
    newStopLoss: result.newStopLoss,
    reason: result.reason,
  }, 'Trailing stop computed');

  return result;
};

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

  private async fetchPriceFromApi(symbol: string, marketType: 'SPOT' | 'FUTURES'): Promise<number> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      if (marketType === 'FUTURES') {
        const response = await fetch(
          `https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${symbol}`,
          { signal: controller.signal }
        );
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json() as { markPrice: string };
        return parseFloat(data.markPrice);
      } else {
        const response = await fetch(
          `https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`,
          { signal: controller.signal }
        );
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json() as { price: string };
        return parseFloat(data.price);
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async getLastKlinePrice(symbol: string, marketType: 'SPOT' | 'FUTURES'): Promise<number | null> {
    try {
      const lastKline = await db.query.klines.findFirst({
        where: and(
          eq(klines.symbol, symbol),
          eq(klines.marketType, marketType)
        ),
        orderBy: [desc(klines.openTime)],
      });

      if (lastKline) {
        const age = Date.now() - lastKline.openTime.getTime();
        const maxAge = 5 * 60 * 1000;
        if (age < maxAge) {
          return parseFloat(lastKline.close);
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  private async getCurrentPrice(symbol: string, marketType: 'SPOT' | 'FUTURES' = 'SPOT'): Promise<number> {
    const cacheKey = marketType === 'FUTURES' ? `${symbol}_FUTURES` : symbol;
    const maxRetries = 3;
    const retryDelayMs = 1000;

    const cached = await db.query.priceCache.findFirst({
      where: eq(priceCache.symbol, cacheKey),
    });

    if (cached) {
      const age = Date.now() - cached.timestamp.getTime();
      if (age < 60000) {
        return parseFloat(cached.price);
      }
    }

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const price = await this.fetchPriceFromApi(symbol, marketType);

        await db.insert(priceCache)
          .values({
            symbol: cacheKey,
            price: price.toString(),
            timestamp: new Date(),
          })
          .onConflictDoUpdate({
            target: priceCache.symbol,
            set: {
              price: price.toString(),
              timestamp: new Date(),
              updatedAt: new Date(),
            },
          });

        return price;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        logger.warn(
          { symbol, marketType, attempt, maxRetries, error: lastError.message },
          'Price fetch attempt failed, retrying...'
        );

        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, retryDelayMs * attempt));
        }
      }
    }

    const fallbackPrice = await this.getLastKlinePrice(symbol, marketType);
    if (fallbackPrice !== null) {
      logger.info(
        { symbol, marketType, fallbackPrice },
        'Using last kline close price as fallback'
      );
      return fallbackPrice;
    }

    if (cached) {
      logger.warn(
        { symbol, marketType, cachedPrice: cached.price, cacheAge: Date.now() - cached.timestamp.getTime() },
        'Using stale cached price as last resort fallback'
      );
      return parseFloat(cached.price);
    }

    logger.error(
      { symbol, marketType, error: lastError?.message },
      'Failed to fetch current price after all retries and fallbacks'
    );
    throw lastError ?? new Error('Failed to fetch price');
  }

  async updateTrailingStops(): Promise<TrailingStopUpdate[]> {
    const updates: TrailingStopUpdate[] = [];

    const openExecutions = await db
      .select()
      .from(tradeExecutions)
      .where(eq(tradeExecutions.status, 'open'));

    if (openExecutions.length === 0) {
      return updates;
    }

    const enabledExecutions = await this.filterByTrailingStopEnabled(openExecutions);

    if (enabledExecutions.length === 0) {
      return updates;
    }

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

    const filtered = executions.filter(e => enabledWallets.has(e.walletId));

    if (filtered.length < executions.length) {
      const disabledCount = executions.length - filtered.length;
      logger.debug({ disabledCount }, '[TrailingStop] Skipped executions with trailing stop disabled');
    }

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
      if (!execution.setupId) {
        logger.warn({ executionId: execution.id }, 'Trade execution missing setupId, skipping trailing stop');
        continue;
      }

      const setup = await db.query.setupDetections.findFirst({
        where: eq(setupDetections.id, execution.setupId),
      });

      if (!setup) {
        logger.warn({ executionId: execution.id, setupId: execution.setupId }, 'Setup not found for execution');
        continue;
      }

      const interval = setup.interval;
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

      if (klinesData.length < 20) {
        logger.debug({ symbol, interval, count: klinesData.length }, 'Insufficient klines for trailing stop calculation');
        continue;
      }

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

      const atrValues = this.config.useATRMultiplier ? calculateATR(mappedKlines, 14) : [];
      const currentATR = atrValues.length > 0 ? atrValues[atrValues.length - 1] : undefined;

      let effectiveConfig = this.config;
      if (this.config.useVolatilityBasedThresholds && currentATR && currentATR > 0 && currentPrice > 0) {
        const atrPercent = calculateATRPercent(currentATR, currentPrice);
        const marketType = this.config.marketType ?? 'SPOT';
        const useBnbDiscount = this.config.useBnbDiscount ?? false;
        const profile = getVolatilityProfile(atrPercent, { marketType, useBnbDiscount });

        effectiveConfig = {
          ...this.config,
          atrMultiplier: profile.atrMultiplier,
          breakevenProfitThreshold: profile.breakevenThreshold,
          breakevenWithFeesThreshold: profile.feesThreshold,
          minTrailingDistancePercent: profile.minTrailingDistance,
          marketType,
          useBnbDiscount,
        };

        logger.debug({
          symbol,
          interval,
          atrPercent: atrPercent.toFixed(2),
          volatilityLevel: profile.level,
          atrMultiplier: profile.atrMultiplier,
          breakevenThreshold: (profile.breakevenThreshold * 100).toFixed(2),
          minTrailingDistance: (profile.minTrailingDistance * 100).toFixed(3),
        }, '[TrailingStop] Volatility-based profile applied');
      }

      for (const execution of groupExecutions) {
        const walletConfig = await db.query.autoTradingConfig.findFirst({
          where: eq(autoTradingConfig.walletId, execution.walletId),
        });

        let fibonacciProjection: FibonacciProjectionData | null = null;
        if (execution.fibonacciProjection) {
          try {
            fibonacciProjection = JSON.parse(execution.fibonacciProjection) as FibonacciProjectionData;
          } catch {
            logger.warn({ executionId: execution.id }, 'Failed to parse Fibonacci projection data');
          }
        }

        // Enable Fibonacci thresholds when we have a fibonacciProjection available,
        // regardless of tpCalculationMode. This allows trailing activation percentages
        // (e.g., 88.6% for SHORT) to work whenever Fibonacci data is present.
        const useFibonacciThresholds = !!fibonacciProjection?.levels?.length;

        const executionConfig: TrailingStopOptimizationConfig = {
          ...effectiveConfig,
          useFibonacciThresholds,
          activationPercentLong: walletConfig?.trailingActivationPercentLong
            ? parseFloat(walletConfig.trailingActivationPercentLong)
            : undefined,
          activationPercentShort: walletConfig?.trailingActivationPercentShort
            ? parseFloat(walletConfig.trailingActivationPercentShort)
            : undefined,
          trailingDistancePercent: walletConfig?.trailingDistancePercent
            ? parseFloat(walletConfig.trailingDistancePercent)
            : effectiveConfig.trailingDistancePercent,
        };

        logger.debug({
          executionId: execution.id,
          symbol: execution.symbol,
          side: execution.side,
          useFibonacciThresholds,
          activationPercentLong: executionConfig.activationPercentLong,
          activationPercentShort: executionConfig.activationPercentShort,
          trailingDistancePercent: executionConfig.trailingDistancePercent,
        }, '[TrailingStop] Using wallet config for activation thresholds');

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
    klines: KlineType[],
    atr: number | undefined,
    config: TrailingStopOptimizationConfig,
    fibonacciProjection: FibonacciProjectionData | null = null
  ): TrailingStopUpdate | null {
    const entryPrice = parseFloat(execution.entryPrice);
    const currentStopLoss = execution.stopLoss ? parseFloat(execution.stopLoss) : null;
    const isLong = execution.side === 'LONG';

    const entryTime = new Date(execution.openedAt).getTime();
    const now = Date.now();

    const klinesFromEntry = klines.filter(k => k.closeTime > entryTime);

    if (klinesFromEntry.length === 0) {
      return null;
    }

    const entryCandle = klinesFromEntry[0]!;

    if (now < entryCandle.closeTime) {
      logger.debug({
        executionId: execution.id,
        entryCandle: new Date(entryCandle.openTime).toISOString(),
        closesAt: new Date(entryCandle.closeTime).toISOString(),
        now: new Date(now).toISOString(),
      }, 'Trailing stop waiting for entry candle to close');
      return null;
    }

    const klinesForTrailing = klinesFromEntry.slice(1);
    const firstKlineAfterTrailingStarts = klinesForTrailing[0];

    const swingPointsAfterEntry = swingPoints.filter(sp =>
      firstKlineAfterTrailingStarts ? sp.timestamp >= firstKlineAfterTrailingStarts.openTime : sp.timestamp >= entryCandle.closeTime
    );

    // Use extremes since trailing activation, not since entry
    // If trailing hasn't been activated yet, these will be undefined
    let highestPrice: number | undefined;
    let lowestPrice: number | undefined;

    if (execution.trailingActivatedAt) {
      // Trailing already activated - use stored extremes since activation
      highestPrice = execution.highestPriceSinceTrailingActivation
        ? parseFloat(execution.highestPriceSinceTrailingActivation)
        : currentPrice;
      lowestPrice = execution.lowestPriceSinceTrailingActivation
        ? parseFloat(execution.lowestPriceSinceTrailingActivation)
        : currentPrice;

      // Update with current price if it's a new extreme
      if (isLong && currentPrice > highestPrice) {
        highestPrice = currentPrice;
      } else if (!isLong && currentPrice < lowestPrice) {
        lowestPrice = currentPrice;
      }
    } else {
      // Trailing not yet activated - use current price as initial extreme
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

    // If trailing activates for the first time, mark it
    const isFirstActivation = !execution.trailingActivatedAt;

    const profitPercent = calculateProfitPercent(entryPrice, currentPrice, execution.side === 'LONG');

    logger.info({
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
    }, 'Trailing stop updated');

    return {
      executionId: execution.id,
      oldStopLoss: currentStopLoss,
      newStopLoss: result.newStopLoss,
      reason: result.reason,
      isFirstActivation,
      currentExtremePrice: isLong ? highestPrice : lowestPrice,
    };
  }

  private async applyStopLossUpdate(
    execution: TradeExecution,
    newStopLoss: number,
    oldStopLoss: number | null,
    isFirstActivation?: boolean,
    currentExtremePrice?: number
  ): Promise<void> {
    let newAlgoId: number | null = null;

    if (execution.marketType === 'FUTURES' && execution.stopLossAlgoId && execution.stopLossIsAlgo) {
      try {
        const [wallet] = await db.select().from(wallets).where(eq(wallets.id, execution.walletId)).limit(1);

        if (wallet && wallet.walletType === 'live') {
          const result = await updateStopLossOrder({
            wallet,
            symbol: execution.symbol,
            side: execution.side as 'LONG' | 'SHORT',
            quantity: parseFloat(execution.quantity),
            triggerPrice: newStopLoss,
            marketType: 'FUTURES',
            currentAlgoId: execution.stopLossAlgoId,
          });
          newAlgoId = result.algoId ?? null;
          logger.info({ algoId: newAlgoId, executionId: execution.id }, '[TrailingStop] SL order updated via protection-orders service');
        }
      } catch (error) {
        logger.error({ error: serializeError(error), executionId: execution.id }, '[TrailingStop] Failed to update SL order on Binance');
      }
    }

    const isLong = execution.side === 'LONG';

    // Build update object
    const updateData: Record<string, unknown> = {
      stopLoss: newStopLoss.toString(),
      ...(newAlgoId && { stopLossAlgoId: newAlgoId }),
      updatedAt: new Date(),
    };

    // If this is the first trailing activation, save activation timestamp and initial extreme
    if (isFirstActivation) {
      updateData.trailingActivatedAt = new Date();
      if (currentExtremePrice !== undefined) {
        if (isLong) {
          updateData.highestPriceSinceTrailingActivation = currentExtremePrice.toString();
        } else {
          updateData.lowestPriceSinceTrailingActivation = currentExtremePrice.toString();
        }
      }
      logger.info({ executionId: execution.id, currentExtremePrice }, '[TrailingStop] First activation - saving activation data');
    } else if (currentExtremePrice !== undefined) {
      // Update extreme price if it's a new extreme
      if (isLong) {
        const currentHighest = execution.highestPriceSinceTrailingActivation
          ? parseFloat(execution.highestPriceSinceTrailingActivation)
          : 0;
        if (currentExtremePrice > currentHighest) {
          updateData.highestPriceSinceTrailingActivation = currentExtremePrice.toString();
        }
      } else {
        const currentLowest = execution.lowestPriceSinceTrailingActivation
          ? parseFloat(execution.lowestPriceSinceTrailingActivation)
          : Infinity;
        if (currentExtremePrice < currentLowest) {
          updateData.lowestPriceSinceTrailingActivation = currentExtremePrice.toString();
        }
      }
    }

    await db
      .update(tradeExecutions)
      .set(updateData)
      .where(eq(tradeExecutions.id, execution.id));

    const wsService = getWebSocketService();
    if (wsService) {
      const side = execution.side;
      const sideLabel = side === 'LONG' ? 'Long' : 'Short';

      wsService.emitTradeNotification(execution.walletId, {
        type: 'TRAILING_STOP_UPDATED',
        title: '📈 Trailing Stop',
        body: `${sideLabel} ${execution.symbol}: ${oldStopLoss ? formatPrice(oldStopLoss) : '-'} → ${formatPrice(newStopLoss)}`,
        urgency: 'low',
        data: {
          executionId: execution.id,
          symbol: execution.symbol,
          side,
          oldStopLoss: oldStopLoss?.toString(),
          newStopLoss: newStopLoss.toString(),
        },
      });

      wsService.emitPositionUpdate(execution.walletId, {
        id: execution.id,
        status: 'open',
        stopLoss: newStopLoss.toString(),
      });
    }
  }
}

export const trailingStopService = new TrailingStopService();
