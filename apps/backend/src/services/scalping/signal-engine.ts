import { randomUUID } from 'crypto';
import type { ScalpingSignal, ScalpingStrategy } from '@marketmind/types';
import { SCALPING_DEFAULTS } from '@marketmind/types';
import { SCALPING_ENGINE } from '../../constants/scalping';
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
}

type SignalHandler = (signal: ScalpingSignal) => void;

export class SignalEngine {
  private config: SignalEngineConfig;
  private signalCooldowns = new Map<string, number>();
  private circuitBreaker: CircuitBreakerState = {
    tripped: false,
    tradeCount: 0,
    sessionPnl: 0,
    lastResetTime: Date.now(),
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
    if (this.circuitBreaker.tripped) return null;
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

  recordTrade(pnl: number): void {
    this.circuitBreaker.tradeCount += 1;
    this.circuitBreaker.sessionPnl += pnl;

    if (this.config.circuitBreakerEnabled) {
      if (this.circuitBreaker.tradeCount >= this.config.circuitBreakerMaxTrades) {
        this.tripCircuitBreaker('max trades reached');
      }
      if (this.circuitBreaker.sessionPnl <= -this.config.circuitBreakerLossPercent) {
        this.tripCircuitBreaker('max loss reached');
      }
    }
  }

  resetCircuitBreaker(): void {
    this.circuitBreaker = {
      tripped: false,
      tradeCount: 0,
      sessionPnl: 0,
      lastResetTime: Date.now(),
    };
    logger.info('Scalping circuit breaker reset');
  }

  getCircuitBreakerState(): CircuitBreakerState {
    return { ...this.circuitBreaker };
  }

  updateConfig(config: Partial<SignalEngineConfig>): void {
    Object.assign(this.config, config);
  }

  private tripCircuitBreaker(reason: string): void {
    this.circuitBreaker.tripped = true;
    logger.warn({
      reason,
      tradeCount: this.circuitBreaker.tradeCount,
      sessionPnl: this.circuitBreaker.sessionPnl,
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

  private evaluateImbalance(ctx: StrategyContext): StrategyResult | null {
    const { imbalanceRatio } = ctx.metrics;
    if (Math.abs(imbalanceRatio) < this.config.imbalanceThreshold) return null;

    const direction: 'LONG' | 'SHORT' = imbalanceRatio > 0 ? 'LONG' : 'SHORT';
    const stopDistance = ctx.currentPrice * 0.002;
    const tpDistance = ctx.currentPrice * 0.003;

    return {
      shouldTrade: true,
      direction,
      confidence: Math.min(95, 50 + Math.abs(imbalanceRatio) * 50),
      strategy: 'imbalance',
      entryPrice: ctx.currentPrice,
      stopLoss: direction === 'LONG' ? ctx.currentPrice - stopDistance : ctx.currentPrice + stopDistance,
      takeProfit: direction === 'LONG' ? ctx.currentPrice + tpDistance : ctx.currentPrice - tpDistance,
    };
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

    const priceStart = firstPrice.price;
    const priceEnd = lastPrice.price;
    const cvdStart = firstCvd.value;
    const cvdEnd = lastCvd.value;

    const priceDirection = priceEnd > priceStart ? 1 : -1;
    const cvdDirection = cvdEnd > cvdStart ? 1 : -1;

    if (priceDirection === cvdDirection) return null;

    const direction: 'LONG' | 'SHORT' = cvdDirection > 0 ? 'LONG' : 'SHORT';
    const stopDistance = ctx.currentPrice * 0.003;
    const tpDistance = ctx.currentPrice * 0.004;

    return {
      shouldTrade: true,
      direction,
      confidence: 60,
      strategy: 'cvd-divergence',
      entryPrice: ctx.currentPrice,
      stopLoss: direction === 'LONG' ? ctx.currentPrice - stopDistance : ctx.currentPrice + stopDistance,
      takeProfit: direction === 'LONG' ? ctx.currentPrice + tpDistance : ctx.currentPrice - tpDistance,
    };
  }

  private evaluateMeanReversion(ctx: StrategyContext): StrategyResult | null {
    if (ctx.vwap <= 0) return null;

    const deviation = (ctx.currentPrice - ctx.vwap) / ctx.vwap;
    const sigma = this.config.vwapDeviationSigma / 100;

    if (Math.abs(deviation) < sigma) return null;

    const direction: 'LONG' | 'SHORT' = deviation > 0 ? 'SHORT' : 'LONG';
    const stopDistance = ctx.currentPrice * 0.003;
    const tpDistance = Math.abs(ctx.currentPrice - ctx.vwap) * 0.7;

    return {
      shouldTrade: true,
      direction,
      confidence: Math.min(85, 55 + Math.abs(deviation) / sigma * 15),
      strategy: 'mean-reversion',
      entryPrice: ctx.currentPrice,
      stopLoss: direction === 'LONG' ? ctx.currentPrice - stopDistance : ctx.currentPrice + stopDistance,
      takeProfit: direction === 'LONG' ? ctx.currentPrice + tpDistance : ctx.currentPrice - tpDistance,
    };
  }

  private evaluateMomentumBurst(ctx: StrategyContext): StrategyResult | null {
    if (ctx.avgVolume <= 0) return null;

    const recentVolume = ctx.metrics.largeBuyVol + ctx.metrics.largeSellVol;
    if (recentVolume < ctx.avgVolume * SCALPING_DEFAULTS.LARGE_TRADE_MULTIPLIER) return null;

    if (Math.abs(ctx.metrics.imbalanceRatio) < 0.3) return null;

    const direction: 'LONG' | 'SHORT' = ctx.metrics.imbalanceRatio > 0 ? 'LONG' : 'SHORT';
    const stopDistance = ctx.currentPrice * 0.002;
    const tpDistance = ctx.currentPrice * 0.005;

    return {
      shouldTrade: true,
      direction,
      confidence: 65,
      strategy: 'momentum-burst',
      entryPrice: ctx.currentPrice,
      stopLoss: direction === 'LONG' ? ctx.currentPrice - stopDistance : ctx.currentPrice + stopDistance,
      takeProfit: direction === 'LONG' ? ctx.currentPrice + tpDistance : ctx.currentPrice - tpDistance,
    };
  }

  private evaluateAbsorptionReversal(ctx: StrategyContext): StrategyResult | null {
    if (ctx.metrics.absorptionScore < this.config.absorptionThreshold) return null;

    const direction: 'LONG' | 'SHORT' = ctx.metrics.imbalanceRatio > 0 ? 'LONG' : 'SHORT';
    const stopDistance = ctx.currentPrice * 0.002;
    const tpDistance = ctx.currentPrice * 0.004;

    return {
      shouldTrade: true,
      direction,
      confidence: 70,
      strategy: 'absorption-reversal',
      entryPrice: ctx.currentPrice,
      stopLoss: direction === 'LONG' ? ctx.currentPrice - stopDistance : ctx.currentPrice + stopDistance,
      takeProfit: direction === 'LONG' ? ctx.currentPrice + tpDistance : ctx.currentPrice - tpDistance,
    };
  }
}
