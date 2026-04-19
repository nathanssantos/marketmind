import type { Kline, MarketType } from '@marketmind/types';
import type { ChecklistCondition } from '@marketmind/trading-core';
import { INDICATOR_CATALOG, evaluateCondition } from '@marketmind/trading-core';
import {
  buildChartLiveDataKey,
  useChartLiveDataStore,
  type ChartLiveDataEntry,
} from '@renderer/store/chartLiveDataStore';
import { useMemo } from 'react';

export interface ClientChecklistResult {
  conditionId: string;
  evaluated: boolean;
  passed: boolean;
  value: number | null;
  catalogType: string;
}

interface UseChecklistEvaluationProps {
  symbol: string;
  interval: string;
  marketType: MarketType;
  conditions: ChecklistCondition[];
}

const closeSeriesFromKlines = (klines: Kline[]): (number | null)[] =>
  klines.map((k) => {
    const n = parseFloat(k.close);
    return Number.isFinite(n) ? n : null;
  });

const resolveTimeframe = (conditionTf: string, currentInterval: string): string =>
  conditionTf === 'current' ? currentInterval : conditionTf;

const evaluateOne = (
  cond: ChecklistCondition,
  entry: ChartLiveDataEntry,
  closeSeries: (number | null)[],
): ClientChecklistResult | null => {
  const indicator = entry.indicators.get(cond.userIndicatorId);
  if (!indicator) return null;

  const def = INDICATOR_CATALOG[indicator.catalogType];
  if (!def) return null;

  const outputKey = def.evaluator.outputKey ?? def.outputs[0]?.key;
  if (!outputKey) return null;

  const series = indicator.outputs[outputKey];
  if (!series) return null;

  try {
    const result = evaluateCondition({
      series,
      op: cond.op,
      threshold: cond.threshold,
      valueRange: def.valueRange,
      closeSeries,
    });
    return {
      conditionId: cond.id,
      evaluated: true,
      passed: result.passed,
      value: result.value,
      catalogType: indicator.catalogType,
    };
  } catch {
    return null;
  }
};

export const useChecklistEvaluation = ({
  symbol,
  interval,
  marketType,
  conditions,
}: UseChecklistEvaluationProps): Map<string, ClientChecklistResult> => {
  const entries = useChartLiveDataStore((s) => s.entries);

  return useMemo(() => {
    const out = new Map<string, ClientChecklistResult>();
    const closeSeriesCache = new Map<string, (number | null)[]>();

    for (const cond of conditions) {
      if (!cond.enabled) continue;
      const resolvedTf = resolveTimeframe(cond.timeframe, interval);
      const entry = entries.get(buildChartLiveDataKey(symbol, resolvedTf, marketType));
      if (!entry) continue;

      let closeSeries = closeSeriesCache.get(resolvedTf);
      if (!closeSeries) {
        closeSeries = closeSeriesFromKlines(entry.klines);
        closeSeriesCache.set(resolvedTf, closeSeries);
      }

      const res = evaluateOne(cond, entry, closeSeries);
      if (res) out.set(cond.id, res);
    }
    return out;
  }, [entries, conditions, interval, symbol, marketType]);
};
