import type { MarketType, PositionSide } from '@marketmind/types';
import { getRoundTripFee } from '@marketmind/types';
import { and, eq, sql } from 'drizzle-orm';
import { AUTO_TRADING_KELLY } from '../constants';
import { db } from '../db';
import type { AutoTradingConfig, SetupDetection, Wallet } from '../db/schema';
import { klines, tradeExecutions } from '../db/schema';
import { serializeError } from '../utils/errors';
import { mapDbKlinesReversed } from '../utils/kline-mapper';
import {
  calculateVolatilityAdjustment as calculateVolatilityAdjustmentCore,
  validateMinNotional,
  VOLATILITY_DEFAULTS,
} from '../utils/trade-validation';
import { logger } from './logger';
import {
  executeBinanceOrder as executeBinanceOrderImpl,
  closePosition as closePositionImpl,
  setFuturesLeverage as setFuturesLeverageImpl,
  setFuturesMarginType as setFuturesMarginTypeImpl,
  setFuturesPositionMode as setFuturesPositionModeImpl,
} from './binance-order-executor';
import { createStopLossOrder as createSLOrder, createTakeProfitOrder as createTPOrder } from './protection-orders';

export interface AlgoOrderResult {
  algoId: string;
  isAlgoOrder: true;
}

export interface RegularOrderResult {
  orderId: string;
  isAlgoOrder: false;
}

export type OrderResult = AlgoOrderResult | RegularOrderResult;

export interface OrderParams {
  symbol: string;
  side: 'BUY' | 'SELL';
  type: 'LIMIT' | 'MARKET' | 'STOP_LOSS_LIMIT' | 'STOP_MARKET' | 'TAKE_PROFIT_MARKET';
  quantity: number;
  price?: number;
  stopPrice?: number;
  timeInForce?: 'GTC' | 'IOC' | 'FOK';
  reduceOnly?: boolean;
}

export interface RiskValidationResult {
  isValid: boolean;
  reason?: string;
}

export interface PositionSizeCalculation {
  quantity: number;
  notionalValue: number;
  riskAmount: number;
}

export class AutoTradingService {
  async createOrderFromSetup(
    setup: SetupDetection,
    config: AutoTradingConfig,
    walletBalance: number
  ): Promise<OrderParams> {
    const entryPrice = parseFloat(setup.entryPrice);
    const stopLoss = setup.stopLoss ? parseFloat(setup.stopLoss) : entryPrice * 0.98;

    const positionSize = await this.calculatePositionSize(
      config, walletBalance, entryPrice, stopLoss,
      setup.setupType, setup.symbol, setup.interval
    );

    const side = setup.direction === 'LONG' ? 'BUY' : 'SELL';

    return {
      symbol: setup.symbol,
      side,
      type: 'LIMIT',
      quantity: positionSize.quantity,
      price: entryPrice,
      timeInForce: 'GTC',
    };
  }

  async calculatePositionSize(
    config: AutoTradingConfig,
    walletBalance: number,
    entryPrice: number,
    stopLoss: number,
    setupType?: string,
    symbol?: string,
    interval?: string,
    marketType: MarketType = 'FUTURES'
  ): Promise<PositionSizeCalculation> {
    const maxPositionSizePercent = parseFloat(config.maxPositionSize);
    const maxPositionValue = (walletBalance * maxPositionSizePercent) / 100;

    let quantity: number;

    switch (config.positionSizing) {
      case 'fixed':
      case 'percentage': {
        quantity = maxPositionValue / entryPrice;
        break;
      }

      case 'kelly': {
        const kellyFraction = await this.calculateKellyCriterion(setupType, symbol, interval);
        const kellyPositionValue = walletBalance * kellyFraction;
        const constrainedValue = Math.min(kellyPositionValue, maxPositionValue);
        quantity = constrainedValue / entryPrice;
        break;
      }

      default:
        quantity = maxPositionValue / entryPrice;
    }

    const volatilityFactor = await this.calculateVolatilityAdjustment(symbol, interval, entryPrice, marketType);

    const adjustedQuantity = quantity * volatilityFactor;
    const notionalValue = adjustedQuantity * entryPrice;
    const riskAmount = adjustedQuantity * Math.abs(entryPrice - stopLoss);

    return {
      quantity: this.roundQuantity(adjustedQuantity),
      notionalValue,
      riskAmount,
    };
  }

  private async calculateVolatilityAdjustment(
    symbol?: string,
    interval?: string,
    currentPrice?: number,
    marketType: MarketType = 'FUTURES'
  ): Promise<number> {
    if (!symbol || !interval || !currentPrice) return 1.0;

    try {
      const recentKlines = await db
        .select()
        .from(klines)
        .where(and(eq(klines.symbol, symbol), eq(klines.interval, interval), eq(klines.marketType, marketType)))
        .orderBy(sql`${klines.openTime} DESC`)
        .limit(50);

      if (recentKlines.length < VOLATILITY_DEFAULTS.ATR_PERIOD) return 1.0;

      const mappedKlines = mapDbKlinesReversed(recentKlines);

      const result = await calculateVolatilityAdjustmentCore({
        klines: mappedKlines,
        entryPrice: currentPrice,
      });

      if (result.isHighVolatility) {
        logger.info({
          symbol,
          interval,
          atrPercent: result.atrPercent?.toFixed(2),
          reduction: `${((1 - result.factor) * 100).toFixed(0)}%`,
        }, 'High volatility detected - reducing position size');
      }

      return result.factor;
    } catch (error) {
      logger.error({
        error: serializeError(error),
        symbol,
        interval,
      }, 'Error calculating volatility adjustment');
      return 1.0;
    }
  }

  private async calculateKellyCriterion(
    strategyId?: string,
    symbol?: string,
    interval?: string
  ): Promise<number> {
    const DEFAULT_WIN_RATE = AUTO_TRADING_KELLY.DEFAULT_WIN_RATE;
    const DEFAULT_AVG_RR = AUTO_TRADING_KELLY.DEFAULT_AVG_RR;
    const FRACTIONAL_KELLY = AUTO_TRADING_KELLY.FRACTIONAL_KELLY;
    const MIN_TRADES = AUTO_TRADING_KELLY.MIN_TRADES_FOR_STATS;

    let winRate: number = DEFAULT_WIN_RATE;
    let avgRR: number = DEFAULT_AVG_RR;

    if (strategyId && symbol && interval) {
      try {
        const stats = await this.getStrategyStatistics(strategyId, symbol);

        if (stats && stats.totalTrades >= MIN_TRADES) {
          winRate = stats.winRate;
          avgRR = stats.avgRR;

          logger.info({
            strategyId, symbol, interval,
            winRate: `${(winRate * 100).toFixed(1)}%`,
            avgRR: avgRR.toFixed(2),
            trades: stats.totalTrades,
          }, 'Kelly using real strategy statistics');
        } else {
          logger.warn({
            strategyId,
            trades: stats?.totalTrades ?? 0,
            minRequired: MIN_TRADES,
          }, 'Insufficient trades for Kelly, using defaults');
        }
      } catch (error) {
        logger.error({ error }, 'Failed to fetch strategy statistics for Kelly');
      }
    }

    const kelly = (winRate * avgRR - (1 - winRate)) / avgRR;
    const fractionalKelly = Math.max(0, kelly * FRACTIONAL_KELLY);
    return Math.min(fractionalKelly, 0.1);
  }

  private async getStrategyStatistics(
    strategyId: string,
    symbol: string
  ): Promise<{ winRate: number; avgRR: number; totalTrades: number } | null> {
    try {
      const results = await db
        .select({
          totalTrades: sql<number>`COUNT(*)`,
          wins: sql<number>`SUM(CASE WHEN ${tradeExecutions.pnlPercent} > 0 THEN 1 ELSE 0 END)`,
          avgWin: sql<number>`AVG(CASE WHEN ${tradeExecutions.pnlPercent} > 0 THEN ABS(${tradeExecutions.pnlPercent}) ELSE NULL END)`,
          avgLoss: sql<number>`AVG(CASE WHEN ${tradeExecutions.pnlPercent} < 0 THEN ABS(${tradeExecutions.pnlPercent}) ELSE NULL END)`,
        })
        .from(tradeExecutions)
        .where(
          and(
            eq(tradeExecutions.setupType, strategyId),
            eq(tradeExecutions.symbol, symbol),
            eq(tradeExecutions.status, 'closed')
          )
        );

      const row = results[0];
      if (!row?.totalTrades || row.totalTrades === 0) return null;

      const totalTrades = Number(row.totalTrades);
      const wins = Number(row.wins || 0);
      const winRate = wins / totalTrades;
      const avgWin = Number(row.avgWin || 1.5);
      const avgLoss = Number(row.avgLoss || 1.0);
      const avgRR = avgLoss > 0 ? avgWin / avgLoss : 1.5;

      return { winRate, avgRR, totalTrades };
    } catch (error) {
      logger.error({ error }, 'Error calculating strategy statistics');
      return null;
    }
  }

  private roundQuantity(quantity: number): number {
    if (quantity < 1) return Math.floor(quantity * 100000) / 100000;
    if (quantity < 10) return Math.floor(quantity * 1000) / 1000;
    return Math.floor(quantity * 100) / 100;
  }

  validateRiskLimits(
    config: AutoTradingConfig,
    walletBalance: number,
    openPositionsValue: number,
    dailyPnL: number,
    positionSize: PositionSizeCalculation
  ): RiskValidationResult {
    const minNotionalResult = validateMinNotional({ positionValue: positionSize.notionalValue });
    if (!minNotionalResult.isValid) return { isValid: false, reason: minNotionalResult.reason };

    const maxPositionSizePercent = parseFloat(config.maxPositionSize);
    const maxPositionValue = (walletBalance * maxPositionSizePercent) / 100;

    if (positionSize.notionalValue > maxPositionValue) {
      return {
        isValid: false,
        reason: `Position size ${positionSize.notionalValue.toFixed(2)} exceeds maximum ${maxPositionValue.toFixed(2)}`,
      };
    }

    const dailyLossLimitPercent = parseFloat(config.dailyLossLimit);
    const dailyLossLimit = (walletBalance * dailyLossLimitPercent) / 100;

    if (dailyPnL < -dailyLossLimit) {
      return {
        isValid: false,
        reason: `Daily loss limit reached: ${dailyPnL.toFixed(2)} / -${dailyLossLimit.toFixed(2)}`,
      };
    }

    const totalExposure = openPositionsValue + positionSize.notionalValue;
    const maxConcurrentValue =
      (walletBalance * maxPositionSizePercent * config.maxConcurrentPositions) / 100;

    if (totalExposure > maxConcurrentValue) {
      return {
        isValid: false,
        reason: `Total exposure ${totalExposure.toFixed(2)} exceeds maximum ${maxConcurrentValue.toFixed(2)}`,
      };
    }

    return { isValid: true };
  }

  async executeBinanceOrder(
    wallet: Wallet,
    orderParams: OrderParams,
    marketType: MarketType = 'FUTURES'
  ): Promise<{ orderId: string; executedQty: string; price: string }> {
    return executeBinanceOrderImpl(wallet, orderParams, marketType);
  }

  calculateFeeViability(
    entryPrice: number,
    stopLoss: number,
    takeProfit: number,
    marketType: MarketType = 'FUTURES'
  ): { isViable: boolean; minRR: number; actualRR: number } {
    const totalFees = getRoundTripFee({ marketType });
    const risk = Math.abs(entryPrice - stopLoss);
    const reward = Math.abs(takeProfit - entryPrice);

    const actualRR = reward / risk;
    const minRR = totalFees / (1 - totalFees);

    return { isViable: actualRR > minRR * 1.5, minRR, actualRR };
  }

  async createStopLossOrder(
    wallet: Wallet,
    symbol: string,
    quantity: number,
    stopLoss: number,
    side: PositionSide,
    marketType: MarketType = 'FUTURES'
  ): Promise<OrderResult> {
    if (marketType === 'FUTURES') {
      const result = await createSLOrder({ wallet, symbol, side, quantity, triggerPrice: stopLoss, marketType });
      return { algoId: result.algoId!, isAlgoOrder: true };
    }

    const orderSide = side === 'LONG' ? 'SELL' : 'BUY';
    const orderParams: OrderParams = {
      symbol,
      side: orderSide,
      type: 'STOP_LOSS_LIMIT',
      quantity,
      stopPrice: stopLoss,
      price: stopLoss * (orderSide === 'SELL' ? 0.99 : 1.01),
      timeInForce: 'GTC',
    };

    const result = await this.executeBinanceOrder(wallet, orderParams, 'SPOT');
    return { orderId: result.orderId, isAlgoOrder: false };
  }

  async createTakeProfitOrder(
    wallet: Wallet,
    symbol: string,
    quantity: number,
    takeProfit: number,
    side: PositionSide,
    marketType: MarketType = 'FUTURES'
  ): Promise<OrderResult> {
    if (marketType === 'FUTURES') {
      const result = await createTPOrder({ wallet, symbol, side, quantity, triggerPrice: takeProfit, marketType });
      return { algoId: result.algoId!, isAlgoOrder: true };
    }

    const orderSide = side === 'LONG' ? 'SELL' : 'BUY';
    const orderParams: OrderParams = {
      symbol,
      side: orderSide,
      type: 'LIMIT',
      quantity,
      price: takeProfit,
      timeInForce: 'GTC',
    };

    const result = await this.executeBinanceOrder(wallet, orderParams, 'SPOT');
    return { orderId: result.orderId, isAlgoOrder: false };
  }

  async closePosition(
    wallet: Wallet,
    symbol: string,
    quantity: number,
    side: 'BUY' | 'SELL',
    marketType: MarketType
  ): Promise<{ orderId: string; avgPrice: number } | null> {
    return closePositionImpl(wallet, symbol, quantity, side, marketType);
  }

  async setFuturesLeverage(wallet: Wallet, symbol: string, leverage: number): Promise<void> {
    return setFuturesLeverageImpl(wallet, symbol, leverage);
  }

  async setFuturesMarginType(wallet: Wallet, symbol: string, marginType: 'ISOLATED' | 'CROSSED'): Promise<void> {
    return setFuturesMarginTypeImpl(wallet, symbol, marginType);
  }

  async setFuturesPositionMode(wallet: Wallet, dualSidePosition: boolean): Promise<void> {
    return setFuturesPositionModeImpl(wallet, dualSidePosition);
  }
}

export const autoTradingService = new AutoTradingService();
