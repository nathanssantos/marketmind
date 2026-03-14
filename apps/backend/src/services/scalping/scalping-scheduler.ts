import type { ScalpingStrategy, ScalpingExecutionMode, ScalpingMetrics, AggTrade, BookTickerUpdate, DepthUpdate } from '@marketmind/types';
import { db } from '../../db';
import { scalpingConfig } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { MetricsComputer } from './metrics-computer';
import { SignalEngine } from './signal-engine';
import { ExecutionEngine } from './execution-engine';
import { binanceBookTickerStreamService } from '../binance-book-ticker-stream';
import { binanceAggTradeStreamService } from '../binance-agg-trade-stream';
import { binanceDepthStreamService } from '../binance-depth-stream';
import { getWebSocketService } from '../websocket';
import { logger } from '../logger';
import type { StrategyContext } from './types';

interface ActiveSession {
  walletId: string;
  userId: string;
  symbols: string[];
  metricsComputer: MetricsComputer;
  signalEngine: SignalEngine;
  executionEngine: ExecutionEngine | null;
  unsubscribers: Array<() => void>;
  isAutoTrading: boolean;
}

export class ScalpingScheduler {
  private sessions = new Map<string, ActiveSession>();

  async startScalping(walletId: string): Promise<void> {
    if (this.sessions.has(walletId)) {
      logger.warn({ walletId }, 'Scalping already running for wallet');
      return;
    }

    const config = await db.query.scalpingConfig.findFirst({
      where: eq(scalpingConfig.walletId, walletId),
    });

    if (!config) throw new Error('Scalping config not found for wallet');

    const symbols: string[] = JSON.parse(config.symbols);
    const enabledStrategies: ScalpingStrategy[] = JSON.parse(config.enabledStrategies);

    if (symbols.length === 0) throw new Error('No symbols configured for scalping');

    const metricsComputer = new MetricsComputer();
    const signalEngine = new SignalEngine({
      enabledStrategies,
      imbalanceThreshold: parseFloat(config.imbalanceThreshold ?? String(0.6)),
      cvdDivergenceBars: config.cvdDivergenceBars ?? 10,
      vwapDeviationSigma: parseFloat(config.vwapDeviationSigma ?? String(2.0)),
      largeTradeMult: parseFloat(config.largeTradeMult ?? String(5.0)),
      absorptionThreshold: parseFloat(config.absorptionThreshold ?? String(3.0)),
      maxSpreadPercent: parseFloat(config.maxSpreadPercent ?? String(0.05)),
      circuitBreakerEnabled: config.circuitBreakerEnabled,
      circuitBreakerLossPercent: parseFloat(config.circuitBreakerLossPercent ?? String(2.0)),
      circuitBreakerMaxTrades: config.circuitBreakerMaxTrades ?? 50,
    });

    let executionEngine: ExecutionEngine | null = null;
    const isAutoTrading = config.isEnabled;

    if (isAutoTrading) {
      executionEngine = new ExecutionEngine(
        {
          walletId: config.walletId,
          userId: config.userId,
          executionMode: (config.executionMode ?? 'POST_ONLY') as ScalpingExecutionMode,
          positionSizePercent: parseFloat(config.positionSizePercent ?? String(1)),
          leverage: config.leverage ?? 5,
          maxConcurrentPositions: config.maxConcurrentPositions ?? 1,
          microTrailingTicks: config.microTrailingTicks ?? 3,
        },
        signalEngine,
      );

      signalEngine.onSignal((signal) => {
        void executionEngine!.executeSignal(signal);

        const wsService = getWebSocketService();
        if (wsService) {
          wsService.emitScalpingSignal(walletId, signal);
        }
      });
    } else {
      signalEngine.onSignal((signal) => {
        const wsService = getWebSocketService();
        if (wsService) {
          wsService.emitScalpingSignal(walletId, signal);
        }
      });
    }

    const unsubscribers: Array<() => void> = [];

    const aggTradeUnsub = binanceAggTradeStreamService.onAggTradeUpdate((trade: AggTrade) => {
      if (!symbols.includes(trade.symbol)) return;
      metricsComputer.processAggTrade(trade);
      this.evaluateSignal(walletId, trade.symbol, trade.price);
    });
    unsubscribers.push(aggTradeUnsub);

    const bookTickerUnsub = binanceBookTickerStreamService.onBookTickerUpdate((update: BookTickerUpdate) => {
      if (!symbols.includes(update.symbol)) return;
      metricsComputer.processBookTicker(update);
    });
    unsubscribers.push(bookTickerUnsub);

    const depthUnsub = binanceDepthStreamService.onDepthUpdate((update: DepthUpdate) => {
      if (!symbols.includes(update.symbol)) return;
      metricsComputer.processDepthUpdate(update);
    });
    unsubscribers.push(depthUnsub);

    for (const symbol of symbols) {
      metricsComputer.startForSymbol(symbol);
      binanceBookTickerStreamService.subscribe(symbol);
      binanceAggTradeStreamService.subscribe(symbol);
      binanceDepthStreamService.subscribe(symbol);
    }

    this.sessions.set(walletId, {
      walletId,
      userId: config.userId,
      symbols,
      metricsComputer,
      signalEngine,
      executionEngine,
      unsubscribers,
      isAutoTrading,
    });

    logger.info({
      walletId,
      symbols,
      strategies: enabledStrategies,
      autoTrading: isAutoTrading,
    }, 'Scalping started');
  }

  stopScalping(walletId: string): void {
    const session = this.sessions.get(walletId);
    if (!session) return;

    for (const unsub of session.unsubscribers) unsub();

    for (const symbol of session.symbols) {
      session.metricsComputer.stopForSymbol(symbol);
      binanceBookTickerStreamService.unsubscribe(symbol);
      binanceAggTradeStreamService.unsubscribe(symbol);
      binanceDepthStreamService.unsubscribe(symbol);
    }

    session.executionEngine?.stop();
    this.sessions.delete(walletId);

    logger.info({ walletId }, 'Scalping stopped');
  }

  getStatus(walletId: string): {
    isRunning: boolean;
    sessionPnl: number;
    tradeCount: number;
    winRate: number;
    circuitBreakerTripped: boolean;
  } {
    const session = this.sessions.get(walletId);
    if (!session) {
      return { isRunning: false, sessionPnl: 0, tradeCount: 0, winRate: 0, circuitBreakerTripped: false };
    }

    const cb = session.signalEngine.getCircuitBreakerState();
    return {
      isRunning: true,
      sessionPnl: cb.sessionPnl,
      tradeCount: cb.tradeCount,
      winRate: 0,
      circuitBreakerTripped: cb.tripped,
    };
  }

  resetCircuitBreaker(walletId: string): void {
    const session = this.sessions.get(walletId);
    if (!session) return;
    session.signalEngine.resetCircuitBreaker();
  }

  getMetrics(walletId: string, symbol: string): ScalpingMetrics | null {
    const session = this.sessions.get(walletId);
    if (!session) return null;
    return session.metricsComputer.getMetrics(symbol);
  }

  async restoreFromDb(): Promise<void> {
    const configs = await db.query.scalpingConfig.findMany({
      where: eq(scalpingConfig.isEnabled, true),
    });

    for (const config of configs) {
      try {
        await this.startScalping(config.walletId);
        logger.info({ walletId: config.walletId }, 'Scalping restored from DB');
      } catch (error) {
        logger.error({ walletId: config.walletId, error }, 'Failed to restore scalping session');
      }
    }
  }

  isRunning(walletId: string): boolean {
    return this.sessions.has(walletId);
  }

  private evaluateSignal(walletId: string, symbol: string, currentPrice: number): void {
    const session = this.sessions.get(walletId);
    if (!session) return;

    const metrics = session.metricsComputer.getMetrics(symbol);
    const cvdState = session.metricsComputer.getCVDState(symbol);
    if (!cvdState) return;

    const volumeProfile = session.metricsComputer.getVolumeProfile(symbol);
    const vwap = volumeProfile?.poc ?? 0;

    const tradeBuffer = session.metricsComputer.getTradeBuffer(symbol);
    const avgVolume = tradeBuffer && tradeBuffer.length > 0
      ? tradeBuffer.reduce((sum, t) => sum + t.quantity, 0) / tradeBuffer.length
      : 0;

    const context: StrategyContext = {
      symbol,
      metrics,
      cvdState,
      currentPrice,
      vwap,
      avgVolume,
    };

    session.signalEngine.evaluate(context);
  }
}

let scalpingScheduler: ScalpingScheduler | null = null;

export const getScalpingScheduler = (): ScalpingScheduler => {
  if (!scalpingScheduler) {
    scalpingScheduler = new ScalpingScheduler();
  }
  return scalpingScheduler;
};
