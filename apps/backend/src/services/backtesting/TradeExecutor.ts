import { calculateATR } from '@marketmind/indicators';
import type { Kline } from '@marketmind/types';
import { generateShortId } from '../../utils/id';
import { PositionSizer } from './PositionSizer';

export interface TradeExecutorConfig {
  positionSizingMethod?: 'fixed-fractional' | 'risk-based' | 'kelly' | 'volatility';
  maxPositionSize?: number;
  riskPerTrade?: number;
  kellyFraction?: number;
  commission?: number;
  minProfitPercent?: number;
  minRiskRewardRatio?: number;
  stopLossPercent?: number;
  takeProfitPercent?: number;
}

export interface TradeStats {
  winRate: number;
  avgWinPercent: number;
  avgLossPercent: number;
}

export interface TradeResult {
  id: string;
  setupId: string;
  setupType: string;
  setupConfidence: number;
  entryTime: string;
  entryPrice: number;
  exitTime: string;
  exitPrice: number;
  side: 'LONG' | 'SHORT';
  quantity: number;
  stopLoss: number | undefined;
  takeProfit: number | undefined;
  pnl: number;
  pnlPercent: number;
  commission: number;
  netPnl: number;
  exitReason: 'STOP_LOSS' | 'TAKE_PROFIT' | 'EXIT_CONDITION' | 'MAX_BARS' | 'END_OF_PERIOD' | 'MANUAL' | 'LIQUIDATION';
  status: 'CLOSED';
  entryOrderType?: string;
}

export interface PositionSizeResult {
  positionSize: number;
  positionValue: number;
  rationale?: string;
}

const MIN_NOTIONAL_VALUE = 10;
const HIGH_VOLATILITY_THRESHOLD = 3.0;
const VOLATILITY_REDUCTION_FACTOR = 0.7;

export class TradeExecutor {
  private config: TradeExecutorConfig;

  constructor(config: TradeExecutorConfig) {
    this.config = config;
  }

  calculateRollingStats(trades: any[], lookback: number = 30): TradeStats | null {
    if (trades.length === 0) return null;

    const recentTrades = trades.slice(-lookback);
    const winners = recentTrades.filter(t => t.pnlPercent > 0);
    const losers = recentTrades.filter(t => t.pnlPercent < 0);

    if (winners.length === 0 || losers.length === 0) return null;

    const winRate = winners.length / recentTrades.length;
    const avgWinPercent = winners.reduce((sum: number, t: any) => sum + t.pnlPercent, 0) / winners.length;
    const avgLossPercent = Math.abs(losers.reduce((sum: number, t: any) => sum + t.pnlPercent, 0) / losers.length);

    return { winRate, avgWinPercent, avgLossPercent };
  }

  resolveEntryPrice(
    _setup: any,
    entryKline: any,
    _klines: Kline[],
    entryKlineIndex: number,
    _tradesCount: number
  ): { entryPrice: number; actualEntryKlineIndex: number; skipped: 'limitExpired' | null } {
    return {
      entryPrice: parseFloat(String(entryKline.close)),
      actualEntryKlineIndex: entryKlineIndex,
      skipped: null,
    };
  }

  resolveStopLossAndTakeProfit(
    setup: any,
    entryPrice: number,
    tradesCount: number
  ): { stopLoss: number | undefined; takeProfit: number | undefined } {
    const stopLoss = setup.stopLoss
      ? setup.stopLoss
      : this.config.stopLossPercent
        ? setup.direction === 'LONG'
          ? entryPrice * (1 - this.config.stopLossPercent / 100)
          : entryPrice * (1 + this.config.stopLossPercent / 100)
        : undefined;

    const takeProfit = setup.takeProfit
      ? setup.takeProfit
      : this.config.takeProfitPercent
        ? setup.direction === 'LONG'
          ? entryPrice * (1 + this.config.takeProfitPercent / 100)
          : entryPrice * (1 - this.config.takeProfitPercent / 100)
        : undefined;

    if (tradesCount === 0) {
      const slSource = setup.stopLoss ? '✓ setup-ATR' : '⚠ config-fixed';
      const tpSource = setup.takeProfit ? '✓ setup-ATR' : '⚠ config-fixed';
      const slPercent = stopLoss ? (Math.abs((stopLoss - entryPrice) / entryPrice) * 100).toFixed(2) : 'N/A';
      const tpPercent = takeProfit ? (Math.abs((takeProfit - entryPrice) / entryPrice) * 100).toFixed(2) : 'N/A';
      console.log(`[TradeExecutor] First Trade SL/TP: ${slSource} ${slPercent}% | ${tpSource} ${tpPercent}%`);
    }

    return { stopLoss, takeProfit };
  }

  calculatePositionSize(
    equity: number,
    entryPrice: number,
    stopLoss: number | undefined,
    trades: any[],
    tradesCount: number
  ): PositionSizeResult {
    const positionSizingMethod = this.config.positionSizingMethod ?? 'fixed-fractional';

    if (positionSizingMethod === 'fixed-fractional') {
      const positionSize = (equity * ((this.config.maxPositionSize ?? 10) / 100)) / entryPrice;
      const positionValue = positionSize * entryPrice;
      return { positionSize, positionValue };
    }

    const rollingStats = this.calculateRollingStats(trades, 30);
    const kellyConfig = rollingStats ? {
      winRate: rollingStats.winRate,
      avgWinPercent: rollingStats.avgWinPercent,
      avgLossPercent: rollingStats.avgLossPercent,
    } : {};

    const sizingResult = PositionSizer.calculatePositionSize(
      equity,
      entryPrice,
      stopLoss,
      {
        method: positionSizingMethod,
        riskPerTrade: this.config.riskPerTrade ?? 2,
        kellyFraction: this.config.kellyFraction ?? 0.25,
        ...kellyConfig,
        minPositionPercent: 1,
        maxPositionPercent: this.config.maxPositionSize ?? 100,
      }
    );

    if (this.config.minProfitPercent !== undefined && tradesCount < 3) {
      console.log(`[TradeExecutor] ${sizingResult.rationale}`);
    }

    return {
      positionSize: sizingResult.positionSize,
      positionValue: sizingResult.positionValue,
      rationale: sizingResult.rationale,
    };
  }

  applyVolatilityAdjustment(
    positionSize: number,
    entryPrice: number,
    klines: Kline[],
    setupIndex: number,
    tradesCount: number
  ): { positionSize: number; positionValue: number } {
    if (setupIndex < 14) {
      return { positionSize, positionValue: positionSize * entryPrice };
    }

    const recentKlines = klines.slice(setupIndex - 13, setupIndex + 1);
    const atrValues = calculateATR(recentKlines, 14);

    if (atrValues.length === 0) {
      return { positionSize, positionValue: positionSize * entryPrice };
    }

    const currentATR = atrValues[atrValues.length - 1];
    if (currentATR === null || currentATR === undefined) {
      return { positionSize, positionValue: positionSize * entryPrice };
    }

    const atrPercent = (currentATR / entryPrice) * 100;

    if (atrPercent > HIGH_VOLATILITY_THRESHOLD) {
      const originalSize = positionSize;
      const adjustedSize = positionSize * VOLATILITY_REDUCTION_FACTOR;

      if (tradesCount < 3) {
        console.log(`[TradeExecutor] High volatility adjustment: ATR=${atrPercent.toFixed(2)}% > ${HIGH_VOLATILITY_THRESHOLD}%, size reduced from ${originalSize.toFixed(6)} to ${adjustedSize.toFixed(6)}`);
      }

      return { positionSize: adjustedSize, positionValue: adjustedSize * entryPrice };
    }

    return { positionSize, positionValue: positionSize * entryPrice };
  }

  applyMarketContextMultiplier(
    positionSize: number,
    entryPrice: number,
    multiplier: number
  ): { positionSize: number; positionValue: number } {
    if (multiplier >= 1.0) {
      return { positionSize, positionValue: positionSize * entryPrice };
    }

    const adjustedSize = positionSize * multiplier;
    return { positionSize: adjustedSize, positionValue: adjustedSize * entryPrice };
  }

  checkMinNotional(positionValue: number): boolean {
    if (positionValue < MIN_NOTIONAL_VALUE) {
      console.warn('[TradeExecutor] Position value', positionValue.toFixed(2), 'below MIN_NOTIONAL (', MIN_NOTIONAL_VALUE, '), skipping trade');
      return false;
    }
    return true;
  }

  checkMinProfit(
    entryPrice: number,
    takeProfit: number | undefined,
    direction: 'LONG' | 'SHORT',
    minProfitPercent: number | undefined,
    commission: number
  ): boolean {
    if (!minProfitPercent || !takeProfit) return true;

    const expectedProfitPercent = direction === 'LONG'
      ? ((takeProfit - entryPrice) / entryPrice) * 100
      : ((entryPrice - takeProfit) / entryPrice) * 100;

    const profitAfterFees = expectedProfitPercent - (commission * 200);

    if (profitAfterFees < minProfitPercent) {
      console.warn(
        '[TradeExecutor] Skipping setup - expected profit after fees',
        `${profitAfterFees.toFixed(2)}%`,
        'is below minimum',
        `${minProfitPercent}%`
      );
      return false;
    }

    return true;
  }

  checkRiskReward(
    entryPrice: number,
    stopLoss: number | undefined,
    takeProfit: number | undefined,
    direction: 'LONG' | 'SHORT',
    tradesCount: number
  ): boolean {
    const minRiskRewardRatio = this.config.minRiskRewardRatio ?? 1.0;

    if (!stopLoss || !takeProfit) return true;

    let risk: number;
    let reward: number;

    if (direction === 'LONG') {
      risk = entryPrice - stopLoss;
      reward = takeProfit - entryPrice;
    } else {
      risk = stopLoss - entryPrice;
      reward = entryPrice - takeProfit;
    }

    if (risk <= 0) return true;

    const riskRewardRatio = reward / risk;

    if (riskRewardRatio < minRiskRewardRatio) {
      if (tradesCount < 3) {
        console.warn(
          `[TradeExecutor] Skipping setup - R:R ${riskRewardRatio.toFixed(2)}:1 below minimum ${minRiskRewardRatio}:1`
        );
      }
      return false;
    }

    return true;
  }

  createTrade(
    setup: any,
    actualEntryTime: number,
    entryPrice: number,
    exitTime: string,
    exitPrice: number,
    positionSize: number,
    stopLoss: number | undefined,
    takeProfit: number | undefined,
    exitReason: TradeResult['exitReason']
  ): TradeResult {
    const priceDiff = setup.direction === 'LONG'
      ? exitPrice - entryPrice
      : entryPrice - exitPrice;

    const pnl = priceDiff * positionSize;
    const commissionRate = this.config.commission ?? 0.001;
    const entryCommission = positionSize * entryPrice * commissionRate;
    const exitCommission = positionSize * exitPrice * commissionRate;
    const commission = entryCommission + exitCommission;
    const netPnl = pnl - commission;
    const positionValue = positionSize * entryPrice;
    const pnlPercent = (netPnl / positionValue) * 100;

    return {
      id: generateShortId(),
      setupId: setup.id,
      setupType: setup.type,
      setupConfidence: setup.confidence,
      entryTime: new Date(actualEntryTime).toISOString(),
      entryPrice,
      exitTime,
      exitPrice,
      side: setup.direction,
      quantity: positionSize,
      stopLoss,
      takeProfit,
      pnl,
      pnlPercent,
      commission,
      netPnl,
      exitReason,
      status: 'CLOSED',
      entryOrderType: setup.entryOrderType,
    };
  }
}
