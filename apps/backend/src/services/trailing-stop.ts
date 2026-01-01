import { calculateATR, calculateSwingPoints } from '@marketmind/indicators';
import type { Interval, Kline as KlineType, MarketType, TrailingStopOptimizationConfig } from '@marketmind/types';
import { BINANCE_FEES, applyBnbDiscount } from '@marketmind/types';
import { and, desc, eq } from 'drizzle-orm';
import { TRAILING_STOP } from '../constants';
import { db } from '../db';
import type { TradeExecution } from '../db/schema';
import { klines, priceCache, setupDetections, tradeExecutions } from '../db/schema';
import { formatPrice } from '../utils/formatters';
import { logger } from './logger';
import { getWebSocketService } from './websocket';
import { calculateATRPercent, getVolatilityProfile } from './volatility-profile';

export interface FeeConfig {
  marketType: MarketType;
  useBnbDiscount?: boolean;
}

export const getRoundTripFee = (config: FeeConfig): number => {
  const fees = config.marketType === 'FUTURES'
    ? BINANCE_FEES.FUTURES.VIP_0
    : BINANCE_FEES.SPOT.VIP_0;

  const takerFee = fees.taker;
  const roundTripFee = takerFee * 2;

  return config.useBnbDiscount
    ? applyBnbDiscount(roundTripFee)
    : roundTripFee;
};

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
  reason: 'breakeven' | 'fees_covered' | 'swing_trail' | 'atr_trail' | 'progressive_trail';
}

export interface TrailingStopInput {
  entryPrice: number;
  currentPrice: number;
  currentStopLoss: number | null;
  side: 'LONG' | 'SHORT';
  swingPoints: Array<{ price: number; type: 'high' | 'low' }>;
  atr?: number;
  highestPrice?: number;
  lowestPrice?: number;
}

export interface TrailingStopResult {
  newStopLoss: number;
  reason: 'breakeven' | 'fees_covered' | 'swing_trail' | 'atr_trail' | 'progressive_trail';
}

export const calculateProfitPercent = (
  entryPrice: number,
  currentPrice: number,
  isLong: boolean
): number => {
  return isLong
    ? (currentPrice - entryPrice) / entryPrice
    : (entryPrice - currentPrice) / entryPrice;
};

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

export const calculateProgressiveFloor = (
  entryPrice: number,
  highestPrice: number | undefined,
  lowestPrice: number | undefined,
  isLong: boolean,
  trailingDistancePercent: number = TRAILING_STOP.PEAK_PROFIT_FLOOR
): number | null => {
  if (isLong) {
    if (highestPrice === undefined || highestPrice <= entryPrice) return null;
    const peakProfit = (highestPrice - entryPrice) / entryPrice;
    const floorProfit = peakProfit * (1 - trailingDistancePercent);
    return entryPrice * (1 + floorProfit);
  } else {
    if (lowestPrice === undefined || lowestPrice >= entryPrice) return null;
    const peakProfit = (entryPrice - lowestPrice) / entryPrice;
    const floorProfit = peakProfit * (1 - trailingDistancePercent);
    return entryPrice * (1 - floorProfit);
  }
};

export const findBestSwingStop = (
  swingPoints: Array<{ price: number; type: 'high' | 'low' }>,
  currentPrice: number,
  entryPrice: number,
  isLong: boolean,
  minDistancePercent: number
): number | null => {
  const relevantSwings = swingPoints.filter(sp =>
    isLong ? sp.type === 'low' : sp.type === 'high'
  );

  const recentSwings = relevantSwings.slice(-5);

  if (isLong) {
    const validSwingLows = recentSwings
      .filter(sp => sp.price < currentPrice && sp.price > entryPrice)
      .sort((a, b) => b.price - a.price);

    logger.debug({
      side: 'LONG',
      recentSwingsCount: recentSwings.length,
      recentSwings: recentSwings.map(s => s.price),
      validSwingLowsCount: validSwingLows.length,
      validSwingLows: validSwingLows.map(s => s.price),
      criteria: `price < ${currentPrice} AND price > ${entryPrice}`,
    }, 'Finding best swing stop for LONG');

    if (validSwingLows.length > 0) {
      const swingLow = validSwingLows[0]!.price;
      const buffer = swingLow * minDistancePercent;
      return swingLow - buffer;
    }
  } else {
    const validSwingHighs = recentSwings
      .filter(sp => sp.price > currentPrice && sp.price < entryPrice)
      .sort((a, b) => a.price - b.price);

    logger.debug({
      side: 'SHORT',
      recentSwingsCount: recentSwings.length,
      recentSwings: recentSwings.map(s => s.price),
      validSwingHighsCount: validSwingHighs.length,
      validSwingHighs: validSwingHighs.map(s => s.price),
      criteria: `price > ${currentPrice} AND price < ${entryPrice}`,
    }, 'Finding best swing stop for SHORT');

    if (validSwingHighs.length > 0) {
      const swingHigh = validSwingHighs[0]!.price;
      const buffer = swingHigh * minDistancePercent;
      return swingHigh + buffer;
    }
  }

  return null;
};

export const shouldUpdateStopLoss = (
  newStopLoss: number,
  currentStopLoss: number | null,
  isLong: boolean
): boolean => {
  if (currentStopLoss === null) return true;
  return isLong ? newStopLoss > currentStopLoss : newStopLoss < currentStopLoss;
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

export const calculateATRTrailingStop = (
  highestOrLowestPrice: number,
  atr: number,
  isLong: boolean,
  atrMultiplier: number
): number => {
  const atrDistance = atr * atrMultiplier;
  return isLong
    ? highestOrLowestPrice - atrDistance
    : highestOrLowestPrice + atrDistance;
};

const calculateATRStop = (
  input: TrailingStopInput,
  config: TrailingStopOptimizationConfig,
  isLong: boolean
): number | null => {
  const { atr, highestPrice, lowestPrice, currentStopLoss } = input;
  if (!config.useATRMultiplier || !atr || atr <= 0) return null;

  const extremePrice = isLong ? highestPrice : lowestPrice;
  if (extremePrice === undefined) return null;

  const candidateAtrStop = calculateATRTrailingStop(extremePrice, atr, isLong, config.atrMultiplier);
  if (!shouldUpdateStopLoss(candidateAtrStop, currentStopLoss, isLong)) return null;

  logger.debug({ extremePrice, atr, atrMultiplier: config.atrMultiplier, atrStop: candidateAtrStop }, 'ATR trailing stop calculated');
  return candidateAtrStop;
};

const selectBestCandidate = (
  candidates: Array<{ price: number; reason: TrailingStopResult['reason'] }>,
  isLong: boolean
): { price: number; reason: TrailingStopResult['reason'] } => {
  return isLong
    ? candidates.reduce((best, c) => c.price > best.price ? c : best)
    : candidates.reduce((best, c) => c.price < best.price ? c : best);
};

export const computeTrailingStop = (
  input: TrailingStopInput,
  config: TrailingStopOptimizationConfig
): TrailingStopResult | null => {
  const { entryPrice, currentPrice, currentStopLoss, side, swingPoints, highestPrice, lowestPrice } = input;
  const isLong = side === 'LONG';

  const profitPercent = calculateProfitPercent(entryPrice, currentPrice, isLong);
  const marketType = config.marketType ?? 'SPOT';
  const useBnbDiscount = config.useBnbDiscount ?? false;
  const dynamicFee = getRoundTripFee({ marketType, useBnbDiscount });
  const feePercent = config.feePercent ?? dynamicFee;
  const feesThreshold = config.breakevenWithFeesThreshold ?? getFeesThresholdForMarketType(marketType, useBnbDiscount);
  const trailingDistancePercent = config.trailingDistancePercent ?? 0.5;

  if (profitPercent < config.breakevenProfitThreshold) {
    return null;
  }

  const breakevenPrice = calculateBreakevenPrice(entryPrice, isLong);
  const feesCoveredPrice = calculateFeesCoveredPrice(entryPrice, isLong, feePercent, marketType, useBnbDiscount);

  if (profitPercent < feesThreshold) {
    if (!shouldUpdateStopLoss(breakevenPrice, currentStopLoss, isLong)) {
      return null;
    }
    logger.debug({
      entryPrice,
      currentPrice,
      profitPercent: (profitPercent * 100).toFixed(2),
      breakevenPrice,
      tier: 1,
    }, 'Tier 1: Moving stop to breakeven');
    return { newStopLoss: breakevenPrice, reason: 'breakeven' };
  }

  const swingStop = findBestSwingStop(swingPoints, currentPrice, entryPrice, isLong, config.minTrailingDistancePercent);
  const atrStop = calculateATRStop(input, config, isLong);
  const progressiveFloor = calculateProgressiveFloor(entryPrice, highestPrice, lowestPrice, isLong, trailingDistancePercent);

  logger.debug({
    entryPrice,
    currentPrice,
    profitPercent: (profitPercent * 100).toFixed(2),
    feesCoveredPrice,
    swingStop,
    atrStop,
    progressiveFloor,
    tier: 'progressive',
  }, 'Trailing stop calculation details');

  const candidates: Array<{ price: number; reason: TrailingStopResult['reason'] }> = [
    { price: feesCoveredPrice, reason: 'fees_covered' },
  ];
  if (swingStop !== null) candidates.push({ price: swingStop, reason: 'swing_trail' });
  if (atrStop !== null) candidates.push({ price: atrStop, reason: 'atr_trail' });
  if (progressiveFloor !== null) candidates.push({ price: progressiveFloor, reason: 'progressive_trail' });

  const bestCandidate = selectBestCandidate(candidates, isLong);

  if (!shouldUpdateStopLoss(bestCandidate.price, currentStopLoss, isLong)) return null;

  return { newStopLoss: bestCandidate.price, reason: bestCandidate.reason };
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

  private async getCurrentPrice(symbol: string, marketType: 'SPOT' | 'FUTURES' = 'SPOT'): Promise<number> {
    try {
      const cacheKey = marketType === 'FUTURES' ? `${symbol}_FUTURES` : symbol;

      const cached = await db.query.priceCache.findFirst({
        where: eq(priceCache.symbol, cacheKey),
      });

      if (cached) {
        const age = Date.now() - cached.timestamp.getTime();
        if (age < 60000) {
          return parseFloat(cached.price);
        }
      }

      let price: number;

      if (marketType === 'FUTURES') {
        const response = await fetch(`https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${symbol}`);
        const data = await response.json() as { markPrice: string };
        price = parseFloat(data.markPrice);
      } else {
        const response = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`);
        const data = await response.json() as { price: string };
        price = parseFloat(data.price);
      }

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
          },
        });

      return price;
    } catch (error) {
      logger.error({ symbol, marketType, error: error instanceof Error ? error.message : String(error) }, 'Failed to fetch current price');
      throw error;
    }
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

    const executionGroups = this.groupExecutionsBySymbol(openExecutions);

    for (const [symbol, executions] of executionGroups) {
      try {
        const groupUpdates = await this.processSymbolGroup(symbol, executions);
        updates.push(...groupUpdates);
      } catch (error) {
        logger.error({
          symbol,
          error: error instanceof Error ? error.message : String(error),
        }, 'Error processing trailing stops for symbol');
      }
    }

    return updates;
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

      }

      for (const execution of groupExecutions) {
        const update = this.calculateTrailingStopWithConfig(
          execution,
          currentPrice,
          swingPoints,
          mappedKlines,
          currentATR,
          effectiveConfig
        );

        if (update) {
          await this.applyStopLossUpdate(execution, update.newStopLoss, update.oldStopLoss);
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
    config: TrailingStopOptimizationConfig
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

    let highestPrice: number | undefined;
    let lowestPrice: number | undefined;

    if (klinesForTrailing.length > 0) {
      highestPrice = Math.max(...klinesForTrailing.map(k => parseFloat(k.high)));
      lowestPrice = Math.min(...klinesForTrailing.map(k => parseFloat(k.low)));
    } else {
      highestPrice = currentPrice;
      lowestPrice = currentPrice;
    }

    const input: TrailingStopInput = {
      entryPrice,
      currentPrice,
      currentStopLoss,
      side: execution.side,
      swingPoints: swingPointsAfterEntry.map(sp => ({ price: sp.price, type: sp.type })),
      atr,
      highestPrice: isLong ? highestPrice : undefined,
      lowestPrice: isLong ? undefined : lowestPrice,
    };

    const result = computeTrailingStop(input, config);

    if (!result) return null;

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
    }, 'Trailing stop updated');

    return {
      executionId: execution.id,
      oldStopLoss: currentStopLoss,
      newStopLoss: result.newStopLoss,
      reason: result.reason,
    };
  }

  private async applyStopLossUpdate(
    execution: TradeExecution,
    newStopLoss: number,
    oldStopLoss: number | null
  ): Promise<void> {
    await db
      .update(tradeExecutions)
      .set({
        stopLoss: newStopLoss.toString(),
        updatedAt: new Date(),
      })
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
