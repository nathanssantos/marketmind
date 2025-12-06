import type { Kline } from '@shared/types';
import type {
  BacktestConfig,
  BacktestEquityPoint,
  BacktestResult,
  BacktestTrade,
} from '@shared/types/backtesting';
import { PositionManager } from '../positionManagement/PositionManager';
import { GridTradingDetector } from '../setupDetection/GridTradingDetector';
import { MeanReversionDetector } from '../setupDetection/MeanReversionDetector';
import { BacktestExecutor } from './BacktestExecutor';
import { BacktestMetricsCalculator } from './BacktestMetricsCalculator';
export class BacktestOrchestrator {
  private executor: BacktestExecutor;
  private metricsCalculator: BacktestMetricsCalculator;

  constructor() {
    this.executor = new BacktestExecutor();
    this.metricsCalculator = new BacktestMetricsCalculator();
  }

  static async runBacktest(
    klines: Kline[],
    _initialCapital: number,
    config: BacktestConfig
  ): Promise<BacktestResult> {
    const orchestrator = new BacktestOrchestrator();
    return orchestrator.runBacktest(config, klines);
  }

  async runBacktest(
    config: BacktestConfig,
    klines: Kline[],
    onProgress?: (progress: number) => void
  ): Promise<BacktestResult> {
    const startTime = Date.now();
    const resultId = `backtest-${startTime}`;

    try {
      const filteredKlines = this.filterKlinesByDateRange(
        klines,
        config.startDate,
        config.endDate
      );

      if (filteredKlines.length === 0) {
        throw new Error('No klines found in the specified date range');
      }

      const detectors = this.initializeDetectors(config);
      const positionManager = new PositionManager({
        trailingStop: {
          initialATRMultiplier: 2.0,
          trailingATRMultiplier: 1.5,
          breakEvenAfterR: 1.0,
          breakEvenBuffer: 0.1,
          minTrailDistance: 1.0,
        },
        partialExit: {
          enabled: true,
          levels: [
            { rMultiple: 1.5, percentage: 33 },
            { rMultiple: 2.5, percentage: 33 },
          ],
          lockInProfitsAfterFirstExit: true,
        },
      });

      const trades: BacktestTrade[] = [];
      let equity = config.initialCapital;
      const equityCurve: BacktestEquityPoint[] = [];
      let peakEquity = equity;

      for (let i = 0; i < filteredKlines.length; i++) {
        const currentKline = filteredKlines[i];
        if (!currentKline) continue;
        
        const historicalKlines = filteredKlines.slice(0, i + 1);

        this.updateOpenPositions(
          trades,
          currentKline,
          positionManager,
          config.commission || 0.001
        );

        if (!this.hasOpenPosition(trades)) {
          const setupResult = this.detectSetup(
            detectors,
            historicalKlines,
            config.setupTypes,
            config.minConfidence
          );

          if (setupResult?.setup) {
            const trade = this.executor.openPosition(
              setupResult.setup,
              currentKline,
              equity,
              config
            );

            if (trade) {
              trades.push(trade);
            }
          }
        }

        const totalPnl = this.calculateTotalPnl(trades);
        equity = config.initialCapital + totalPnl;
        peakEquity = Math.max(peakEquity, equity);
        const drawdown = peakEquity - equity;
        const drawdownPercent = (drawdown / peakEquity) * 100;

        if (currentKline) {
          equityCurve.push({
            time: new Date(currentKline.openTime).toISOString(),
            equity,
            drawdown,
            drawdownPercent,
          });
        }

        if (onProgress && i % Math.floor(filteredKlines.length / 100) === 0) {
          onProgress((i / filteredKlines.length) * 100);
        }
      }

      const lastKline = filteredKlines[filteredKlines.length - 1];
      if (lastKline) {
        this.closeAllOpenPositions(trades, lastKline);
      }

      const metrics = this.metricsCalculator.calculate(trades, config.initialCapital);

      const endTime = Date.now();

      return {
        id: resultId,
        config,
        trades,
        metrics,
        equityCurve,
        startTime: new Date(startTime).toISOString(),
        endTime: new Date(endTime).toISOString(),
        duration: endTime - startTime,
        status: 'COMPLETED',
      };
    } catch (error) {
      const endTime = Date.now();
      return {
        id: resultId,
        config,
        trades: [],
        metrics: this.metricsCalculator.createEmptyMetrics(),
        equityCurve: [],
        startTime: new Date(startTime).toISOString(),
        endTime: new Date(endTime).toISOString(),
        duration: endTime - startTime,
        status: 'FAILED',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private filterKlinesByDateRange(
    klines: Kline[],
    startDate: string,
    endDate: string
  ): Kline[] {
    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime();

    return klines.filter((kline) => {
      const time = new Date(kline.openTime).getTime();
      return time >= start && time <= end;
    });
  }

  private initializeDetectors(_config: BacktestConfig) {
    return {
      meanReversion: new MeanReversionDetector({
        enabled: true,
        minConfidence: 70,
        minRiskReward: 1.5,
        bbPeriod: 20,
        bbStdDev: 2,
        rsiPeriod: 14,
        rsiOversold: 30,
        rsiOverbought: 70,
        minVolume: 1.2,
        maxHoldBars: 50,
      }),
      gridTrading: new GridTradingDetector({
        enabled: true,
        minConfidence: 70,
        minRiskReward: 1.5,
        emaPeriod: 50,
        atrPeriod: 14,
        gridLevels: 5,
        gridSpacingATR: 2.0,
        minGridSpacing: 0.5,
        maxGridSpacing: 5.0,
        requireRanging: true,
        volumeThreshold: 1.0,
      }),
    };
  }

  private detectSetup(
    detectors: ReturnType<typeof this.initializeDetectors>,
    klines: Kline[],
    setupTypes?: string[],
    minConfidence?: number
  ) {
    const enabledDetectors = setupTypes?.length
      ? Object.entries(detectors).filter(([key, _config]) =>
          setupTypes.includes(key.replace(/([A-Z])/g, '_$1').toUpperCase())
        )
      : Object.entries(detectors);

    for (const [, detector] of enabledDetectors) {
      const setup = detector.detect(klines, klines.length - 1);
      if (setup && (!minConfidence || setup.confidence >= minConfidence)) {
        return setup;
      }
    }

    return null;
  }

  private hasOpenPosition(trades: BacktestTrade[]): boolean {
    return trades.some((trade) => trade.status === 'OPEN');
  }

  private updateOpenPositions(
    trades: BacktestTrade[],
    currentKline: Kline,
    _positionManager: PositionManager,
    commission: number
  ): void {
    const openTrades = trades.filter((trade) => trade.status === 'OPEN');

    for (const trade of openTrades) {
      if (this.executor.shouldTriggerStopLoss(trade, currentKline)) {
        trade.status = 'CLOSED';
        trade.exitTime = new Date(currentKline.openTime).toISOString();
        trade.exitPrice = trade.stopLoss || Number(currentKline.close);
        trade.exitReason = 'STOP_LOSS';
        
        const pnl =
          trade.side === 'LONG'
            ? (trade.exitPrice - trade.entryPrice) * trade.quantity
            : (trade.entryPrice - trade.exitPrice) * trade.quantity;
        
        const exitCommission = trade.exitPrice * trade.quantity * commission;
        trade.pnl = pnl;
        trade.pnlPercent = (pnl / (trade.entryPrice * trade.quantity)) * 100;
        trade.commission += exitCommission;
        trade.netPnl = pnl - trade.commission;
      } else if (this.executor.shouldTriggerTakeProfit(trade, currentKline)) {
        trade.status = 'CLOSED';
        trade.exitTime = new Date(currentKline.openTime).toISOString();
        trade.exitPrice = trade.takeProfit || Number(currentKline.close);
        trade.exitReason = 'TAKE_PROFIT';
        
        const pnl =
          trade.side === 'LONG'
            ? (trade.exitPrice - trade.entryPrice) * trade.quantity
            : (trade.entryPrice - trade.exitPrice) * trade.quantity;
        
        const exitCommission = trade.exitPrice * trade.quantity * commission;
        trade.pnl = pnl;
        trade.pnlPercent = (pnl / (trade.entryPrice * trade.quantity)) * 100;
        trade.commission += exitCommission;
        trade.netPnl = pnl - trade.commission;
      }
    }
  }

  private calculateTotalPnl(trades: BacktestTrade[]): number {
    return trades.reduce((total, trade) => total + (trade.netPnl || 0), 0);
  }

  private closeAllOpenPositions(trades: BacktestTrade[], lastKline: Kline): void {
    const openTrades = trades.filter((trade) => trade.status === 'OPEN');

    for (const trade of openTrades) {
      trade.status = 'CLOSED';
      trade.exitTime = new Date(lastKline.openTime).toISOString();
      trade.exitPrice = Number(lastKline.close);
      trade.exitReason = 'END_OF_PERIOD';

      const pnl =
        trade.side === 'LONG'
          ? (Number(lastKline.close) - trade.entryPrice) * trade.quantity
          : (trade.entryPrice - Number(lastKline.close)) * trade.quantity;

      const exitCommission = Number(lastKline.close) * trade.quantity * (0.001);
      trade.pnl = pnl;
      trade.pnlPercent = (pnl / (trade.entryPrice * trade.quantity)) * 100;
      trade.commission += exitCommission;
      trade.netPnl = pnl - trade.commission;
    }
  }
}
