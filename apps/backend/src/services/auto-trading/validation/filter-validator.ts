import type { Kline, TradingSetup, VolumeFilterConfig } from '@marketmind/types';
import type { PineStrategy } from '../../pine/types';
import { calculateConfluenceScore, type FilterResults } from '../../../utils/confluence-scoring';
import {
  checkBtcCorrelation,
  checkFundingRate,
  checkMarketRegime,
  checkMtfCondition,
  checkTrendCondition,
  checkVolumeCondition,
  getFilterValidatorSyncFilters,
  getHigherTimeframe,
  MTF_FILTER,
} from '../../../utils/filters';
import type { WatcherLogBuffer } from '../../watcher-batch-logger';
import type { ActiveWatcher, FilterValidatorConfig, FilterValidatorDeps, FilterValidationResult } from '../types';
import { checkStochasticHtfFilter, checkStochasticRecoveryHtfFilter } from './filter-validator-htf';

export type { FilterValidatorConfig, FilterValidatorDeps, FilterValidationResult };

export class FilterValidator {
  constructor(private deps: FilterValidatorDeps) {}

  async validateFilters(
    watcher: ActiveWatcher,
    setup: TradingSetup,
    config: FilterValidatorConfig,
    cycleKlines: Kline[],
    strategies: PineStrategy[],
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
      const result = this.checkVolumeFilter(cycleKlines, setup, logBuffer, config.volumeFilterConfig);
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

    if (config.useStochasticHtfFilter) {
      const result = await this.checkStochasticHtfFilterMethod(watcher, setup, logBuffer);
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
      const result = await this.checkStochasticRecoveryHtfFilterMethod(watcher, setup, logBuffer);
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

    for (const filter of getFilterValidatorSyncFilters()) {
      if (!config[filter.enableKey as keyof FilterValidatorConfig]) continue;
      const result = filter.run!(cycleKlines, setup.direction, setup.type, config as unknown as Record<string, unknown>);
      logBuffer.addFilterCheck({
        filterName: filter.displayName,
        passed: result.isAllowed,
        reason: result.reason ?? 'N/A',
      });
      if (!result.isAllowed) {
        logBuffer.addValidationCheck({ name: filter.displayName, passed: false, reason: result.reason });
        return { passed: false, filterResults, rejectionReason: `${filter.displayName} filter failed` };
      }
      logBuffer.addValidationCheck({ name: filter.displayName, passed: true });
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
    logBuffer: WatcherLogBuffer,
    volumeFilterConfig?: VolumeFilterConfig
  ): { passed: boolean; filterResult?: ReturnType<typeof checkVolumeCondition> } {
    if (cycleKlines.length >= 21) {
      const volumeResult = checkVolumeCondition(cycleKlines, setup.direction, setup.type, volumeFilterConfig);

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

  private async checkStochasticHtfFilterMethod(
    watcher: ActiveWatcher,
    setup: TradingSetup,
    logBuffer: WatcherLogBuffer
  ): Promise<{ passed: boolean }> {
    return checkStochasticHtfFilter(this.deps, watcher.symbol, watcher.interval, watcher.marketType, setup, logBuffer);
  }

  private async checkStochasticRecoveryHtfFilterMethod(
    watcher: ActiveWatcher,
    setup: TradingSetup,
    logBuffer: WatcherLogBuffer
  ): Promise<{ passed: boolean }> {
    return checkStochasticRecoveryHtfFilter(this.deps, watcher.symbol, watcher.interval, watcher.marketType, setup, logBuffer);
  }

  private shouldApplyTrendFilter(
    config: FilterValidatorConfig,
    _setup: TradingSetup,
    _strategies: PineStrategy[]
  ): boolean {
    return config.useTrendFilter === true;
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
