import type { Kline, MarketType } from '@marketmind/types';
import { getRoundTripFee } from '@marketmind/types';
import { calculateAutoStopOffset } from '../../trailing-stop';
import {
  computeTrailingStopCore,
  hasReachedTPProgressThreshold,
  type TrailingStopCoreInput,
  type TrailingStopCoreConfig,
} from '../../trailing-stop-core';
import type { GranularPriceIndex } from './GranularPriceIndex';
import type {
  BacktestTradeSetup,
  DirectionalTrailingConfig,
  TrailingSimulationState,
  TrailingSimulationResult,
  TrailingExitReason,
} from './types';

export interface TrailingStopSimulatorConfig {
  trailingStopEnabled: boolean;
  long: DirectionalTrailingConfig;
  short: DirectionalTrailingConfig;
  useAdaptiveTrailing: boolean;
  marketType: MarketType;
  useBnbDiscount: boolean;
  vipLevel: number;
}

const parseKlinePrice = (value: string | number): number =>
  typeof value === 'string' ? parseFloat(value) : value;

export class TrailingStopSimulator {
  private config: TrailingStopSimulatorConfig;
  private feePercent: number;

  constructor(
    config: TrailingStopSimulatorConfig,
    private granularIndex: GranularPriceIndex
  ) {
    this.config = config;
    this.feePercent = getRoundTripFee({
      marketType: config.marketType,
      useBnbDiscount: config.useBnbDiscount,
      vipLevel: config.vipLevel,
    });
  }

  simulateTrade(trade: BacktestTradeSetup): TrailingSimulationResult {
    const state = this.initializeState(trade);
    const isLong = trade.side === 'LONG';
    const maxExitTime = trade.maxExitTime ?? this.granularIndex.lastTimestamp;

    let barsInTrade = 0;
    let maxFavorableExcursion = 0;
    let maxAdverseExcursion = 0;

    for (const kline of this.granularIndex.iterate(trade.entryTime, maxExitTime)) {
      barsInTrade++;

      const high = parseKlinePrice(kline.high);
      const low = parseKlinePrice(kline.low);
      const close = parseKlinePrice(kline.close);

      const mfe = isLong
        ? (high - trade.entryPrice) / trade.entryPrice
        : (trade.entryPrice - low) / trade.entryPrice;
      const mae = isLong
        ? (trade.entryPrice - low) / trade.entryPrice
        : (high - trade.entryPrice) / trade.entryPrice;

      maxFavorableExcursion = Math.max(maxFavorableExcursion, mfe);
      maxAdverseExcursion = Math.max(maxAdverseExcursion, mae);

      const slHit = isLong
        ? low <= state.currentStopLoss
        : high >= state.currentStopLoss;

      if (slHit) {
        const exitReason: TrailingExitReason = state.isActivated ? 'TRAILING_STOP' : 'STOP_LOSS';
        return this.createResult(trade, state, state.currentStopLoss, kline.closeTime, exitReason, {
          maxFavorableExcursion,
          maxAdverseExcursion,
          totalBarsInTrade: barsInTrade,
        });
      }

      const tpHit = isLong
        ? high >= trade.takeProfit
        : low <= trade.takeProfit;

      if (tpHit) {
        return this.createResult(trade, state, trade.takeProfit, kline.closeTime, 'TAKE_PROFIT', {
          maxFavorableExcursion,
          maxAdverseExcursion,
          totalBarsInTrade: barsInTrade,
        });
      }

      if (isLong) {
        state.highestPrice = Math.max(state.highestPrice, high);
      } else {
        state.lowestPrice = Math.min(state.lowestPrice, low);
      }

      if (this.config.trailingStopEnabled) {
        this.processTrailingStop(kline, close, trade, state);
      }
    }

    const lastKline = this.granularIndex.getKlineBefore(maxExitTime + 1);
    const exitPrice = lastKline ? parseKlinePrice(lastKline.close) : trade.entryPrice;
    const exitTime = lastKline?.closeTime ?? maxExitTime;

    return this.createResult(trade, state, exitPrice, exitTime, 'END_OF_PERIOD', {
      maxFavorableExcursion,
      maxAdverseExcursion,
      totalBarsInTrade: barsInTrade,
    });
  }

  private initializeState(trade: BacktestTradeSetup): TrailingSimulationState {
    return {
      isActivated: false,
      activatedAt: null,
      highestPrice: trade.entryPrice,
      lowestPrice: trade.entryPrice,
      currentStopLoss: trade.stopLoss,
      stopLossHistory: [],
    };
  }

  private processTrailingStop(
    kline: Kline,
    currentPrice: number,
    trade: BacktestTradeSetup,
    state: TrailingSimulationState
  ): void {
    const isLong = trade.side === 'LONG';
    const dirConfig = isLong ? this.config.long : this.config.short;

    if (!state.isActivated) {
      const shouldActivate = this.checkActivation(currentPrice, trade, dirConfig, isLong);
      if (shouldActivate) {
        state.isActivated = true;
        state.activatedAt = kline.closeTime;
      }
    }

    if (!state.isActivated) return;

    const coreConfig: TrailingStopCoreConfig = {
      minTrailingDistancePercent: 0.002,
      atrMultiplier: dirConfig.atrMultiplier,
      trailingDistancePercent: dirConfig.distancePercent / 100,
      useFibonacciThresholds: !!trade.fibonacciProjection,
      activationPercentLong: this.config.long.activationPercent / 100,
      activationPercentShort: this.config.short.activationPercent / 100,
    };

    const coreInput: TrailingStopCoreInput = {
      entryPrice: trade.entryPrice,
      currentPrice,
      currentStopLoss: state.currentStopLoss,
      side: trade.side,
      takeProfit: trade.takeProfit,
      atr: trade.atr,
      highestPrice: state.highestPrice,
      lowestPrice: state.lowestPrice,
      fibonacciProjection: trade.fibonacciProjection,
    };

    const result = computeTrailingStopCore(coreInput, coreConfig);

    if (result) {
      let offsetPercent = dirConfig.stopOffsetPercent ?? 0;
      if (dirConfig.trailingDistanceMode === 'auto' && trade.atr && trade.atr > 0 && currentPrice > 0) {
        const atrPercent = trade.atr / currentPrice;
        offsetPercent = calculateAutoStopOffset(atrPercent);
      }

      let adjustedStop = result.newStopLoss;
      if (offsetPercent > 0) {
        const isLong = trade.side === 'LONG';
        adjustedStop = isLong
          ? adjustedStop * (1 - offsetPercent)
          : adjustedStop * (1 + offsetPercent);
      }

      state.currentStopLoss = adjustedStop;
      state.stopLossHistory.push({
        timestamp: kline.closeTime,
        price: adjustedStop,
        reason: result.reason,
      });
    }
  }

  private checkActivation(
    currentPrice: number,
    trade: BacktestTradeSetup,
    dirConfig: DirectionalTrailingConfig,
    isLong: boolean
  ): boolean {
    const activationLevel = dirConfig.activationPercent / 100;

    return hasReachedTPProgressThreshold(
      trade.entryPrice,
      currentPrice,
      trade.takeProfit,
      trade.fibonacciProjection,
      isLong,
      isLong ? activationLevel : undefined,
      isLong ? undefined : activationLevel
    );
  }

  private createResult(
    trade: BacktestTradeSetup,
    state: TrailingSimulationState,
    exitPrice: number,
    exitTime: number,
    exitReason: TrailingExitReason,
    pathSummary: { maxFavorableExcursion: number; maxAdverseExcursion: number; totalBarsInTrade: number }
  ): TrailingSimulationResult {
    const isLong = trade.side === 'LONG';
    const priceDiff = isLong ? exitPrice - trade.entryPrice : trade.entryPrice - exitPrice;
    const pnl = priceDiff * trade.quantity;
    const pnlPercent = (priceDiff / trade.entryPrice) * 100;
    const commission = trade.entryPrice * trade.quantity * this.feePercent;
    const netPnl = pnl - commission;

    return {
      tradeId: trade.id,
      exitPrice,
      exitTime,
      exitReason,
      trailingState: { ...state },
      pnl,
      pnlPercent,
      commission,
      netPnl,
      pricePathSummary: {
        ...pathSummary,
        timeToActivation: state.activatedAt ? state.activatedAt - trade.entryTime : null,
      },
    };
  }
}

export const createTrailingStopSimulator = (
  config: TrailingStopSimulatorConfig,
  granularIndex: GranularPriceIndex
): TrailingStopSimulator => {
  return new TrailingStopSimulator(config, granularIndex);
};
