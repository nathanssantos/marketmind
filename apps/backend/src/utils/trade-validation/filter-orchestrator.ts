import type { Kline, TradingSetup } from '@marketmind/types';
import {
  ADX_FILTER,
  checkAdxCondition,
  checkBtcCorrelation,
  checkDirectionFilter,
  checkFundingRate,
  checkMarketRegime,
  checkMomentumTiming,
  checkMtfCondition,
  checkStochasticCondition,
  checkTrendCondition,
  checkVolumeCondition,
  DIRECTION_FILTER,
  getHigherTimeframe,
  MOMENTUM_TIMING_FILTER,
  MTF_FILTER,
  STOCHASTIC_FILTER,
} from '../filters';
import { calculateConfluenceScore, type FilterResults } from '../confluence-scoring';

export interface FilterOrchestrationConfig {
  useStochasticFilter?: boolean;
  useMomentumTimingFilter?: boolean;
  useAdxFilter?: boolean;
  useTrendFilter?: boolean;
  useMtfFilter?: boolean;
  useBtcCorrelationFilter?: boolean;
  useMarketRegimeFilter?: boolean;
  useVolumeFilter?: boolean;
  useFundingFilter?: boolean;
  useConfluenceScoring?: boolean;
  confluenceMinScore?: number;
  useDirectionFilter?: boolean;
  enableLongInBearMarket?: boolean;
  enableShortInBullMarket?: boolean;
}

export interface FilterExternalData {
  btcKlines?: Kline[];
  htfKlines?: Kline[];
  htfInterval?: string;
  fundingRate?: number | null;
}

export interface FilterCheckResult {
  filter: string;
  passed: boolean;
  reason?: string;
  details?: Record<string, unknown>;
}

export interface FilterOrchestrationResult {
  passed: boolean;
  filterResults: FilterResults;
  rejectionReason?: string;
  checkResults: FilterCheckResult[];
}

export interface FilterOrchestrationInput {
  klines: Kline[];
  setup: TradingSetup;
  config: FilterOrchestrationConfig;
  externalData?: FilterExternalData;
  symbol?: string;
  interval?: string;
  marketType?: 'SPOT' | 'FUTURES';
  strategyHasTrendFilter?: boolean;
}

export const orchestrateFilters = (input: FilterOrchestrationInput): FilterOrchestrationResult => {
  const {
    klines,
    setup,
    config,
    externalData = {},
    symbol,
    marketType = 'FUTURES',
    strategyHasTrendFilter = false,
  } = input;

  const filterResults: FilterResults = {};
  const checkResults: FilterCheckResult[] = [];
  const direction = setup.direction;

  if (config.useBtcCorrelationFilter && externalData.btcKlines && symbol) {
    const isAltcoin = !symbol.startsWith('BTC') && symbol !== 'BTCUSDT';

    if (isAltcoin && externalData.btcKlines.length >= 26) {
      const btcResult = checkBtcCorrelation(externalData.btcKlines, direction, symbol);

      checkResults.push({
        filter: 'BTC Correlation',
        passed: btcResult.isAllowed,
        reason: btcResult.reason,
        details: { btcTrend: btcResult.btcTrend, direction },
      });

      if (!btcResult.isAllowed) {
        return {
          passed: false,
          filterResults,
          rejectionReason: 'BTC Correlation filter failed',
          checkResults,
        };
      }

      filterResults.btcCorrelation = btcResult;
    }
  }

  if (config.useFundingFilter && marketType === 'FUTURES' && externalData.fundingRate !== undefined) {
    const fundingResult = checkFundingRate(
      externalData.fundingRate !== null ? externalData.fundingRate / 100 : null,
      direction,
      undefined
    );

    checkResults.push({
      filter: 'Funding Rate',
      passed: fundingResult.isAllowed,
      reason: fundingResult.reason,
      details: {
        rate: fundingResult.currentRate?.toFixed(6) ?? 'N/A',
        level: fundingResult.fundingLevel,
      },
    });

    if (!fundingResult.isAllowed) {
      return {
        passed: false,
        filterResults,
        rejectionReason: 'Funding Rate filter failed',
        checkResults,
      };
    }

    filterResults.fundingRate = fundingResult;
  }

  if (config.useMtfFilter && externalData.htfKlines && externalData.htfInterval) {
    if (externalData.htfKlines.length >= MTF_FILTER.MIN_KLINES_FOR_EMA200) {
      const mtfResult = checkMtfCondition(externalData.htfKlines, direction, externalData.htfInterval);

      checkResults.push({
        filter: 'MTF',
        passed: mtfResult.isAllowed,
        reason: mtfResult.reason,
        details: { htfTrend: mtfResult.htfTrend, htfInterval: externalData.htfInterval },
      });

      if (!mtfResult.isAllowed) {
        return {
          passed: false,
          filterResults,
          rejectionReason: 'MTF filter failed',
          checkResults,
        };
      }

      filterResults.mtf = mtfResult;
    }
  }

  if (config.useMarketRegimeFilter && klines.length >= 30) {
    const regimeResult = checkMarketRegime(klines, setup.type);

    checkResults.push({
      filter: 'Market Regime',
      passed: regimeResult.isAllowed,
      reason: regimeResult.reason,
      details: { regime: regimeResult.regime, adx: regimeResult.adx?.toFixed(1) },
    });

    if (!regimeResult.isAllowed) {
      return {
        passed: false,
        filterResults,
        rejectionReason: 'Market Regime filter failed',
        checkResults,
      };
    }

    filterResults.marketRegime = regimeResult;
    filterResults.adxValue = regimeResult.adx;
  }

  if (config.useDirectionFilter && klines.length >= DIRECTION_FILTER.MIN_KLINES_REQUIRED) {
    const directionResult = checkDirectionFilter(klines, direction, {
      enableLongInBearMarket: config.enableLongInBearMarket,
      enableShortInBullMarket: config.enableShortInBullMarket,
    });

    checkResults.push({
      filter: 'Direction',
      passed: directionResult.isAllowed,
      reason: directionResult.reason,
      details: {
        marketDirection: directionResult.direction,
        priceVsEma200: directionResult.priceVsEma200Percent?.toFixed(1),
      },
    });

    if (!directionResult.isAllowed) {
      return {
        passed: false,
        filterResults,
        rejectionReason: 'Direction filter failed',
        checkResults,
      };
    }

    filterResults.direction = directionResult;
  }

  if (config.useVolumeFilter && klines.length >= 21) {
    const volumeResult = checkVolumeCondition(klines, direction, setup.type);

    checkResults.push({
      filter: 'Volume',
      passed: volumeResult.isAllowed,
      reason: volumeResult.reason,
      details: { volumeRatio: volumeResult.volumeRatio?.toFixed(2) },
    });

    if (!volumeResult.isAllowed) {
      return {
        passed: false,
        filterResults,
        rejectionReason: 'Volume filter failed',
        checkResults,
      };
    }

    filterResults.volume = volumeResult;
  }

  if (config.useConfluenceScoring) {
    const minScore = config.confluenceMinScore ?? 60;
    const confluenceResult = calculateConfluenceScore(filterResults, minScore);

    checkResults.push({
      filter: 'Confluence',
      passed: confluenceResult.isAllowed,
      reason: confluenceResult.reason,
      details: { score: `${confluenceResult.scorePercent.toFixed(1)}%`, minRequired: minScore },
    });

    if (!confluenceResult.isAllowed) {
      return {
        passed: false,
        filterResults,
        rejectionReason: 'Confluence score too low',
        checkResults,
      };
    }
  }

  if (config.useStochasticFilter) {
    const { K_PERIOD, K_SMOOTHING, D_PERIOD } = STOCHASTIC_FILTER;
    const minRequired = K_PERIOD + K_SMOOTHING + D_PERIOD;

    if (klines.length >= minRequired) {
      const stochResult = checkStochasticCondition(klines, direction);

      checkResults.push({
        filter: 'Stochastic',
        passed: stochResult.isAllowed,
        reason: stochResult.reason,
        details: { k: stochResult.currentK?.toFixed(1) },
      });

      if (!stochResult.isAllowed) {
        return {
          passed: false,
          filterResults,
          rejectionReason: 'Stochastic filter failed',
          checkResults,
        };
      }
    }
  }

  if (config.useMomentumTimingFilter) {
    const { MIN_KLINES_REQUIRED } = MOMENTUM_TIMING_FILTER;

    if (klines.length >= MIN_KLINES_REQUIRED) {
      const momentumResult = checkMomentumTiming(klines, direction, setup.type);

      checkResults.push({
        filter: 'Momentum',
        passed: momentumResult.isAllowed,
        reason: momentumResult.reason,
        details: { rsi: momentumResult.rsiValue?.toFixed(1) },
      });

      if (!momentumResult.isAllowed) {
        return {
          passed: false,
          filterResults,
          rejectionReason: 'Momentum filter failed',
          checkResults,
        };
      }
    }
  }

  if (config.useAdxFilter) {
    const { MIN_KLINES_REQUIRED } = ADX_FILTER;

    if (klines.length < MIN_KLINES_REQUIRED) {
      checkResults.push({
        filter: 'ADX',
        passed: false,
        reason: 'Insufficient klines for ADX',
        details: { klinesCount: klines.length, required: MIN_KLINES_REQUIRED },
      });

      return {
        passed: false,
        filterResults,
        rejectionReason: 'Insufficient klines for ADX',
        checkResults,
      };
    }

    const adxResult = checkAdxCondition(klines, direction);

    checkResults.push({
      filter: 'ADX',
      passed: adxResult.isAllowed,
      reason: adxResult.reason,
      details: { adx: adxResult.adx?.toFixed(1) },
    });

    if (!adxResult.isAllowed) {
      return {
        passed: false,
        filterResults,
        rejectionReason: 'ADX filter failed',
        checkResults,
      };
    }
  }

  const shouldApplyTrendFilter = config.useTrendFilter || strategyHasTrendFilter;

  if (shouldApplyTrendFilter && klines.length >= 2) {
    const trendResult = checkTrendCondition(klines, direction);

    checkResults.push({
      filter: 'Trend (EMA21)',
      passed: trendResult.isAllowed,
      reason: trendResult.reason,
      details: {
        price: trendResult.price?.toFixed(2),
        ema21: trendResult.ema21?.toFixed(2),
      },
    });

    if (!trendResult.isAllowed) {
      return {
        passed: false,
        filterResults,
        rejectionReason: 'Trend filter failed',
        checkResults,
      };
    }
  }

  return {
    passed: true,
    filterResults,
    checkResults,
  };
};

export { getHigherTimeframe };
