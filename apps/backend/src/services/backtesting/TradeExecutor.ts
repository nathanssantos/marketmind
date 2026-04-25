import type { Kline, MarketType, PositionSide } from '@marketmind/types';
import { getDefaultFee } from '@marketmind/types';
import { generateShortId } from '../../utils/id';
import {
  calculateVolatilityAdjustment,
  resolveFibonacciTarget,
  validateMinNotional,
  validateMinProfit,
  validateRiskReward,
} from '../../utils/trade-validation';
import { PositionSizer } from './PositionSizer';

export interface TradeExecutorConfig {
  positionSizingMethod?: 'fixed-fractional' | 'risk-based' | 'kelly' | 'volatility';
  maxPositionSize?: number;
  riskPerTrade?: number;
  kellyFraction?: number;
  commission?: number;
  marketType?: MarketType;
  minProfitPercent?: number;
  minRiskRewardRatio?: number;
  minRiskRewardRatioLong?: number;
  minRiskRewardRatioShort?: number;
  stopLossPercent?: number;
  takeProfitPercent?: number;
  tpCalculationMode?: 'default' | 'fibonacci';
  fibonacciTargetLevel?: 'auto' | '1' | '1.272' | '1.382' | '1.618' | '2' | '2.618' | '3' | '3.618' | '4.236';
  fibonacciTargetLevelLong?: 'auto' | '1' | '1.272' | '1.382' | '1.618' | '2' | '2.618' | '3' | '3.618' | '4.236';
  fibonacciTargetLevelShort?: 'auto' | '1' | '1.272' | '1.382' | '1.618' | '2' | '2.618' | '3' | '3.618' | '4.236';
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
  side: PositionSide;
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
    const stopLoss: number | undefined = setup.stopLoss
      ?? (this.config.stopLossPercent
        ? (setup.direction === 'LONG'
          ? entryPrice * (1 - this.config.stopLossPercent / 100)
          : entryPrice * (1 + this.config.stopLossPercent / 100))
        : undefined);

    let takeProfit: number | undefined = setup.takeProfit
      ?? (this.config.takeProfitPercent
        ? (setup.direction === 'LONG'
          ? entryPrice * (1 + this.config.takeProfitPercent / 100)
          : entryPrice * (1 - this.config.takeProfitPercent / 100))
        : undefined);

    let tpSource = setup.takeProfit ? 'setup-ATR' : 'config-fixed';

    if (this.config.tpCalculationMode === 'fibonacci' && setup.fibonacciProjection) {
      const fibTarget = this.getFibonacciTargetPrice(setup, entryPrice);
      if (fibTarget !== null) {
        takeProfit = fibTarget;
        tpSource = 'fibonacci';
      }
    }

    if (tradesCount === 0) {
      const slSource = setup.stopLoss ? '✓ setup-ATR' : '! config-fixed';
      const tpSourceFormatted = tpSource === 'fibonacci' ? '> fibonacci' : (setup.takeProfit ? '✓ setup-ATR' : '! config-fixed');
      const slPercent = stopLoss ? (Math.abs((stopLoss - entryPrice) / entryPrice) * 100).toFixed(2) : 'N/A';
      const tpPercent = takeProfit ? (Math.abs((takeProfit - entryPrice) / entryPrice) * 100).toFixed(2) : 'N/A';
      console.log(`[TradeExecutor] First Trade SL/TP: ${slSource} ${slPercent}% | ${tpSourceFormatted} ${tpPercent}%`);
    }

    return { stopLoss, takeProfit };
  }

  private getFibonacciTargetPrice(setup: any, entryPrice: number): number | null {
    const result = resolveFibonacciTarget({
      fibonacciProjection: setup.fibonacciProjection,
      entryPrice,
      direction: setup.direction,
      targetLevel: this.config.fibonacciTargetLevel,
      targetLevelLong: this.config.fibonacciTargetLevelLong,
      targetLevelShort: this.config.fibonacciTargetLevelShort,
    });
    return result.price;
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

  async applyVolatilityAdjustment(
    positionSize: number,
    entryPrice: number,
    klines: Kline[],
    setupIndex: number,
    tradesCount: number
  ): Promise<{ positionSize: number; positionValue: number }> {
    const result = await calculateVolatilityAdjustment({
      klines,
      entryPrice,
      klineIndex: setupIndex,
    });

    if (result.isHighVolatility) {
      const adjustedSize = positionSize * result.factor;

      if (tradesCount < 3) {
        console.log(`[TradeExecutor] ${result.rationale}`);
      }

      return { positionSize: adjustedSize, positionValue: adjustedSize * entryPrice };
    }

    return { positionSize, positionValue: positionSize * entryPrice };
  }

  checkMinNotional(positionValue: number): boolean {
    const result = validateMinNotional({ positionValue });
    if (!result.isValid) {
      console.warn(`[TradeExecutor] ${result.reason}`);
      return false;
    }
    return true;
  }

  checkMinProfit(
    entryPrice: number,
    takeProfit: number | undefined,
    direction: PositionSide,
    minProfitPercent: number | undefined,
    commission: number
  ): boolean {
    const result = validateMinProfit({
      entryPrice,
      takeProfit,
      direction,
      minProfitPercent,
      commissionRate: commission,
    });

    if (!result.isValid) {
      console.warn(`[TradeExecutor] ${result.reason}`);
      return false;
    }

    return true;
  }

  checkRiskReward(
    entryPrice: number,
    stopLoss: number | undefined,
    takeProfit: number | undefined,
    direction: PositionSide,
    tradesCount: number
  ): boolean {
    const effectiveMinRR = direction === 'LONG'
      ? (this.config.minRiskRewardRatioLong ?? this.config.minRiskRewardRatio)
      : (this.config.minRiskRewardRatioShort ?? this.config.minRiskRewardRatio);

    const result = validateRiskReward({
      entryPrice,
      stopLoss,
      takeProfit,
      direction,
      minRiskRewardRatio: effectiveMinRR,
    });

    if (!result.isValid) {
      if (tradesCount < 3) {
        console.warn(`[TradeExecutor] ${result.reason}`);
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
    const commissionRate = this.config.commission ?? getDefaultFee(this.config.marketType ?? 'FUTURES');
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
