import type { ScalpingStrategy, ScalpingMetrics, AggTrade, BookTickerUpdate, DepthUpdate, VolumeProfile } from '@marketmind/types';
import { SCALPING_DEFAULTS } from '@marketmind/types';
import { db } from '../../db';
import { scalpingConfig } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { MetricsComputer } from './metrics-computer';
import { SignalEngine } from './signal-engine';
import { ExecutionEngine } from './execution-engine';
import { KlineIndicatorManager } from './kline-indicator-manager';
import { getPositionEventBus } from './position-event-bus';
import { binanceBookTickerStreamService } from '../binance-book-ticker-stream';
import { binanceAggTradeStreamService } from '../binance-agg-trade-stream';
import { binanceDepthStreamService } from '../binance-depth-stream';
import { binanceFuturesKlineStreamService } from '../binance-kline-stream';
import { getWebSocketService } from '../websocket';
import { logger } from '../logger';
import { walletQueries } from '../database/walletQueries';
import { getFuturesClient } from '../../exchange';
import { serializeError } from '../../utils/errors';
import { SCALPING_ENGINE } from '../../constants/scalping';
import { BinanceIpBannedError } from '../binance-api-cache';
import { getAvailableSymbols } from '../binance-exchange-info';
import type { StrategyContext, BalanceCache } from './types';

interface ActiveSession {
  walletId: string;
  userId: string;
  symbols: string[];
  metricsComputer: MetricsComputer;
  signalEngine: SignalEngine;
  executionEngine: ExecutionEngine | null;
  klineIndicatorManager: KlineIndicatorManager | null;
  signalInterval: string | null;
  directionMode: 'auto' | 'long_only' | 'short_only';
  unsubscribers: Array<() => void>;
  isAutoTrading: boolean;
  balanceCache: BalanceCache | null;
}

export class ScalpingScheduler {
  private sessions = new Map<string, ActiveSession>();
  private lastEvaluation = new Map<string, number>();

  async startScalping(walletId: string): Promise<void> {
    if (this.sessions.has(walletId)) {
      logger.warn({ walletId }, 'Scalping already running for wallet');
      return;
    }

    const config = await db.query.scalpingConfig.findFirst({
      where: eq(scalpingConfig.walletId, walletId),
    });

    if (!config) throw new Error('Scalping config not found for wallet');

    const rawSymbols: string[] = JSON.parse(config.symbols);
    const enabledStrategies: ScalpingStrategy[] = JSON.parse(config.enabledStrategies);

    if (rawSymbols.length === 0) throw new Error('No symbols configured for scalping');

    const availableSymbols = await getAvailableSymbols('FUTURES');
    const availableSet = new Set(availableSymbols);
    const symbols = rawSymbols.filter((s) => availableSet.has(s));
    const invalidSymbols = rawSymbols.filter((s) => !availableSet.has(s));

    if (invalidSymbols.length > 0) {
      logger.warn({ walletId, invalidSymbols }, 'Scalping: removed unavailable symbols from config');
      await db.update(scalpingConfig)
        .set({ symbols: JSON.stringify(symbols), updatedAt: new Date() })
        .where(eq(scalpingConfig.walletId, walletId));
    }

    if (symbols.length === 0) throw new Error('No valid symbols remaining after validation');

    const metricsComputer = new MetricsComputer();
    const signalEngine = new SignalEngine({
      enabledStrategies,
      directionMode: (config.directionMode) ?? 'auto',
      imbalanceThreshold: parseFloat(config.imbalanceThreshold ?? String(SCALPING_DEFAULTS.IMBALANCE_THRESHOLD)),
      cvdDivergenceBars: config.cvdDivergenceBars ?? SCALPING_DEFAULTS.CVD_DIVERGENCE_BARS,
      vwapDeviationSigma: parseFloat(config.vwapDeviationSigma ?? String(SCALPING_DEFAULTS.VWAP_DEVIATION_SIGMA)),
      largeTradeMult: parseFloat(config.largeTradeMult ?? String(SCALPING_DEFAULTS.LARGE_TRADE_MULTIPLIER)),
      absorptionThreshold: parseFloat(config.absorptionThreshold ?? String(SCALPING_DEFAULTS.ABSORPTION_VOLUME_THRESHOLD)),
      maxSpreadPercent: parseFloat(config.maxSpreadPercent ?? String(SCALPING_DEFAULTS.MAX_SPREAD_PERCENT)),
      circuitBreakerEnabled: config.circuitBreakerEnabled,
      circuitBreakerLossPercent: parseFloat(config.circuitBreakerLossPercent ?? String(SCALPING_DEFAULTS.CIRCUIT_BREAKER_LOSS_PERCENT)),
      circuitBreakerMaxTrades: config.circuitBreakerMaxTrades ?? SCALPING_DEFAULTS.CIRCUIT_BREAKER_MAX_TRADES,
      maxDailyTrades: config.maxDailyTrades ?? SCALPING_DEFAULTS.MAX_DAILY_TRADES,
      maxDailyLossPercent: parseFloat(config.maxDailyLossPercent ?? String(SCALPING_DEFAULTS.MAX_DAILY_LOSS_PERCENT)),
    });

    let executionEngine: ExecutionEngine | null = null;
    const isAutoTrading = config.isEnabled;
    const unsubscribers: Array<() => void> = [];

    if (isAutoTrading) {
      executionEngine = new ExecutionEngine(
        {
          walletId: config.walletId,
          userId: config.userId,
          executionMode: (config.executionMode ?? 'POST_ONLY'),
          positionSizePercent: parseFloat(config.positionSizePercent ?? '1'),
          leverage: config.leverage ?? 5,
          marginType: (config.marginType as 'ISOLATED' | 'CROSSED') ?? 'CROSSED',
          maxConcurrentPositions: config.maxConcurrentPositions ?? 1,
          microTrailingTicks: config.microTrailingTicks ?? SCALPING_DEFAULTS.MICRO_TRAILING_TICKS,
        },
        signalEngine,
      );

      await executionEngine.restoreActivePositions();

      const positionUnsub = getPositionEventBus().onPositionClosed((event) => {
        if (event.walletId !== walletId) return;
        void executionEngine!.handlePositionClosed(event.symbol, event.pnl);
      });
      unsubscribers.push(positionUnsub);

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

    const aggTradeUnsub = binanceAggTradeStreamService.onAggTradeUpdate((trade: AggTrade) => {
      if (!symbols.includes(trade.symbol)) return;
      metricsComputer.processAggTrade(trade);
      if (executionEngine?.isSymbolBlocked(trade.symbol)) return;
      this.evaluateSignal(walletId, trade.symbol, trade.price);
      if (executionEngine?.hasActivePosition(trade.symbol)) {
        void executionEngine.checkMicroTrailing(trade.symbol, trade.price);
      }
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

    const signalInterval = config.signalInterval ?? SCALPING_DEFAULTS.SIGNAL_INTERVAL;
    const klineIndicatorManager = new KlineIndicatorManager();

    for (const symbol of symbols) {
      await klineIndicatorManager.initialize(symbol, signalInterval);
      binanceFuturesKlineStreamService.subscribe(symbol, signalInterval);
    }

    const klineUnsub = binanceFuturesKlineStreamService.onKlineClose((update) => {
      if (update.interval !== signalInterval) return;
      if (!symbols.includes(update.symbol)) return;
      void klineIndicatorManager.processKlineClose(update);
    });
    unsubscribers.push(klineUnsub);

    this.sessions.set(walletId, {
      walletId,
      userId: config.userId,
      symbols,
      metricsComputer,
      signalEngine,
      executionEngine,
      klineIndicatorManager,
      signalInterval,
      directionMode: (config.directionMode) ?? 'auto',
      unsubscribers,
      isAutoTrading,
      balanceCache: null,
    });

    try {
      await db.update(scalpingConfig)
        .set({ isEnabled: true, updatedAt: new Date() })
        .where(eq(scalpingConfig.walletId, walletId));
    } catch (error) {
      logger.error({ error, walletId }, 'Failed to enable scalping config in DB');
    }

    logger.info({
      walletId,
      symbols,
      strategies: enabledStrategies,
      autoTrading: isAutoTrading,
    }, 'Scalping started');
  }

  async stopScalping(walletId: string): Promise<void> {
    const session = this.sessions.get(walletId);
    if (!session) return;

    for (const unsub of session.unsubscribers) unsub();

    for (const symbol of session.symbols) {
      session.metricsComputer.stopForSymbol(symbol);
      binanceBookTickerStreamService.unsubscribe(symbol);
      binanceAggTradeStreamService.unsubscribe(symbol);
      binanceDepthStreamService.unsubscribe(symbol);

      if (session.signalInterval) {
        binanceFuturesKlineStreamService.unsubscribe(symbol, session.signalInterval);
      }

      this.lastEvaluation.delete(`${walletId}:${symbol}`);
    }

    session.klineIndicatorManager?.clear();
    session.executionEngine?.stop();
    this.sessions.delete(walletId);

    try {
      await db.update(scalpingConfig)
        .set({ isEnabled: false, updatedAt: new Date() })
        .where(eq(scalpingConfig.walletId, walletId));
    } catch (error) {
      logger.error({ error, walletId }, 'Failed to disable scalping config in DB');
    }

    logger.info({ walletId }, 'Scalping stopped');
  }

  getStatus(walletId: string): {
    isRunning: boolean;
    sessionPnl: number;
    tradeCount: number;
    winRate: number;
    circuitBreakerTripped: boolean;
    cooldownUntil: number;
  } {
    const session = this.sessions.get(walletId);
    if (!session) {
      return { isRunning: false, sessionPnl: 0, tradeCount: 0, winRate: 0, circuitBreakerTripped: false, cooldownUntil: 0 };
    }

    const cb = session.signalEngine.getCircuitBreakerState();
    return {
      isRunning: true,
      sessionPnl: cb.sessionPnl,
      tradeCount: cb.tradeCount,
      winRate: cb.tradeCount > 0 ? cb.winCount / cb.tradeCount : 0,
      circuitBreakerTripped: cb.tripped,
      cooldownUntil: cb.cooldownUntil,
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

  getVolumeProfile(walletId: string, symbol: string): VolumeProfile | null {
    const session = this.sessions.get(walletId);
    if (!session) return null;
    return session.metricsComputer.getVolumeProfile(symbol);
  }

  async restoreFromDb(): Promise<void> {
    const configs = await db.query.scalpingConfig.findMany({
      where: eq(scalpingConfig.isEnabled, true),
    });

    for (const config of configs) {
      const symbols: string[] = JSON.parse(config.symbols);
      try {
        await this.startScalping(config.walletId);
        logger.info({ walletId: config.walletId, symbols }, 'Scalping restored from DB');
      } catch (error) {
        logger.error({ walletId: config.walletId, symbols, error }, 'Failed to restore scalping session');
      }
    }
  }

  isRunning(walletId: string): boolean {
    return this.sessions.has(walletId);
  }

  isSymbolBeingScalped(walletId: string, symbol: string): boolean {
    const session = this.sessions.get(walletId);
    if (!session) return false;
    return session.symbols.includes(symbol);
  }

  getScalpingSymbols(walletId: string): string[] {
    const session = this.sessions.get(walletId);
    if (!session) return [];
    return [...session.symbols];
  }

  private async getCachedBalance(session: ActiveSession): Promise<number> {
    const now = Date.now();
    if (session.balanceCache && now - session.balanceCache.timestamp < SCALPING_ENGINE.BALANCE_CACHE_TTL_MS) {
      return session.balanceCache.balance;
    }

    try {
      const wallet = await walletQueries.getByIdAndUser(session.walletId, session.userId);
      const client = getFuturesClient(wallet);
      const account = await client.getAccountInfo();
      const balance = parseFloat(account.availableBalance);
      session.balanceCache = { balance, timestamp: now };
      return balance;
    } catch (error) {
      if (error instanceof BinanceIpBannedError && session.balanceCache) {
        session.balanceCache.timestamp = now + SCALPING_ENGINE.IP_BAN_PAUSE_MS;
        logger.warn({ walletId: session.walletId }, 'IP banned — extending balance cache TTL');
        return session.balanceCache.balance;
      }
      logger.warn({ error: serializeError(error), walletId: session.walletId }, 'Failed to fetch balance for signal eval');
      return session.balanceCache?.balance ?? 0;
    }
  }

  private evaluateSignal(walletId: string, symbol: string, currentPrice: number): void {
    const throttleKey = `${walletId}:${symbol}`;
    const now = Date.now();
    const lastEval = this.lastEvaluation.get(throttleKey) ?? 0;
    if (now - lastEval < SCALPING_ENGINE.SIGNAL_EVAL_THROTTLE_MS) return;
    this.lastEvaluation.set(throttleKey, now);

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

    const cachedBalance = session.balanceCache?.balance ?? 0;

    const indicators = session.klineIndicatorManager?.getIndicators(symbol) ?? undefined;

    const context: StrategyContext = {
      symbol,
      metrics,
      cvdState,
      currentPrice,
      vwap,
      avgVolume,
      walletBalance: cachedBalance,
      indicators,
    };

    session.signalEngine.evaluate(context);

    if (!session.balanceCache || now - session.balanceCache.timestamp >= SCALPING_ENGINE.BALANCE_CACHE_TTL_MS) {
      void this.getCachedBalance(session);
    }
  }
}

let scalpingScheduler: ScalpingScheduler | null = null;

export const getScalpingScheduler = (): ScalpingScheduler => {
  scalpingScheduler ??= new ScalpingScheduler();
  return scalpingScheduler;
};
