import type { Kline, MarketType, StrategyDefinition, TradingSetup } from '@marketmind/types';
import { calculateConfluenceScore, type FilterResults } from '../../utils/confluence-scoring';
import {
  ADX_FILTER,
  checkAdxCondition,
  checkBtcCorrelation,
  checkFundingRate,
  checkMarketRegime,
  checkMomentumTiming,
  checkMtfCondition,
  checkStochasticCondition,
  checkStochasticRecoveryCondition,
  checkStochasticHtfCondition,
  checkStochasticRecoveryHtfCondition,
  checkTrendCondition,
  checkVolumeCondition,
  getHigherTimeframe,
  getOneStepAboveTimeframe,
  MOMENTUM_TIMING_FILTER,
  MTF_FILTER,
  STOCHASTIC_FILTER,
} from '../../utils/filters';
import type { WatcherLogBuffer } from '../watcher-batch-logger';
import type { ActiveWatcher } from './types';

export interface FilterValidatorConfig {
  useBtcCorrelationFilter: boolean;
  useFundingFilter: boolean;
  useMtfFilter: boolean;
  useMarketRegimeFilter: boolean;
  useVolumeFilter: boolean;
  useConfluenceScoring: boolean;
  confluenceMinScore: number;
  useStochasticFilter: boolean;
  useStochasticRecoveryFilter: boolean;
  useStochasticHtfFilter: boolean;
  useStochasticRecoveryHtfFilter: boolean;
  useMomentumTimingFilter: boolean;
  useAdxFilter: boolean;
  useTrendFilter: boolean;
}

export interface FilterValidatorDeps {
  getBtcKlines: (interval: string, marketType: MarketType) => Promise<Kline[]>;
  getHtfKlines: (symbol: string, htfInterval: string, marketType: MarketType) => Promise<Kline[]>;
  getCachedFundingRate: (symbol: string) => Promise<number | null>;
}

export interface FilterValidationResult {
  passed: boolean;
  filterResults: FilterResults;
  rejectionReason?: string;
  rejectionDetails?: Record<string, unknown>;
}

export class FilterValidator {
  constructor(private deps: FilterValidatorDeps) {}

  async validateFilters(
    watcher: ActiveWatcher,
    setup: TradingSetup,
    config: FilterValidatorConfig,
    cycleKlines: Kline[],
    strategies: StrategyDefinition[],
    logBuffer: WatcherLogBuffer
  ): Promise<FilterValidationResult> {
    const filterResults: FilterResults = {};

    if (config.useBtcCorrelationFilter && watcher.exchange !== 'INTERACTIVE_BROKERS') {
      const result = await this.checkBtcCorrelationFilter(watcher, setup, logBuffer);
      if (!result.passed) {
        logBuffer.addValidationCheck({
          name: 'BTC Correlation',
          passed: false,
          value: result.filterResult?.btcTrend ?? 'unknown',
          reason: result.filterResult?.reason ?? 'Not aligned',
        });
        return {
          passed: false,
          filterResults,
          rejectionReason: 'BTC Correlation filter failed',
        };
      }
      if (result.filterResult) {
        filterResults.btcCorrelation = result.filterResult;
        logBuffer.addValidationCheck({
          name: 'BTC Correlation',
          passed: true,
          value: result.filterResult.btcTrend ?? 'aligned',
        });
      }
    }

    if (config.useFundingFilter && watcher.marketType === 'FUTURES' && watcher.exchange !== 'INTERACTIVE_BROKERS') {
      const result = await this.checkFundingFilter(watcher, setup, logBuffer);
      if (!result.passed) {
        logBuffer.addValidationCheck({
          name: 'Funding Rate',
          passed: false,
          value: result.filterResult?.currentRate?.toFixed(4) ?? 'N/A',
          reason: result.filterResult?.reason ?? 'Unfavorable',
        });
        return {
          passed: false,
          filterResults,
          rejectionReason: 'Funding Rate filter failed',
        };
      }
      if (result.filterResult) {
        filterResults.fundingRate = result.filterResult;
        logBuffer.addValidationCheck({
          name: 'Funding Rate',
          passed: true,
          value: `${(result.filterResult.currentRate ?? 0).toFixed(4)}%`,
        });
      }
    }

    if (config.useMtfFilter) {
      const result = await this.checkMtfFilter(watcher, setup, logBuffer);
      if (!result.passed) {
        logBuffer.addValidationCheck({
          name: 'MTF Trend',
          passed: false,
          value: result.filterResult?.htfTrend ?? 'unknown',
          reason: result.filterResult?.reason ?? 'Not aligned',
        });
        return {
          passed: false,
          filterResults,
          rejectionReason: 'MTF filter failed',
        };
      }
      if (result.filterResult) {
        filterResults.mtf = result.filterResult;
        logBuffer.addValidationCheck({
          name: 'MTF Trend',
          passed: true,
          value: result.filterResult.htfTrend ?? 'aligned',
        });
      }
    }

    if (config.useMarketRegimeFilter) {
      const result = this.checkMarketRegimeFilter(cycleKlines, setup, logBuffer);
      if (!result.passed) {
        logBuffer.addValidationCheck({
          name: 'Market Regime',
          passed: false,
          value: result.filterResult?.regime ?? 'unknown',
          reason: result.filterResult?.reason ?? 'Incompatible',
        });
        return {
          passed: false,
          filterResults,
          rejectionReason: 'Market Regime filter failed',
        };
      }
      if (result.filterResult) {
        filterResults.marketRegime = result.filterResult;
        filterResults.adxValue = result.filterResult.adx ?? undefined;
        logBuffer.addValidationCheck({
          name: 'Market Regime',
          passed: true,
          value: `${result.filterResult.regime} (ADX ${result.filterResult.adx?.toFixed(1) ?? 'N/A'})`,
        });
      }
    }

    if (config.useVolumeFilter) {
      const result = this.checkVolumeFilter(cycleKlines, setup, logBuffer);
      if (!result.passed) {
        logBuffer.addValidationCheck({
          name: 'Volume',
          passed: false,
          value: `${result.filterResult?.volumeRatio?.toFixed(2) ?? 'N/A'}x`,
          reason: result.filterResult?.reason ?? 'Insufficient',
        });
        return {
          passed: false,
          filterResults,
          rejectionReason: 'Volume filter failed',
        };
      }
      if (result.filterResult) {
        filterResults.volume = result.filterResult;
        logBuffer.addValidationCheck({
          name: 'Volume',
          passed: true,
          value: `${result.filterResult.volumeRatio?.toFixed(2) ?? 'N/A'}x`,
        });
      }
    }

    if (config.useConfluenceScoring) {
      const result = this.checkConfluenceFilter(filterResults, config.confluenceMinScore, logBuffer);
      if (!result.passed) {
        logBuffer.addValidationCheck({
          name: 'Confluence',
          passed: false,
          expected: `>= ${config.confluenceMinScore}%`,
          reason: 'Score too low',
        });
        return {
          passed: false,
          filterResults,
          rejectionReason: 'Confluence score too low',
        };
      }
      logBuffer.addValidationCheck({
        name: 'Confluence',
        passed: true,
        reason: 'Score sufficient',
      });
    }

    if (config.useStochasticFilter) {
      const result = this.checkStochasticFilter(cycleKlines, setup, logBuffer);
      if (!result.passed) {
        logBuffer.addValidationCheck({
          name: 'Stochastic',
          passed: false,
          reason: 'Unfavorable zone',
        });
        return {
          passed: false,
          filterResults,
          rejectionReason: 'Stochastic filter failed',
        };
      }
      logBuffer.addValidationCheck({ name: 'Stochastic', passed: true });
    }

    if (config.useStochasticRecoveryFilter) {
      const result = this.checkStochasticRecoveryFilter(cycleKlines, setup, logBuffer);
      if (!result.passed) {
        logBuffer.addValidationCheck({
          name: 'Stochastic Recovery',
          passed: false,
          reason: 'Not in recovery zone',
        });
        return {
          passed: false,
          filterResults,
          rejectionReason: 'Stochastic Recovery filter failed',
        };
      }
      logBuffer.addValidationCheck({ name: 'Stochastic Recovery', passed: true });
    }

    if (config.useStochasticHtfFilter) {
      const result = await this.checkStochasticHtfFilter(watcher, setup, logBuffer);
      if (!result.passed) {
        logBuffer.addValidationCheck({
          name: 'HTF Stochastic',
          passed: false,
          reason: 'Unfavorable HTF zone',
        });
        return {
          passed: false,
          filterResults,
          rejectionReason: 'HTF Stochastic filter failed',
        };
      }
      logBuffer.addValidationCheck({ name: 'HTF Stochastic', passed: true });
    }

    if (config.useStochasticRecoveryHtfFilter) {
      const result = await this.checkStochasticRecoveryHtfFilter(watcher, setup, logBuffer);
      if (!result.passed) {
        logBuffer.addValidationCheck({
          name: 'HTF Stochastic Recovery',
          passed: false,
          reason: 'Not in HTF recovery zone',
        });
        return {
          passed: false,
          filterResults,
          rejectionReason: 'HTF Stochastic Recovery filter failed',
        };
      }
      logBuffer.addValidationCheck({ name: 'HTF Stochastic Recovery', passed: true });
    }

    if (config.useMomentumTimingFilter) {
      const result = this.checkMomentumFilter(cycleKlines, setup, logBuffer);
      if (!result.passed) {
        logBuffer.addValidationCheck({
          name: 'Momentum',
          passed: false,
          reason: 'Weak momentum',
        });
        return {
          passed: false,
          filterResults,
          rejectionReason: 'Momentum filter failed',
        };
      }
      logBuffer.addValidationCheck({ name: 'Momentum', passed: true });
    }

    if (config.useAdxFilter) {
      const result = this.checkAdxFilter(cycleKlines, setup, logBuffer);
      if (!result.passed) {
        logBuffer.addValidationCheck({
          name: 'ADX',
          passed: false,
          reason: result.reason ?? 'Weak trend',
        });
        return {
          passed: false,
          filterResults,
          rejectionReason: result.reason ?? 'ADX filter failed',
          rejectionDetails: result.details,
        };
      }
      logBuffer.addValidationCheck({ name: 'ADX', passed: true });
    }

    const shouldApplyTrendFilter = this.shouldApplyTrendFilter(config, setup, strategies);
    if (shouldApplyTrendFilter) {
      const result = this.checkTrendFilter(cycleKlines, setup, logBuffer);
      if (!result.passed) {
        logBuffer.addValidationCheck({
          name: 'Trend (EMA21)',
          passed: false,
          reason: result.reason ?? 'Against trend',
        });
        return {
          passed: false,
          filterResults,
          rejectionReason: result.reason ?? 'Trend filter failed',
          rejectionDetails: result.details,
        };
      }
      logBuffer.addValidationCheck({ name: 'Trend (EMA21)', passed: true });
    }

    return { passed: true, filterResults };
  }

  private async checkBtcCorrelationFilter(
    watcher: ActiveWatcher,
    setup: TradingSetup,
    logBuffer: WatcherLogBuffer
  ): Promise<{ passed: boolean; filterResult?: ReturnType<typeof checkBtcCorrelation> }> {
    const isAltcoin = !watcher.symbol.startsWith('BTC') && watcher.symbol !== 'BTCUSDT';

    if (!isAltcoin) {
      return { passed: true };
    }

    const mappedBtcKlines = await this.deps.getBtcKlines(watcher.interval, watcher.marketType);

    if (mappedBtcKlines.length >= 26) {
      const btcResult = checkBtcCorrelation(mappedBtcKlines, setup.direction, watcher.symbol);

      logBuffer.addFilterCheck({
        filterName: 'BTC Correlation',
        passed: btcResult.isAllowed,
        reason: btcResult.reason ?? 'N/A',
        details: { btcTrend: btcResult.btcTrend ?? 'unknown', direction: setup.direction },
      });

      if (!btcResult.isAllowed) {
        return { passed: false, filterResult: btcResult };
      }

      return { passed: true, filterResult: btcResult };
    }

    return { passed: true };
  }

  private async checkFundingFilter(
    watcher: ActiveWatcher,
    setup: TradingSetup,
    logBuffer: WatcherLogBuffer
  ): Promise<{ passed: boolean; filterResult?: ReturnType<typeof checkFundingRate> }> {
    try {
      const cachedFundingRate = await this.deps.getCachedFundingRate(watcher.symbol);
      const fundingResult = checkFundingRate(
        cachedFundingRate !== null ? cachedFundingRate / 100 : null,
        setup.direction,
        undefined
      );

      logBuffer.addFilterCheck({
        filterName: 'Funding Rate',
        passed: fundingResult.isAllowed,
        reason: fundingResult.reason ?? 'N/A',
        details: {
          rate: fundingResult.currentRate?.toFixed(6) ?? 'N/A',
          level: fundingResult.fundingLevel ?? 'unknown',
        },
      });

      if (!fundingResult.isAllowed) {
        return { passed: false, filterResult: fundingResult };
      }

      return { passed: true, filterResult: fundingResult };
    } catch {
      return { passed: true };
    }
  }

  private async checkMtfFilter(
    watcher: ActiveWatcher,
    setup: TradingSetup,
    logBuffer: WatcherLogBuffer
  ): Promise<{ passed: boolean; filterResult?: ReturnType<typeof checkMtfCondition> }> {
    const htfInterval = getHigherTimeframe(watcher.interval);

    if (!htfInterval) {
      return { passed: true };
    }

    const mappedHtfKlines = await this.deps.getHtfKlines(watcher.symbol, htfInterval, watcher.marketType);

    if (mappedHtfKlines.length >= MTF_FILTER.MIN_KLINES_FOR_EMA200) {
      const mtfResult = checkMtfCondition(mappedHtfKlines, setup.direction, htfInterval);

      logBuffer.addFilterCheck({
        filterName: 'MTF',
        passed: mtfResult.isAllowed,
        reason: mtfResult.reason ?? 'N/A',
        details: { htfTrend: mtfResult.htfTrend ?? 'unknown', htfInterval },
      });

      if (!mtfResult.isAllowed) {
        return { passed: false, filterResult: mtfResult };
      }

      return { passed: true, filterResult: mtfResult };
    }

    return { passed: true };
  }

  private checkMarketRegimeFilter(
    cycleKlines: Kline[],
    setup: TradingSetup,
    logBuffer: WatcherLogBuffer
  ): { passed: boolean; filterResult?: ReturnType<typeof checkMarketRegime> } {
    if (cycleKlines.length >= 30) {
      const regimeResult = checkMarketRegime(cycleKlines, setup.type);

      logBuffer.addFilterCheck({
        filterName: 'Market Regime',
        passed: regimeResult.isAllowed,
        reason: regimeResult.reason ?? 'N/A',
        details: { regime: regimeResult.regime ?? 'unknown', adx: regimeResult.adx?.toFixed(1) ?? 'N/A' },
      });

      if (!regimeResult.isAllowed) {
        return { passed: false, filterResult: regimeResult };
      }

      return { passed: true, filterResult: regimeResult };
    }

    return { passed: true };
  }

  private checkVolumeFilter(
    cycleKlines: Kline[],
    setup: TradingSetup,
    logBuffer: WatcherLogBuffer
  ): { passed: boolean; filterResult?: ReturnType<typeof checkVolumeCondition> } {
    if (cycleKlines.length >= 21) {
      const volumeResult = checkVolumeCondition(cycleKlines, setup.direction, setup.type);

      logBuffer.addFilterCheck({
        filterName: 'Volume',
        passed: volumeResult.isAllowed,
        reason: volumeResult.reason ?? 'N/A',
        details: { volumeRatio: volumeResult.volumeRatio?.toFixed(2) ?? 'N/A' },
      });

      if (!volumeResult.isAllowed) {
        return { passed: false, filterResult: volumeResult };
      }

      return { passed: true, filterResult: volumeResult };
    }

    return { passed: true };
  }

  private checkConfluenceFilter(
    filterResults: FilterResults,
    minScore: number,
    logBuffer: WatcherLogBuffer
  ): { passed: boolean } {
    const confluenceResult = calculateConfluenceScore(filterResults, minScore);

    logBuffer.addFilterCheck({
      filterName: 'Confluence',
      passed: confluenceResult.isAllowed,
      reason: confluenceResult.reason ?? 'N/A',
      details: {
        score: `${confluenceResult.scorePercent.toFixed(1)}%`,
        minRequired: minScore,
      },
    });

    return { passed: confluenceResult.isAllowed };
  }

  private checkStochasticFilter(
    cycleKlines: Kline[],
    setup: TradingSetup,
    logBuffer: WatcherLogBuffer
  ): { passed: boolean } {
    const { K_PERIOD, K_SMOOTHING, D_PERIOD } = STOCHASTIC_FILTER;
    const minRequired = K_PERIOD + K_SMOOTHING + D_PERIOD;

    if (cycleKlines.length >= minRequired) {
      const stochResult = checkStochasticCondition(cycleKlines, setup.direction);

      logBuffer.addFilterCheck({
        filterName: 'Stochastic',
        passed: stochResult.isAllowed,
        reason: stochResult.reason ?? 'N/A',
        details: { k: stochResult.currentK?.toFixed(1) ?? 'N/A' },
      });

      if (!stochResult.isAllowed) {
        return { passed: false };
      }
    }

    return { passed: true };
  }

  private checkStochasticRecoveryFilter(
    cycleKlines: Kline[],
    setup: TradingSetup,
    logBuffer: WatcherLogBuffer
  ): { passed: boolean } {
    const { K_PERIOD, K_SMOOTHING, D_PERIOD } = STOCHASTIC_FILTER;
    const minRequired = K_PERIOD + K_SMOOTHING + D_PERIOD;

    if (cycleKlines.length >= minRequired) {
      const stochResult = checkStochasticRecoveryCondition(cycleKlines, setup.direction);

      logBuffer.addFilterCheck({
        filterName: 'Stochastic Recovery',
        passed: stochResult.isAllowed,
        reason: stochResult.reason ?? 'N/A',
        details: { k: stochResult.currentK?.toFixed(1) ?? 'N/A' },
      });

      if (!stochResult.isAllowed) {
        return { passed: false };
      }
    }

    return { passed: true };
  }

  private async checkStochasticHtfFilter(
    watcher: ActiveWatcher,
    setup: TradingSetup,
    logBuffer: WatcherLogBuffer
  ): Promise<{ passed: boolean }> {
    const htfInterval = getOneStepAboveTimeframe(watcher.interval);
    if (!htfInterval) return { passed: true };

    const htfKlines = await this.deps.getHtfKlines(watcher.symbol, htfInterval, watcher.marketType);
    if (htfKlines.length === 0) return { passed: true };

    const result = checkStochasticHtfCondition(htfKlines, setup.openTime, setup.direction);

    logBuffer.addFilterCheck({
      filterName: 'HTF Stochastic',
      passed: result.isAllowed,
      reason: result.reason ?? 'N/A',
      details: { k: result.currentK?.toFixed(1) ?? 'N/A', htfInterval },
    });

    if (!result.isAllowed) return { passed: false };
    return { passed: true };
  }

  private async checkStochasticRecoveryHtfFilter(
    watcher: ActiveWatcher,
    setup: TradingSetup,
    logBuffer: WatcherLogBuffer
  ): Promise<{ passed: boolean }> {
    const htfInterval = getOneStepAboveTimeframe(watcher.interval);
    if (!htfInterval) return { passed: true };

    const htfKlines = await this.deps.getHtfKlines(watcher.symbol, htfInterval, watcher.marketType);
    if (htfKlines.length === 0) return { passed: true };

    const result = checkStochasticRecoveryHtfCondition(htfKlines, setup.openTime, setup.direction);

    logBuffer.addFilterCheck({
      filterName: 'HTF Stochastic Recovery',
      passed: result.isAllowed,
      reason: result.reason ?? 'N/A',
      details: { k: result.currentK?.toFixed(1) ?? 'N/A', htfInterval },
    });

    if (!result.isAllowed) return { passed: false };
    return { passed: true };
  }

  private checkMomentumFilter(
    cycleKlines: Kline[],
    setup: TradingSetup,
    logBuffer: WatcherLogBuffer
  ): { passed: boolean } {
    const { MIN_KLINES_REQUIRED } = MOMENTUM_TIMING_FILTER;

    if (cycleKlines.length >= MIN_KLINES_REQUIRED) {
      const momentumResult = checkMomentumTiming(cycleKlines, setup.direction, setup.type);

      logBuffer.addFilterCheck({
        filterName: 'Momentum',
        passed: momentumResult.isAllowed,
        reason: momentumResult.reason ?? 'N/A',
        details: { rsi: momentumResult.rsiValue?.toFixed(1) ?? 'N/A' },
      });

      if (!momentumResult.isAllowed) {
        return { passed: false };
      }
    }

    return { passed: true };
  }

  private checkAdxFilter(
    cycleKlines: Kline[],
    setup: TradingSetup,
    logBuffer: WatcherLogBuffer
  ): { passed: boolean; reason?: string; details?: Record<string, unknown> } {
    const { MIN_KLINES_REQUIRED } = ADX_FILTER;

    if (cycleKlines.length < MIN_KLINES_REQUIRED) {
      return {
        passed: false,
        reason: 'Insufficient klines for ADX',
        details: { klinesCount: cycleKlines.length },
      };
    }

    const adxResult = checkAdxCondition(cycleKlines, setup.direction);

    logBuffer.addFilterCheck({
      filterName: 'ADX',
      passed: adxResult.isAllowed,
      reason: adxResult.reason ?? 'N/A',
      details: { adx: adxResult.adx?.toFixed(1) ?? 'N/A' },
    });

    if (!adxResult.isAllowed) {
      return { passed: false };
    }

    return { passed: true };
  }

  private shouldApplyTrendFilter(
    config: FilterValidatorConfig,
    setup: TradingSetup,
    strategies: StrategyDefinition[]
  ): boolean {
    const setupStrategy = strategies.find(s => s.id === setup.type);
    const globalTrendFilterEnabled = config.useTrendFilter === true;
    const strategyTrendFilterEnabled = setupStrategy?.filters?.trendFilter?.enabled === true;
    return globalTrendFilterEnabled || strategyTrendFilterEnabled;
  }

  private checkTrendFilter(
    cycleKlines: Kline[],
    setup: TradingSetup,
    logBuffer: WatcherLogBuffer
  ): { passed: boolean; reason?: string; details?: Record<string, unknown> } {
    if (cycleKlines.length < 2) {
      return {
        passed: false,
        reason: 'Insufficient klines for Trend',
        details: { klinesCount: cycleKlines.length },
      };
    }

    const trendResult = checkTrendCondition(cycleKlines, setup.direction);

    logBuffer.addFilterCheck({
      filterName: 'Trend (EMA21)',
      passed: trendResult.isAllowed,
      reason: trendResult.reason ?? 'N/A',
      details: { price: trendResult.price?.toFixed(2) ?? 'N/A', ema21: trendResult.ema21?.toFixed(2) ?? 'N/A' },
    });

    if (!trendResult.isAllowed) {
      return { passed: false };
    }

    return { passed: true };
  }
}
