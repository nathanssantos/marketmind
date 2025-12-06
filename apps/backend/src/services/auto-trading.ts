import { MainClient } from 'binance';
import type { SetupDetection, Wallet, AutoTradingConfig } from '../db/schema';
import { decryptApiKey } from './encryption';
import { logger } from './logger';

export interface OrderParams {
  symbol: string;
  side: 'BUY' | 'SELL';
  type: 'LIMIT' | 'MARKET' | 'STOP_LOSS_LIMIT';
  quantity: number;
  price?: number;
  stopPrice?: number;
  timeInForce?: 'GTC' | 'IOC' | 'FOK';
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
  createOrderFromSetup(
    setup: SetupDetection,
    config: AutoTradingConfig,
    walletBalance: number
  ): OrderParams {
    const entryPrice = parseFloat(setup.entryPrice);
    const stopLoss = parseFloat(setup.stopLoss);

    const positionSize = this.calculatePositionSize(
      config,
      walletBalance,
      entryPrice,
      stopLoss
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

  calculatePositionSize(
    config: AutoTradingConfig,
    walletBalance: number,
    entryPrice: number,
    stopLoss: number
  ): PositionSizeCalculation {
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
        const kellyFraction = this.calculateKellyCriterion(riskPercent);
        const kellyPositionValue = walletBalance * kellyFraction;
        const constrainedValue = Math.min(kellyPositionValue, maxPositionValue);
        quantity = constrainedValue / entryPrice;
        break;
      }

      default:
        quantity = maxPositionValue / entryPrice;
    }

    const notionalValue = quantity * entryPrice;
    const riskAmount = quantity * Math.abs(entryPrice - stopLoss);

    return {
      quantity: this.roundQuantity(quantity),
      notionalValue,
      riskAmount,
    };
  }

  private calculateKellyCriterion(_riskPercent: number): number {
    const winRate = 0.55;
    const avgWin = 2.0;
    const avgLoss = 1.0;

    const kelly = (winRate * avgWin - (1 - winRate) * avgLoss) / avgWin;

    const fractionalKelly = kelly * 0.25;

    return Math.max(0, Math.min(fractionalKelly, 0.1));
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
    orderParams: OrderParams
  ): Promise<{ orderId: number; executedQty: string; price: string }> {
    try {
      const apiKey = decryptApiKey(wallet.apiKeyEncrypted);
      const apiSecret = decryptApiKey(wallet.apiSecretEncrypted);

      const client = new MainClient({
        api_key: apiKey,
        api_secret: apiSecret,
      });

      const order = await client.submitNewOrder({
        symbol: orderParams.symbol,
        side: orderParams.side,
        type: orderParams.type,
        quantity: orderParams.quantity,
        price: orderParams.price,
        stopPrice: orderParams.stopPrice,
        timeInForce: orderParams.timeInForce,
      });

      logger.info({
        orderId: order.orderId,
        symbol: order.symbol,
        side: 'side' in order ? order.side : 'unknown',
        quantity: 'origQty' in order ? order.origQty : '0',
        price: 'price' in order ? order.price : '0',
      }, 'Binance order executed');

      return {
        orderId: order.orderId,
        executedQty: 'executedQty' in order ? order.executedQty?.toString() || '0' : '0',
        price: 'price' in order ? order.price?.toString() || '0' : '0',
      };
    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : String(error),
        orderParams,
      }, 'Failed to execute Binance order');
      throw error;
    }
  }

  calculateFeeViability(
    entryPrice: number,
    stopLoss: number,
    takeProfit: number,
    feeRate: number = 0.001
  ): { isViable: boolean; minRR: number; actualRR: number } {
    const risk = Math.abs(entryPrice - stopLoss);
    const reward = Math.abs(takeProfit - entryPrice);

    const actualRR = reward / risk;

    const totalFees = feeRate * 2;
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
    side: 'LONG' | 'SHORT'
  ): Promise<number> {
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

    const result = await this.executeBinanceOrder(wallet, orderParams);
    return result.orderId;
  }

  async createTakeProfitOrder(
    wallet: Wallet,
    symbol: string,
    quantity: number,
    takeProfit: number,
    side: 'LONG' | 'SHORT'
  ): Promise<number> {
    const orderSide = side === 'LONG' ? 'SELL' : 'BUY';

    const orderParams: OrderParams = {
      symbol,
      side: orderSide,
      type: 'LIMIT',
      quantity,
      price: takeProfit,
      timeInForce: 'GTC',
    };

    const result = await this.executeBinanceOrder(wallet, orderParams);
    return result.orderId;
  }
}

export const autoTradingService = new AutoTradingService();
