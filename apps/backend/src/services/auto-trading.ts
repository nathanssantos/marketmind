import { calculateATR } from '@marketmind/indicators';
import type { MarketType } from '@marketmind/types';
import { getRoundTripFee, TRADING_DEFAULTS } from '@marketmind/types';
import { and, eq, sql } from 'drizzle-orm';
import { VOLATILITY } from '../constants';
import { db } from '../db';
import type { AutoTradingConfig, SetupDetection, Wallet } from '../db/schema';
import { klines, tradeExecutions } from '../db/schema';
import { serializeError } from '../utils/errors';
import { formatNumberForBinance } from '../utils/formatters';
import { createBinanceClient, createBinanceFuturesClient, isPaperWallet } from './binance-client';
import { submitFuturesAlgoOrder } from './binance-futures-client';
import { logger } from './logger';

export interface AlgoOrderResult {
  algoId: number;
  isAlgoOrder: true;
}

export interface RegularOrderResult {
  orderId: number;
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
      config,
      walletBalance,
      entryPrice,
      stopLoss,
      setup.setupType,
      setup.symbol,
      setup.interval
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
    marketType: MarketType = 'SPOT'
  ): Promise<PositionSizeCalculation> {
    const maxPositionSizePercent = parseFloat(config.maxPositionSize);
    const maxPositionValue = (walletBalance * maxPositionSizePercent) / 100;

    let quantity: number;

    switch (config.positionSizing) {
      case 'fixed': {
        quantity = maxPositionValue / entryPrice;
        break;
      }

      case 'percentage': {
        quantity = maxPositionValue / entryPrice;
        break;
      }

      case 'kelly': {
        const riskPercent = Math.abs((entryPrice - stopLoss) / entryPrice);
        const kellyFraction = await this.calculateKellyCriterion(
          riskPercent,
          setupType,
          symbol,
          interval
        );
        const kellyPositionValue = walletBalance * kellyFraction;
        const constrainedValue = Math.min(kellyPositionValue, maxPositionValue);
        quantity = constrainedValue / entryPrice;
        break;
      }

      default:
        quantity = maxPositionValue / entryPrice;
    }

    const volatilityFactor = await this.calculateVolatilityAdjustment(
      symbol,
      interval,
      entryPrice,
      marketType
    );
    
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
    marketType: MarketType = 'SPOT'
  ): Promise<number> {
    if (!symbol || !interval || !currentPrice) return 1.0;

    try {
      const recentKlines = await db
        .select()
        .from(klines)
        .where(and(eq(klines.symbol, symbol), eq(klines.interval, interval), eq(klines.marketType, marketType)))
        .orderBy(sql`${klines.openTime} DESC`)
        .limit(50);

      if (recentKlines.length < 14) return 1.0;

      const mappedKlines = recentKlines.reverse().map((k): import('@marketmind/types').Kline => ({
        open: k.open,
        high: k.high,
        low: k.low,
        close: k.close,
        volume: k.volume,
        quoteVolume: k.quoteVolume || '0',
        takerBuyBaseVolume: k.takerBuyBaseVolume || '0',
        takerBuyQuoteVolume: k.takerBuyQuoteVolume || '0',
        trades: k.trades || 0,
        openTime: k.openTime.getTime(),
        closeTime: k.closeTime.getTime(),
      }));

      const atrValues = calculateATR(mappedKlines, 14);
      if (atrValues.length === 0) return 1.0;

      const lastATR = atrValues[atrValues.length - 1];
      if (!lastATR) return 1.0;
      
      const atrPercent = (lastATR / currentPrice) * 100;

      const REDUCTION_FACTOR = 0.7;

      if (atrPercent > VOLATILITY.HIGH_THRESHOLD) {
        logger.info({
          symbol,
          interval,
          atrPercent: atrPercent.toFixed(2),
          reduction: `${((1 - REDUCTION_FACTOR) * 100).toFixed(0)}%`,
        }, 'High volatility detected - reducing position size');
        return REDUCTION_FACTOR;
      }

      return 1.0;
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
    _riskPercent: number,
    strategyId?: string,
    symbol?: string,
    interval?: string
  ): Promise<number> {
    const DEFAULT_WIN_RATE = 0.50;
    const DEFAULT_AVG_RR = 1.5;
    const FRACTIONAL_KELLY = 0.25;
    const MIN_TRADES = 20;

    let winRate = DEFAULT_WIN_RATE;
    let avgRR = DEFAULT_AVG_RR;

    if (strategyId && symbol && interval) {
      try {
        const stats = await this.getStrategyStatistics(strategyId, symbol, interval);
        
        if (stats && stats.totalTrades >= MIN_TRADES) {
          winRate = stats.winRate;
          avgRR = stats.avgRR;
          
          logger.info({
            strategyId,
            symbol,
            interval,
            winRate: `${(winRate * 100).toFixed(1)  }%`,
            avgRR: avgRR.toFixed(2),
            trades: stats.totalTrades,
          }, 'Kelly using real strategy statistics');
        } else {
          logger.warn({
            strategyId,
            trades: stats?.totalTrades || 0,
            minRequired: MIN_TRADES,
          }, 'Insufficient trades for Kelly, using defaults');
        }
      } catch (error) {
        logger.error({ error }, 'Failed to fetch strategy statistics for Kelly');
      }
    }

    const kelly = (winRate * avgRR - (1 - winRate)) / avgRR;
    const fractionalKelly = Math.max(0, kelly * FRACTIONAL_KELLY);
    const cappedKelly = Math.min(fractionalKelly, 0.1);

    return cappedKelly;
  }

  private async getStrategyStatistics(
    strategyId: string,
    symbol: string,
    _interval: string
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
      if (!row?.totalTrades || row.totalTrades === 0) {
        return null;
      }

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
    if (quantity < 1) {
      return Math.floor(quantity * 100000) / 100000;
    }
    if (quantity < 10) {
      return Math.floor(quantity * 1000) / 1000;
    }
    return Math.floor(quantity * 100) / 100;
  }

  validateRiskLimits(
    config: AutoTradingConfig,
    walletBalance: number,
    openPositionsValue: number,
    dailyPnL: number,
    positionSize: PositionSizeCalculation
  ): RiskValidationResult {
    if (positionSize.notionalValue < TRADING_DEFAULTS.MIN_TRADE_VALUE_USD) {
      return {
        isValid: false,
        reason: `Position value ${positionSize.notionalValue.toFixed(2)} below minimum ${TRADING_DEFAULTS.MIN_TRADE_VALUE_USD} USD`,
      };
    }

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
    marketType: MarketType = 'SPOT'
  ): Promise<{ orderId: number; executedQty: string; price: string }> {
    if (isPaperWallet(wallet)) {
      throw new Error('Paper wallets cannot execute real orders on Binance');
    }

    try {
      if (marketType === 'FUTURES') {
        const client = createBinanceFuturesClient(wallet);

        const orderPayload: Parameters<typeof client.submitNewOrder>[0] = {
          symbol: orderParams.symbol,
          side: orderParams.side,
          type: orderParams.type as 'LIMIT' | 'MARKET' | 'STOP_MARKET' | 'TAKE_PROFIT_MARKET',
          quantity: orderParams.quantity,
        };

        if (orderParams.price !== undefined && orderParams.type !== 'MARKET') {
          orderPayload.price = orderParams.price;
        }
        if (orderParams.stopPrice !== undefined) {
          orderPayload.stopPrice = orderParams.stopPrice;
        }
        if (orderParams.timeInForce) {
          orderPayload.timeInForce = orderParams.timeInForce;
        }
        if (orderParams.reduceOnly) {
          orderPayload.reduceOnly = 'true';
        }

        const order = await client.submitNewOrder(orderPayload);

        logger.info({
          orderId: order.orderId,
          symbol: order.symbol,
          side: order.side,
          quantity: order.origQty,
          price: order.price,
          walletType: wallet.walletType,
          marketType: 'FUTURES',
        }, 'Binance Futures order executed');

        return {
          orderId: order.orderId,
          executedQty: order.executedQty?.toString() || '0',
          price: order.price?.toString() || '0',
        };
      }

      const client = createBinanceClient(wallet);

      const spotOrderPayload: Parameters<typeof client.submitNewOrder>[0] = {
        symbol: orderParams.symbol,
        side: orderParams.side,
        type: orderParams.type as 'LIMIT' | 'MARKET' | 'STOP_LOSS_LIMIT',
        quantity: orderParams.quantity,
      };

      if (orderParams.price !== undefined && orderParams.type !== 'MARKET') {
        spotOrderPayload.price = orderParams.price;
      }
      if (orderParams.stopPrice !== undefined) {
        spotOrderPayload.stopPrice = orderParams.stopPrice;
      }
      if (orderParams.timeInForce) {
        spotOrderPayload.timeInForce = orderParams.timeInForce;
      }

      const order = await client.submitNewOrder(spotOrderPayload);

      logger.info({
        orderId: order.orderId,
        symbol: order.symbol,
        side: 'side' in order ? order.side : 'unknown',
        quantity: 'origQty' in order ? order.origQty : '0',
        price: 'price' in order ? order.price : '0',
        walletType: wallet.walletType,
        marketType: 'SPOT',
      }, 'Binance Spot order executed');

      return {
        orderId: order.orderId,
        executedQty: 'executedQty' in order ? order.executedQty?.toString() || '0' : '0',
        price: 'price' in order ? order.price?.toString() || '0' : '0',
      };
    } catch (error) {
      logger.error({
        error: serializeError(error),
        orderParams,
        walletType: wallet.walletType,
        marketType,
      }, 'Failed to execute Binance order');
      throw error;
    }
  }

  calculateFeeViability(
    entryPrice: number,
    stopLoss: number,
    takeProfit: number,
    marketType: MarketType = 'SPOT'
  ): { isViable: boolean; minRR: number; actualRR: number } {
    const totalFees = getRoundTripFee({ marketType });
    const risk = Math.abs(entryPrice - stopLoss);
    const reward = Math.abs(takeProfit - entryPrice);

    const actualRR = reward / risk;
    const minRR = totalFees / (1 - totalFees);

    const isViable = actualRR > minRR * 1.5;

    return {
      isViable,
      minRR,
      actualRR,
    };
  }

  async createStopLossOrder(
    wallet: Wallet,
    symbol: string,
    quantity: number,
    stopLoss: number,
    side: 'LONG' | 'SHORT',
    marketType: MarketType = 'SPOT'
  ): Promise<OrderResult> {
    const orderSide = side === 'LONG' ? 'SELL' : 'BUY';

    if (marketType === 'FUTURES') {
      const client = createBinanceFuturesClient(wallet);
      const formattedQuantity = formatNumberForBinance(quantity);
      const formattedTriggerPrice = formatNumberForBinance(stopLoss);

      const algoOrder = await submitFuturesAlgoOrder(client, {
        symbol,
        side: orderSide,
        type: 'STOP_MARKET',
        quantity: formattedQuantity,
        triggerPrice: formattedTriggerPrice,
        reduceOnly: true,
        workingType: 'CONTRACT_PRICE',
      });

      logger.info({
        algoId: algoOrder.algoId,
        symbol,
        side: orderSide,
        type: 'STOP_MARKET',
        triggerPrice: formattedTriggerPrice,
        quantity: formattedQuantity,
        walletType: wallet.walletType,
      }, '[Futures] Stop-loss algo order created via Algo API');

      return { algoId: algoOrder.algoId, isAlgoOrder: true };
    }

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
    side: 'LONG' | 'SHORT',
    marketType: MarketType = 'SPOT'
  ): Promise<OrderResult> {
    const orderSide = side === 'LONG' ? 'SELL' : 'BUY';

    if (marketType === 'FUTURES') {
      const client = createBinanceFuturesClient(wallet);
      const formattedQuantity = formatNumberForBinance(quantity);
      const formattedTriggerPrice = formatNumberForBinance(takeProfit);

      const algoOrder = await submitFuturesAlgoOrder(client, {
        symbol,
        side: orderSide,
        type: 'TAKE_PROFIT_MARKET',
        quantity: formattedQuantity,
        triggerPrice: formattedTriggerPrice,
        reduceOnly: true,
        workingType: 'CONTRACT_PRICE',
      });

      logger.info({
        algoId: algoOrder.algoId,
        symbol,
        side: orderSide,
        type: 'TAKE_PROFIT_MARKET',
        triggerPrice: formattedTriggerPrice,
        quantity: formattedQuantity,
        walletType: wallet.walletType,
      }, '[Futures] Take-profit algo order created via Algo API');

      return { algoId: algoOrder.algoId, isAlgoOrder: true };
    }

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

  async setFuturesLeverage(
    wallet: Wallet,
    symbol: string,
    leverage: number
  ): Promise<void> {
    if (isPaperWallet(wallet)) {
      logger.info({ symbol, leverage }, 'Paper wallet: simulating leverage setting');
      return;
    }

    const client = createBinanceFuturesClient(wallet);
    try {
      await client.setLeverage({ symbol, leverage });
      logger.info({ symbol, leverage }, 'Futures leverage set');
    } catch (error) {
      const errorMsg = serializeError(error);
      if (errorMsg.includes('No need to change') || errorMsg.includes('leverage not changed')) {
        logger.info({ symbol, leverage }, 'Leverage already set');
        return;
      }
      logger.error({ symbol, leverage, error: errorMsg }, 'Failed to set futures leverage');
      throw new Error(`Failed to set leverage for ${symbol}: ${errorMsg}`);
    }
  }

  async setFuturesMarginType(
    wallet: Wallet,
    symbol: string,
    marginType: 'ISOLATED' | 'CROSSED'
  ): Promise<void> {
    if (isPaperWallet(wallet)) {
      logger.info({ symbol, marginType }, 'Paper wallet: simulating margin type setting');
      return;
    }

    const client = createBinanceFuturesClient(wallet);
    try {
      await client.setMarginType({ symbol, marginType });
      logger.info({ symbol, marginType }, 'Futures margin type set');
    } catch (error) {
      const errorMsg = serializeError(error);
      if (errorMsg.includes('No need to change margin type')) {
        logger.info({ symbol, marginType }, 'Margin type already set');
        return;
      }
      logger.error({ symbol, marginType, error: errorMsg }, 'Failed to set futures margin type');
      throw new Error(`Failed to set margin type for ${symbol}: ${errorMsg}`);
    }
  }

  async setFuturesPositionMode(
    wallet: Wallet,
    dualSidePosition: boolean
  ): Promise<void> {
    if (isPaperWallet(wallet)) {
      logger.info({ dualSidePosition }, 'Paper wallet: simulating position mode setting');
      return;
    }

    const client = createBinanceFuturesClient(wallet);
    try {
      await client.setPositionMode({ dualSidePosition: dualSidePosition ? 'true' : 'false' });
      logger.info({ dualSidePosition }, 'Futures position mode set');
    } catch (error) {
      const errorMsg = serializeError(error);
      if (errorMsg.includes('No need to change position side')) {
        logger.info({ dualSidePosition }, 'Position mode already set');
        return;
      }
      logger.error({ dualSidePosition, error: errorMsg }, 'Failed to set futures position mode');
      throw new Error(`Failed to set position mode: ${errorMsg}`);
    }
  }
}

export const autoTradingService = new AutoTradingService();
