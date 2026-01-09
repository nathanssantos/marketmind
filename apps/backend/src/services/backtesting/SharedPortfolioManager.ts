import {
  calculateDynamicExposure,
  calculatePositionExposure,
  canOpenNewPosition,
  type ExposureConfig,
} from '@marketmind/risk';
import type { TradingSetup } from '@marketmind/types';
import { generateEntityId } from '../../utils/id';

export interface PortfolioConfig {
  initialCapital: number;
  exposureMultiplier: number;
  maxPositionSizePercent: number;
  maxConcurrentPositions: number;
  dailyLossLimitPercent: number;
  cooldownMinutes: number;
  useStochasticFilter: boolean;
  useMomentumTimingFilter: boolean;
  useAdxFilter: boolean;
  useTrendFilter: boolean;
  minRiskRewardRatio: number;
  useMtfFilter?: boolean;
  useBtcCorrelationFilter?: boolean;
  useMarketRegimeFilter?: boolean;
  useVolumeFilter?: boolean;
  useFundingFilter?: boolean;
  useConfluenceScoring?: boolean;
  confluenceMinScore?: number;
}

export interface SharedPosition {
  id: string;
  watcherSymbol: string;
  watcherInterval: string;
  setupType: string;
  side: 'LONG' | 'SHORT';
  entryPrice: number;
  quantity: number;
  entryTime: number;
  stopLoss?: number;
  takeProfit?: number;
  positionValue: number;
  atr?: number;
  highestHigh: number;
  lowestLow: number;
  barsInTrade: number;
}

export interface TradeResult {
  position: SharedPosition;
  exitPrice: number;
  exitTime: number;
  pnl: number;
  pnlPercent: number;
  exitReason: string;
  commission: number;
  netPnl: number;
}

export interface FilterCheckResult {
  passed: boolean;
  reason?: string;
}

const formatDate = (timestamp: number): string => {
  return new Date(timestamp).toISOString().split('T')[0]!;
};

export class SharedPortfolioManager {
  private equity: number;
  private peakEquity: number;
  private openPositions: SharedPosition[] = [];
  private closedTrades: TradeResult[] = [];
  private dailyPnl: Map<string, number> = new Map();
  private cooldowns: Map<string, number> = new Map();
  private activeWatchersCount: number;

  constructor(
    private config: PortfolioConfig,
    activeWatchersCount: number
  ) {
    this.equity = config.initialCapital;
    this.peakEquity = config.initialCapital;
    this.activeWatchersCount = activeWatchersCount;
  }

  getExposureConfig(): ExposureConfig {
    return {
      exposureMultiplier: this.config.exposureMultiplier,
      maxPositionSizePercent: this.config.maxPositionSizePercent,
      maxConcurrentPositions: this.activeWatchersCount,
    };
  }

  calculateExposureForNewPosition(): {
    exposurePerWatcher: number;
    maxPositionValue: number;
    maxTotalExposure: number;
  } {
    return calculateDynamicExposure(
      this.equity,
      this.activeWatchersCount,
      this.getExposureConfig()
    );
  }

  getCurrentExposure(): number {
    return calculatePositionExposure(
      this.openPositions.map((p) => ({
        entryPrice: p.entryPrice,
        quantity: p.quantity,
      }))
    );
  }

  canOpenPosition(positionValue: number): FilterCheckResult {
    const { maxTotalExposure } = this.calculateExposureForNewPosition();
    const currentExposure = this.getCurrentExposure();

    const result = canOpenNewPosition(currentExposure, positionValue, maxTotalExposure);

    return {
      passed: result.allowed,
      reason: result.reason,
    };
  }

  checkMaxPositions(): FilterCheckResult {
    if (this.openPositions.length >= this.activeWatchersCount) {
      return {
        passed: false,
        reason: `Max concurrent positions reached (${this.activeWatchersCount})`,
      };
    }
    return { passed: true };
  }

  checkCooldown(
    setupType: string,
    symbol: string,
    interval: string,
    currentTime: number
  ): FilterCheckResult {
    const key = `${setupType}-${symbol}-${interval}`;
    const lastTradeTime = this.cooldowns.get(key);

    if (!lastTradeTime) {
      return { passed: true };
    }

    const cooldownMs = this.config.cooldownMinutes * 60 * 1000;
    const elapsed = currentTime - lastTradeTime;

    if (elapsed < cooldownMs) {
      const remainingMinutes = Math.ceil((cooldownMs - elapsed) / 60000);
      return {
        passed: false,
        reason: `Cooldown active (${remainingMinutes} min remaining)`,
      };
    }

    return { passed: true };
  }

  setCooldown(setupType: string, symbol: string, interval: string, time: number): void {
    const key = `${setupType}-${symbol}-${interval}`;
    this.cooldowns.set(key, time);
  }

  checkDailyLossLimit(currentDate: string): FilterCheckResult {
    const dailyPnl = this.dailyPnl.get(currentDate) ?? 0;
    const limit = -1 * this.config.initialCapital * (this.config.dailyLossLimitPercent / 100);

    if (dailyPnl <= limit) {
      return {
        passed: false,
        reason: `Daily loss limit reached (${dailyPnl.toFixed(2)} <= ${limit.toFixed(2)})`,
      };
    }

    return { passed: true };
  }

  checkOppositeDirection(symbol: string, direction: 'LONG' | 'SHORT'): FilterCheckResult {
    const oppositePosition = this.openPositions.find(
      (p) => p.watcherSymbol === symbol && p.side !== direction
    );

    if (oppositePosition) {
      return {
        passed: false,
        reason: `Opposite direction position exists (One-Way Mode)`,
      };
    }

    return { passed: true };
  }

  checkRiskReward(setup: TradingSetup): FilterCheckResult {
    if (!setup.stopLoss || !setup.takeProfit) {
      if (!setup.stopLoss) {
        return { passed: false, reason: 'Missing stop loss' };
      }
      return { passed: true };
    }

    const entryPrice = setup.entryPrice;
    const stopLoss = setup.stopLoss;
    const takeProfit = setup.takeProfit;

    let risk: number;
    let reward: number;

    if (setup.direction === 'LONG') {
      risk = entryPrice - stopLoss;
      reward = takeProfit - entryPrice;
    } else {
      risk = stopLoss - entryPrice;
      reward = entryPrice - takeProfit;
    }

    if (risk <= 0) {
      return { passed: false, reason: 'Invalid stop loss - no risk' };
    }

    const riskRewardRatio = reward / risk;

    if (riskRewardRatio < this.config.minRiskRewardRatio) {
      return {
        passed: false,
        reason: `Insufficient R:R (${riskRewardRatio.toFixed(2)} < ${this.config.minRiskRewardRatio})`,
      };
    }

    return { passed: true };
  }

  checkWatcherPositionLimit(symbol: string, interval: string): FilterCheckResult {
    const watcherPositions = this.openPositions.filter(
      (p) => p.watcherSymbol === symbol && p.watcherInterval === interval
    );

    if (watcherPositions.length >= 1) {
      return {
        passed: false,
        reason: 'Watcher already has an open position',
      };
    }

    return { passed: true };
  }

  runAllFilters(
    setup: TradingSetup,
    symbol: string,
    interval: string,
    currentTime: number,
    positionValue: number
  ): FilterCheckResult {
    const currentDate = formatDate(currentTime);

    const checks = [
      { name: 'riskReward', result: this.checkRiskReward(setup) },
      { name: 'maxPositions', result: this.checkMaxPositions() },
      { name: 'cooldown', result: this.checkCooldown(setup.type, symbol, interval, currentTime) },
      { name: 'dailyLoss', result: this.checkDailyLossLimit(currentDate) },
      { name: 'oppositeDirection', result: this.checkOppositeDirection(symbol, setup.direction) },
      { name: 'watcherLimit', result: this.checkWatcherPositionLimit(symbol, interval) },
      { name: 'exposure', result: this.canOpenPosition(positionValue) },
    ];

    for (const check of checks) {
      if (!check.result.passed) {
        return {
          passed: false,
          reason: `[${check.name}] ${check.result.reason}`,
        };
      }
    }

    return { passed: true };
  }

  openPosition(
    setup: TradingSetup,
    symbol: string,
    interval: string,
    quantity: number,
    entryTime: number
  ): SharedPosition {
    const positionValue = setup.entryPrice * quantity;

    const position: SharedPosition = {
      id: generateEntityId(),
      watcherSymbol: symbol,
      watcherInterval: interval,
      setupType: setup.type,
      side: setup.direction,
      entryPrice: setup.entryPrice,
      quantity,
      entryTime,
      stopLoss: setup.stopLoss,
      takeProfit: setup.takeProfit,
      positionValue,
      atr: setup.atr,
      highestHigh: setup.entryPrice,
      lowestLow: setup.entryPrice,
      barsInTrade: 0,
    };

    this.openPositions.push(position);
    this.setCooldown(setup.type, symbol, interval, entryTime);

    return position;
  }

  updatePositionTrailingState(
    positionId: string,
    high: number,
    low: number,
    newStopLoss?: number
  ): void {
    const position = this.openPositions.find((p) => p.id === positionId);
    if (!position) return;

    position.barsInTrade++;
    if (high > position.highestHigh) position.highestHigh = high;
    if (low < position.lowestLow) position.lowestLow = low;
    if (newStopLoss !== undefined) position.stopLoss = newStopLoss;
  }

  updatePositionPriceExtremes(
    positionId: string,
    high: number,
    low: number,
    newStopLoss?: number
  ): void {
    const position = this.openPositions.find((p) => p.id === positionId);
    if (!position) return;

    if (high > position.highestHigh) position.highestHigh = high;
    if (low < position.lowestLow) position.lowestLow = low;
    if (newStopLoss !== undefined) position.stopLoss = newStopLoss;
  }

  incrementBarsInTrade(positionId: string): void {
    const position = this.openPositions.find((p) => p.id === positionId);
    if (position) position.barsInTrade++;
  }

  closePosition(
    positionId: string,
    exitPrice: number,
    exitTime: number,
    exitReason: string,
    commission: number
  ): TradeResult | undefined {
    const index = this.openPositions.findIndex((p) => p.id === positionId);
    if (index < 0) return undefined;

    const position = this.openPositions.splice(index, 1)[0]!;

    let pnl: number;
    if (position.side === 'LONG') {
      pnl = (exitPrice - position.entryPrice) * position.quantity;
    } else {
      pnl = (position.entryPrice - exitPrice) * position.quantity;
    }

    const netPnl = pnl - commission;
    const pnlPercent = (pnl / position.positionValue) * 100;

    const tradeResult: TradeResult = {
      position,
      exitPrice,
      exitTime,
      pnl,
      pnlPercent,
      exitReason,
      commission,
      netPnl,
    };

    this.closedTrades.push(tradeResult);
    this.updateEquity(netPnl, formatDate(exitTime));

    return tradeResult;
  }

  updateEquity(pnl: number, date: string): void {
    this.equity += pnl;

    if (this.equity > this.peakEquity) {
      this.peakEquity = this.equity;
    }

    const currentDaily = this.dailyPnl.get(date) ?? 0;
    this.dailyPnl.set(date, currentDaily + pnl);
  }

  getEquity(): number {
    return this.equity;
  }

  getPeakEquity(): number {
    return this.peakEquity;
  }

  getMaxDrawdown(): number {
    return this.peakEquity - this.equity;
  }

  getMaxDrawdownPercent(): number {
    if (this.peakEquity <= 0) return 0;
    return ((this.peakEquity - this.equity) / this.peakEquity) * 100;
  }

  getOpenPositions(): SharedPosition[] {
    return [...this.openPositions];
  }

  getClosedTrades(): TradeResult[] {
    return [...this.closedTrades];
  }

  getPositionForWatcher(symbol: string, interval: string): SharedPosition | undefined {
    return this.openPositions.find(
      (p) => p.watcherSymbol === symbol && p.watcherInterval === interval
    );
  }

  getDailyPnl(): Map<string, number> {
    return new Map(this.dailyPnl);
  }

  getState(): {
    equity: number;
    peakEquity: number;
    openPositions: SharedPosition[];
    closedTrades: number;
    currentExposure: number;
    exposurePercent: number;
  } {
    const { maxTotalExposure } = this.calculateExposureForNewPosition();
    const currentExposure = this.getCurrentExposure();

    return {
      equity: this.equity,
      peakEquity: this.peakEquity,
      openPositions: [...this.openPositions],
      closedTrades: this.closedTrades.length,
      currentExposure,
      exposurePercent: maxTotalExposure > 0 ? (currentExposure / maxTotalExposure) * 100 : 0,
    };
  }
}
