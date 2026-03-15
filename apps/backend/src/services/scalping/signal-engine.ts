import { randomUUID } from 'crypto';
import type { ScalpingSignal, ScalpingStrategy } from '@marketmind/types';
import { SCALPING_DEFAULTS } from '@marketmind/types';
import { SCALPING_ENGINE, SCALPING_STRATEGY } from '../../constants/scalping';
import type { CircuitBreakerState, StrategyContext, StrategyResult } from './types';
import { logger } from '../logger';

export interface SignalEngineConfig {
  enabledStrategies: ScalpingStrategy[];
  imbalanceThreshold: number;
  cvdDivergenceBars: number;
  vwapDeviationSigma: number;
  largeTradeMult: number;
  absorptionThreshold: number;
  maxSpreadPercent: number;
  circuitBreakerEnabled: boolean;
  circuitBreakerLossPercent: number;
  circuitBreakerMaxTrades: number;
  maxDailyTrades: number;
  maxDailyLossPercent: number;
}

type SignalHandler = (signal: ScalpingSignal) => void;

const getStartOfDayUTC = (): number => {
  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
};

export class SignalEngine {
  private config: SignalEngineConfig;
  private signalCooldowns = new Map<string, number>();
  private circuitBreaker: CircuitBreakerState = {
    tripped: false,
    tradeCount: 0,
    sessionPnl: 0,
    winCount: 0,
    lossCount: 0,
    lastResetTime: Date.now(),
    dailyTradeCount: 0,
    dailyPnl: 0,
    dailyResetTime: getStartOfDayUTC(),
    consecutiveLosses: 0,
    cooldownUntil: 0,
  };
  private handlers: SignalHandler[] = [];

  constructor(config: SignalEngineConfig) {
    this.config = config;
  }

  onSignal(handler: SignalHandler): () => void {
    this.handlers.push(handler);
    return () => {
      const idx = this.handlers.indexOf(handler);
      if (idx >= 0) this.handlers.splice(idx, 1);
    };
  }

  evaluate(context: StrategyContext): ScalpingSignal | null {
    this.checkDailyReset();

    if (this.circuitBreaker.tripped) return null;

    if (this.circuitBreaker.cooldownUntil > Date.now()) return null;

    if (this.config.circuitBreakerEnabled && context.walletBalance > 0) {
      const dailyLossThreshold = context.walletBalance * this.config.maxDailyLossPercent / 100;
      if (this.circuitBreaker.dailyPnl <= -dailyLossThreshold) {
        this.tripCircuitBreaker('daily loss limit reached');
        return null;
      }
      if (this.circuitBreaker.dailyTradeCount >= this.config.maxDailyTrades) {
        this.tripCircuitBreaker('daily trade limit reached');
        return null;
      }
    }

    if (context.metrics.spreadPercent > this.config.maxSpreadPercent) return null;

    for (const strategy of this.config.enabledStrategies) {
      const cooldownKey = `${context.symbol}:${strategy}`;
      const lastSignal = this.signalCooldowns.get(cooldownKey) ?? 0;
      if (Date.now() - lastSignal < SCALPING_ENGINE.SIGNAL_COOLDOWN_MS) continue;

      const result = this.evaluateStrategy(strategy, context);
      if (!result || !result.shouldTrade) continue;

      const signal: ScalpingSignal = {
        id: randomUUID(),
        symbol: context.symbol,
        strategy: result.strategy,
        direction: result.direction,
        entryPrice: result.entryPrice,
        stopLoss: result.stopLoss,
        takeProfit: result.takeProfit,
        confidence: result.confidence,
        metrics: { ...context.metrics },
        timestamp: Date.now(),
      };

      this.signalCooldowns.set(cooldownKey, Date.now());

      for (const handler of this.handlers) {
        try {
          handler(signal);
        } catch (err) {
          logger.warn({ error: err }, 'Signal handler error');
        }
      }

      return signal;
    }

    return null;
  }

  recordTrade(pnl: number, walletBalance: number): void {
    this.checkDailyReset();

    this.circuitBreaker.tradeCount += 1;
    this.circuitBreaker.sessionPnl += pnl;
    this.circuitBreaker.dailyTradeCount += 1;
    this.circuitBreaker.dailyPnl += pnl;
    if (pnl > 0) {
      this.circuitBreaker.winCount += 1;
      this.circuitBreaker.consecutiveLosses = 0;
    } else if (pnl < 0) {
      this.circuitBreaker.lossCount += 1;
      this.circuitBreaker.consecutiveLosses += 1;
      if (this.circuitBreaker.consecutiveLosses >= SCALPING_ENGINE.MAX_CONSECUTIVE_LOSSES) {
        this.circuitBreaker.cooldownUntil = Date.now() + SCALPING_ENGINE.CONSECUTIVE_LOSS_COOLDOWN_MS;
        this.circuitBreaker.consecutiveLosses = 0;
        logger.warn({
          cooldownMinutes: SCALPING_ENGINE.CONSECUTIVE_LOSS_COOLDOWN_MS / 60_000,
          cooldownUntil: new Date(this.circuitBreaker.cooldownUntil).toISOString(),
        }, 'Consecutive loss cooldown activated');
      }
    }

    if (this.config.circuitBreakerEnabled) {
      if (this.circuitBreaker.tradeCount >= this.config.circuitBreakerMaxTrades) {
        this.tripCircuitBreaker('max session trades reached');
      }
      if (walletBalance > 0) {
        const sessionLossThreshold = walletBalance * this.config.circuitBreakerLossPercent / 100;
        if (this.circuitBreaker.sessionPnl <= -sessionLossThreshold) {
          this.tripCircuitBreaker('max session loss reached');
        }
        const dailyLossThreshold = walletBalance * this.config.maxDailyLossPercent / 100;
        if (this.circuitBreaker.dailyPnl <= -dailyLossThreshold) {
          this.tripCircuitBreaker('daily loss limit reached');
        }
      }
      if (this.circuitBreaker.dailyTradeCount >= this.config.maxDailyTrades) {
        this.tripCircuitBreaker('daily trade limit reached');
      }
    }
  }

  resetCircuitBreaker(): void {
    this.circuitBreaker = {
      tripped: false,
      tradeCount: 0,
      sessionPnl: 0,
      winCount: 0,
      lossCount: 0,
      lastResetTime: Date.now(),
      dailyTradeCount: 0,
      dailyPnl: 0,
      dailyResetTime: getStartOfDayUTC(),
      consecutiveLosses: 0,
      cooldownUntil: 0,
    };
    logger.info('Scalping circuit breaker reset');
  }

  getCircuitBreakerState(): CircuitBreakerState {
    return { ...this.circuitBreaker };
  }

  updateConfig(config: Partial<SignalEngineConfig>): void {
    Object.assign(this.config, config);
  }

  private checkDailyReset(): void {
    const todayStart = getStartOfDayUTC();
    if (todayStart > this.circuitBreaker.dailyResetTime) {
      this.circuitBreaker.dailyTradeCount = 0;
      this.circuitBreaker.dailyPnl = 0;
      this.circuitBreaker.dailyResetTime = todayStart;

      if (this.circuitBreaker.tripped) {
        logger.info('Daily reset: clearing circuit breaker trip from previous day');
        this.circuitBreaker.tripped = false;
      }

      logger.info('Scalping daily counters reset (midnight UTC)');
    }
  }

  private tripCircuitBreaker(reason: string): void {
    this.circuitBreaker.tripped = true;
    logger.warn({
      reason,
      tradeCount: this.circuitBreaker.tradeCount,
      sessionPnl: this.circuitBreaker.sessionPnl,
      dailyTradeCount: this.circuitBreaker.dailyTradeCount,
      dailyPnl: this.circuitBreaker.dailyPnl,
    }, 'Scalping circuit breaker tripped');
  }

  private evaluateStrategy(strategy: ScalpingStrategy, ctx: StrategyContext): StrategyResult | null {
    switch (strategy) {
      case 'imbalance': return this.evaluateImbalance(ctx);
      case 'cvd-divergence': return this.evaluateCVDDivergence(ctx);
      case 'mean-reversion': return this.evaluateMeanReversion(ctx);
      case 'momentum-burst': return this.evaluateMomentumBurst(ctx);
      case 'absorption-reversal': return this.evaluateAbsorptionReversal(ctx);
      default: return null;
    }
  }

  private buildResult(
    direction: 'LONG' | 'SHORT',
    strategy: ScalpingStrategy,
    confidence: number,
    price: number,
    slPercent: number,
    tpDistance: number,
  ): StrategyResult {
    return {
      shouldTrade: true,
      direction,
      confidence,
      strategy,
      entryPrice: price,
      stopLoss: direction === 'LONG' ? price - price * slPercent : price + price * slPercent,
      takeProfit: direction === 'LONG' ? price + tpDistance : price - tpDistance,
    };
  }

  private evaluateImbalance(ctx: StrategyContext): StrategyResult | null {
    const { imbalanceRatio } = ctx.metrics;
    if (Math.abs(imbalanceRatio) < this.config.imbalanceThreshold) return null;

    const direction: 'LONG' | 'SHORT' = imbalanceRatio > 0 ? 'LONG' : 'SHORT';
    const confidence = Math.min(
      SCALPING_STRATEGY.IMBALANCE_MAX_CONFIDENCE,
      SCALPING_STRATEGY.IMBALANCE_BASE_CONFIDENCE + Math.abs(imbalanceRatio) * 50,
    );

    return this.buildResult(
      direction, 'imbalance', confidence, ctx.currentPrice,
      SCALPING_STRATEGY.IMBALANCE_SL_PERCENT,
      ctx.currentPrice * SCALPING_STRATEGY.IMBALANCE_TP_PERCENT,
    );
  }

  private evaluateCVDDivergence(ctx: StrategyContext): StrategyResult | null {
    const cvd = ctx.cvdState;
    if (cvd.history.length < this.config.cvdDivergenceBars || cvd.priceHistory.length < this.config.cvdDivergenceBars) return null;

    const recentPrices = cvd.priceHistory.slice(-this.config.cvdDivergenceBars);
    const recentCvd = cvd.history.slice(-this.config.cvdDivergenceBars);

    const firstPrice = recentPrices[0];
    const lastPrice = recentPrices[recentPrices.length - 1];
    const firstCvd = recentCvd[0];
    const lastCvd = recentCvd[recentCvd.length - 1];
    if (!firstPrice || !lastPrice || !firstCvd || !lastCvd) return null;

    const priceDirection = lastPrice.price > firstPrice.price ? 1 : -1;
    const cvdDirection = lastCvd.value > firstCvd.value ? 1 : -1;
    if (priceDirection === cvdDirection) return null;

    const direction: 'LONG' | 'SHORT' = cvdDirection > 0 ? 'LONG' : 'SHORT';

    return this.buildResult(
      direction, 'cvd-divergence', SCALPING_STRATEGY.CVD_DIVERGENCE_CONFIDENCE, ctx.currentPrice,
      SCALPING_STRATEGY.CVD_DIVERGENCE_SL_PERCENT,
      ctx.currentPrice * SCALPING_STRATEGY.CVD_DIVERGENCE_TP_PERCENT,
    );
  }

  private evaluateMeanReversion(ctx: StrategyContext): StrategyResult | null {
    if (ctx.vwap <= 0) return null;

    const deviation = (ctx.currentPrice - ctx.vwap) / ctx.vwap;
    const sigma = this.config.vwapDeviationSigma / 100;
    if (Math.abs(deviation) < sigma) return null;

    const direction: 'LONG' | 'SHORT' = deviation > 0 ? 'SHORT' : 'LONG';
    const confidence = Math.min(
      SCALPING_STRATEGY.MEAN_REVERSION_MAX_CONFIDENCE,
      SCALPING_STRATEGY.MEAN_REVERSION_BASE_CONFIDENCE + Math.abs(deviation) / sigma * 15,
    );

    return this.buildResult(
      direction, 'mean-reversion', confidence, ctx.currentPrice,
      SCALPING_STRATEGY.MEAN_REVERSION_SL_PERCENT,
      Math.abs(ctx.currentPrice - ctx.vwap) * SCALPING_STRATEGY.MEAN_REVERSION_TP_RATIO,
    );
  }

  private evaluateMomentumBurst(ctx: StrategyContext): StrategyResult | null {
    if (ctx.avgVolume <= 0) return null;

    const recentVolume = ctx.metrics.largeBuyVol + ctx.metrics.largeSellVol;
    if (recentVolume < ctx.avgVolume * SCALPING_DEFAULTS.LARGE_TRADE_MULTIPLIER) return null;
    if (Math.abs(ctx.metrics.imbalanceRatio) < SCALPING_STRATEGY.MOMENTUM_BURST_MIN_IMBALANCE) return null;

    const direction: 'LONG' | 'SHORT' = ctx.metrics.imbalanceRatio > 0 ? 'LONG' : 'SHORT';

    return this.buildResult(
      direction, 'momentum-burst', SCALPING_STRATEGY.MOMENTUM_BURST_CONFIDENCE, ctx.currentPrice,
      SCALPING_STRATEGY.MOMENTUM_BURST_SL_PERCENT,
      ctx.currentPrice * SCALPING_STRATEGY.MOMENTUM_BURST_TP_PERCENT,
    );
  }

  private evaluateAbsorptionReversal(ctx: StrategyContext): StrategyResult | null {
    if (ctx.metrics.absorptionScore < this.config.absorptionThreshold) return null;

    const direction: 'LONG' | 'SHORT' = ctx.metrics.imbalanceRatio > 0 ? 'LONG' : 'SHORT';

    return this.buildResult(
      direction, 'absorption-reversal', SCALPING_STRATEGY.ABSORPTION_CONFIDENCE, ctx.currentPrice,
      SCALPING_STRATEGY.ABSORPTION_SL_PERCENT,
      ctx.currentPrice * SCALPING_STRATEGY.ABSORPTION_TP_PERCENT,
    );
  }
}
