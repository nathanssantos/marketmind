import type { Kline, MarketType, TradingSetup } from '@marketmind/types';
import {
  checkStochasticHtfCondition,
  checkStochasticRecoveryHtfCondition,
  getOneStepAboveTimeframe,
} from '../../../utils/filters';
import type { WatcherLogBuffer } from '../../watcher-batch-logger';

interface HtfCheckDeps {
  getHtfKlines: (symbol: string, htfInterval: string, marketType: MarketType) => Promise<Kline[]>;
}

export const checkStochasticHtfFilter = async (
  deps: HtfCheckDeps,
  symbol: string,
  interval: string,
  marketType: MarketType,
  setup: TradingSetup,
  logBuffer: WatcherLogBuffer
): Promise<{ passed: boolean }> => {
  const htfInterval = getOneStepAboveTimeframe(interval);
  if (!htfInterval) return { passed: true };

  const htfKlines = await deps.getHtfKlines(symbol, htfInterval, marketType);
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
};

export const checkStochasticRecoveryHtfFilter = async (
  deps: HtfCheckDeps,
  symbol: string,
  interval: string,
  marketType: MarketType,
  setup: TradingSetup,
  logBuffer: WatcherLogBuffer
): Promise<{ passed: boolean }> => {
  const htfInterval = getOneStepAboveTimeframe(interval);
  if (!htfInterval) return { passed: true };

  const htfKlines = await deps.getHtfKlines(symbol, htfInterval, marketType);
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
};
