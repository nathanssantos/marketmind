import type { BacktestConfig, BacktestResult, BacktestTrade } from '@marketmind/types';
import {
  calculateLiquidationPrice,
  calculateLeveragedPnl,
  calculateFundingPayment,
  FUTURES_DEFAULTS,
} from '@marketmind/types';
import { BacktestEngine } from './BacktestEngine';
import { BinanceFuturesDataService } from '../binance-futures-data';

interface LocalFundingRateData {
  fundingTime: number;
  fundingRate: number;
}

const FUNDING_INTERVAL_MS = 8 * 60 * 60 * 1000; // 8 hours

export class FuturesBacktestEngine {
  private spotEngine: BacktestEngine;
  private fundingRatesCache: Map<string, LocalFundingRateData[]> = new Map();
  private futuresDataService: BinanceFuturesDataService;

  constructor() {
    this.spotEngine = new BacktestEngine();
    this.futuresDataService = new BinanceFuturesDataService();
  }

  private async loadFundingRates(
    symbol: string,
    startDate: string,
    endDate: string
  ): Promise<LocalFundingRateData[]> {
    const cacheKey = `${symbol}-${startDate}-${endDate}`;
    const cached = this.fundingRatesCache.get(cacheKey);
    if (cached) return cached;

    try {
      const startTime = new Date(startDate).getTime();
      const endTime = new Date(endDate).getTime();
      const rates = await this.futuresDataService.getHistoricalFundingRates(
        symbol,
        startTime,
        endTime
      );

      const formattedRates: LocalFundingRateData[] = rates.map((r) => ({
        fundingTime: r.timestamp,
        fundingRate: r.rate / 100,
      }));

      this.fundingRatesCache.set(cacheKey, formattedRates);
      return formattedRates;
    } catch (error) {
      console.warn('[FuturesBacktest] Failed to fetch historical funding rates, using defaults:', error);
      return this.generateDefaultFundingRates(
        new Date(startDate).getTime(),
        new Date(endDate).getTime()
      );
    }
  }

  private generateDefaultFundingRates(startTime: number, endTime: number): LocalFundingRateData[] {
    const rates: LocalFundingRateData[] = [];
    const startFunding = Math.ceil(startTime / FUNDING_INTERVAL_MS) * FUNDING_INTERVAL_MS;

    for (let time = startFunding; time <= endTime; time += FUNDING_INTERVAL_MS) {
      rates.push({
        fundingTime: time,
        fundingRate: 0.0001, // Default 0.01% funding rate
      });
    }

    return rates;
  }

  private calculateFundingPayments(
    positionValue: number,
    side: 'LONG' | 'SHORT',
    entryTime: number,
    exitTime: number,
    fundingRates: LocalFundingRateData[]
  ): { totalPayments: number; paymentCount: number } {
    let totalPayments = 0;
    let paymentCount = 0;

    for (const rate of fundingRates) {
      if (rate.fundingTime > entryTime && rate.fundingTime <= exitTime) {
        const payment = calculateFundingPayment(positionValue, rate.fundingRate * 100, side);
        totalPayments += payment;
        paymentCount++;
      }
    }

    return { totalPayments, paymentCount };
  }

  private findLiquidationPoint(
    klines: any[],
    entryIndex: number,
    liquidationPrice: number,
    side: 'LONG' | 'SHORT'
  ): { liquidated: boolean; exitIndex: number; exitPrice: number } | null {
    for (let i = entryIndex + 1; i < klines.length; i++) {
      const kline = klines[i];
      const low = parseFloat(kline.low);
      const high = parseFloat(kline.high);

      if (side === 'LONG' && low <= liquidationPrice) {
        return {
          liquidated: true,
          exitIndex: i,
          exitPrice: liquidationPrice,
        };
      }

      if (side === 'SHORT' && high >= liquidationPrice) {
        return {
          liquidated: true,
          exitIndex: i,
          exitPrice: liquidationPrice,
        };
      }
    }

    return null;
  }

  async run(config: BacktestConfig, klines?: any[]): Promise<BacktestResult> {
    const isFuturesMode = config.marketType === 'FUTURES';

    if (!isFuturesMode || config.leverage === 1) {
      return this.spotEngine.run(config, klines);
    }

    const leverage = config.leverage ?? 1;
    const marginType = config.marginType ?? 'ISOLATED';
    const simulateFundingRates = config.simulateFundingRates ?? true;
    const simulateLiquidation = config.simulateLiquidation ?? true;

    const futuresConfig: BacktestConfig = {
      ...config,
      commission: config.commission ?? FUTURES_DEFAULTS.TAKER_FEE,
    };

    console.log(`[FuturesBacktest] Running futures backtest with ${leverage}x leverage, ${marginType} margin`);
    console.log(`[FuturesBacktest] Simulate funding: ${simulateFundingRates}, Simulate liquidation: ${simulateLiquidation}`);

    const spotResult = await this.spotEngine.run(futuresConfig, klines);

    if (spotResult.trades.length === 0) {
      console.log('[FuturesBacktest] No trades to process');
      return spotResult;
    }

    let fundingRates: LocalFundingRateData[] = [];
    if (simulateFundingRates) {
      fundingRates = await this.loadFundingRates(
        config.symbol,
        config.startDate,
        config.endDate
      );
      console.log(`[FuturesBacktest] Loaded ${fundingRates.length} funding rate periods`);
    }

    const klineData = spotResult.klines ?? [];
    const futuresTrades: BacktestTrade[] = [];
    let equity = config.initialCapital;
    let peakEquity = config.initialCapital;
    let maxDrawdown = 0;
    let totalLiquidations = 0;
    let totalFundingPaid = 0;

    const equityCurve = [
      {
        time: config.startDate,
        equity: config.initialCapital,
        drawdown: 0,
        drawdownPercent: 0,
      },
    ];

    for (const trade of spotResult.trades) {
      const entryPrice = trade.entryPrice;
      const positionValue = trade.quantity * entryPrice;
      const marginRequired = positionValue / leverage;
      const side = trade.side;

      const liquidationPrice = calculateLiquidationPrice(entryPrice, leverage, side);

      let exitPrice = trade.exitPrice ?? entryPrice;
      let exitTime = trade.exitTime ?? trade.entryTime;
      let exitReason = trade.exitReason;
      let isLiquidated = false;
      let liquidationFee = 0;

      if (simulateLiquidation && trade.exitTime) {
        const entryKlineTime = new Date(trade.entryTime).getTime();
        const entryIndex = klineData.findIndex((k) => k.openTime >= entryKlineTime);

        if (entryIndex >= 0) {
          const exitKlineTime = new Date(trade.exitTime).getTime();
          const originalExitIndex = klineData.findIndex((k) => k.openTime >= exitKlineTime);

          const liquidationResult = this.findLiquidationPoint(
            klineData.slice(0, originalExitIndex + 1),
            entryIndex,
            liquidationPrice,
            side
          );

          if (liquidationResult?.liquidated) {
            isLiquidated = true;
            exitPrice = liquidationResult.exitPrice;
            const liquidatedKline = klineData[entryIndex + (liquidationResult.exitIndex - entryIndex)];
            exitTime = liquidatedKline ? new Date(liquidatedKline.openTime).toISOString() : trade.exitTime;
            exitReason = 'LIQUIDATION';
            liquidationFee = positionValue * FUTURES_DEFAULTS.LIQUIDATION_FEE;
            totalLiquidations++;
          }
        }
      }

      let fundingPayments = 0;
      if (simulateFundingRates && trade.exitTime && !isLiquidated) {
        const entryTimestamp = new Date(trade.entryTime).getTime();
        const exitTimestamp = new Date(exitTime).getTime();
        const fundingResult = this.calculateFundingPayments(
          positionValue,
          side,
          entryTimestamp,
          exitTimestamp,
          fundingRates
        );
        fundingPayments = fundingResult.totalPayments;
        totalFundingPaid += Math.abs(fundingPayments);
      }

      const { leveragedPnlPercent } = calculateLeveragedPnl(
        entryPrice,
        exitPrice,
        leverage,
        side
      );

      const grossPnl = (leveragedPnlPercent / 100) * marginRequired;
      const commission = trade.commission ?? (positionValue * FUTURES_DEFAULTS.TAKER_FEE * 2);
      const netPnl = isLiquidated
        ? -(marginRequired - liquidationFee) // Loss of entire margin on liquidation
        : grossPnl + fundingPayments - commission;

      equity += netPnl;

      if (equity > peakEquity) {
        peakEquity = equity;
      }
      const currentDrawdown = peakEquity - equity;
      const currentDrawdownPercent = (currentDrawdown / peakEquity) * 100;

      if (currentDrawdown > maxDrawdown) {
        maxDrawdown = currentDrawdown;
      }

      const futuresTrade: BacktestTrade = {
        ...trade,
        exitPrice,
        exitTime,
        exitReason,
        pnl: grossPnl,
        pnlPercent: leveragedPnlPercent,
        netPnl,
        commission,
        marketType: 'FUTURES',
        leverage,
        marginType,
        liquidationPrice,
        fundingPayments,
        liquidationFee: isLiquidated ? liquidationFee : undefined,
        leveragedPnlPercent,
      };

      futuresTrades.push(futuresTrade);

      equityCurve.push({
        time: exitTime,
        equity,
        drawdown: currentDrawdown,
        drawdownPercent: currentDrawdownPercent,
      });
    }

    const winningTrades = futuresTrades.filter((t) => (t.netPnl ?? 0) > 0);
    const losingTrades = futuresTrades.filter((t) => (t.netPnl ?? 0) <= 0);

    const totalPnl = futuresTrades.reduce((sum, t) => sum + (t.netPnl ?? 0), 0);
    const totalCommission = futuresTrades.reduce((sum, t) => sum + (t.commission ?? 0), 0);
    const totalWins = winningTrades.reduce((sum, t) => sum + (t.netPnl ?? 0), 0);
    const totalLosses = Math.abs(losingTrades.reduce((sum, t) => sum + (t.netPnl ?? 0), 0));

    const winRate = futuresTrades.length > 0
      ? (winningTrades.length / futuresTrades.length) * 100
      : 0;

    const profitFactor = totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0;

    const calculateDuration = (trade: BacktestTrade) => {
      if (!trade.exitTime) return 0;
      const entry = new Date(trade.entryTime).getTime();
      const exit = new Date(trade.exitTime).getTime();
      return (exit - entry) / (1000 * 60);
    };

    const avgTradeDuration = futuresTrades.length > 0
      ? futuresTrades.reduce((sum, t) => sum + calculateDuration(t), 0) / futuresTrades.length
      : 0;

    const avgWinDuration = winningTrades.length > 0
      ? winningTrades.reduce((sum, t) => sum + calculateDuration(t), 0) / winningTrades.length
      : 0;

    const avgLossDuration = losingTrades.length > 0
      ? losingTrades.reduce((sum, t) => sum + calculateDuration(t), 0) / losingTrades.length
      : 0;

    let sharpeRatio = 0;
    if (futuresTrades.length > 1) {
      const returns = futuresTrades.map((t) => t.pnlPercent ?? 0);
      const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
      const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / (returns.length - 1);
      const stdDev = Math.sqrt(variance);
      sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0;
    }

    const metrics = {
      totalTrades: futuresTrades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      winRate,

      totalPnl,
      totalPnlPercent: (totalPnl / config.initialCapital) * 100,
      avgPnl: futuresTrades.length > 0 ? totalPnl / futuresTrades.length : 0,
      avgPnlPercent: futuresTrades.length > 0
        ? futuresTrades.reduce((sum, t) => sum + (t.pnlPercent ?? 0), 0) / futuresTrades.length
        : 0,

      grossWinRate: winRate,
      grossProfitFactor: profitFactor,
      totalGrossPnl: futuresTrades.reduce((sum, t) => sum + (t.pnl ?? 0), 0),

      avgWin: winningTrades.length > 0 ? totalWins / winningTrades.length : 0,
      avgLoss: losingTrades.length > 0 ? totalLosses / losingTrades.length : 0,
      largestWin: winningTrades.length > 0
        ? Math.max(...winningTrades.map((t) => t.netPnl ?? 0))
        : 0,
      largestLoss: losingTrades.length > 0
        ? Math.min(...losingTrades.map((t) => t.netPnl ?? 0))
        : 0,
      profitFactor,

      maxDrawdown,
      maxDrawdownPercent: (maxDrawdown / peakEquity) * 100,

      totalCommission,
      totalFundingPaid,
      totalLiquidations,

      avgTradeDuration,
      avgWinDuration,
      avgLossDuration,
      sharpeRatio,
    };

    console.log('[FuturesBacktest] Results:', {
      trades: futuresTrades.length,
      leverage: `${leverage}x`,
      winRate: `${metrics.winRate.toFixed(2)}%`,
      totalPnl: `${metrics.totalPnl.toFixed(2)} USDT (${metrics.totalPnlPercent.toFixed(2)}%)`,
      finalEquity: `${equity.toFixed(2)} USDT`,
      maxDrawdown: `${metrics.maxDrawdown.toFixed(2)} USDT (${metrics.maxDrawdownPercent.toFixed(2)}%)`,
      liquidations: totalLiquidations,
      fundingPaid: `${totalFundingPaid.toFixed(2)} USDT`,
      profitFactor: metrics.profitFactor.toFixed(2),
    });

    return {
      ...spotResult,
      trades: futuresTrades,
      metrics,
      equityCurve,
    };
  }
}
