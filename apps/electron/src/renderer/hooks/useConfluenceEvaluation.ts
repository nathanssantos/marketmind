import type { Kline, MarketType } from '@marketmind/types';
import type { ConfluenceCondition } from '@marketmind/trading-core';
import { INDICATOR_CATALOG, evaluateCondition } from '@marketmind/trading-core';
import {
  buildChartLiveDataKey,
  useChartLiveDataStore,
  type ChartLiveDataEntry,
} from '@renderer/store/chartLiveDataStore';
import { useEffect, useRef, useState } from 'react';

export interface ClientConfluenceResult {
  conditionId: string;
  evaluated: boolean;
  passed: boolean;
  value: number | null;
  catalogType: string;
}

interface UseConfluenceEvaluationProps {
  symbol: string;
  interval: string;
  marketType: MarketType;
  conditions: ConfluenceCondition[];
}

const closeSeriesFromKlines = (klines: Kline[]): (number | null)[] =>
  klines.map((k) => {
    const n = parseFloat(k.close);
    return Number.isFinite(n) ? n : null;
  });

const resolveTimeframe = (conditionTf: string, currentInterval: string): string =>
  conditionTf === 'current' ? currentInterval : conditionTf;

// Oscillators are gated on candle close — the last element of the live series/klines
// array is the currently-forming bar, so we drop it to prevent the confluence from
// flipping mid-bar. Trend/price indicators (EMA, price vs level) keep the live last
// element so they update in real time against the current price.
const CLOSE_ONLY_CATALOG_TYPES = new Set(['rsi', 'stoch', 'stochRsi', 'macd']);

const dropOpenBar = <T>(series: T[]): T[] =>
  series.length > 1 ? series.slice(0, -1) : series;

const evaluateOne = (
  cond: ConfluenceCondition,
  entry: ChartLiveDataEntry,
  closeSeries: (number | null)[],
): ClientConfluenceResult | null => {
  const indicator = entry.indicators.get(cond.userIndicatorId);
  if (!indicator) return null;

  const def = INDICATOR_CATALOG[indicator.catalogType];
  if (!def) return null;

  const outputKey = def.evaluator.outputKey ?? def.outputs[0]?.key;
  if (!outputKey) return null;

  const series = indicator.outputs[outputKey];
  if (!series) return null;

  const closeOnly = CLOSE_ONLY_CATALOG_TYPES.has(indicator.catalogType);
  const effectiveSeries = closeOnly ? dropOpenBar(series) : series;
  const effectiveCloseSeries = closeOnly ? dropOpenBar(closeSeries) : closeSeries;

  try {
    const result = evaluateCondition({
      series: effectiveSeries,
      op: cond.op,
      threshold: cond.threshold,
      valueRange: def.valueRange,
      closeSeries: effectiveCloseSeries,
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

const computeResults = (
  entries: Map<string, ChartLiveDataEntry>,
  conditions: ConfluenceCondition[],
  symbol: string,
  interval: string,
  marketType: MarketType,
): Map<string, ClientConfluenceResult> => {
  const out = new Map<string, ClientConfluenceResult>();
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
};

const resultsEqual = (
  a: Map<string, ClientConfluenceResult>,
  b: Map<string, ClientConfluenceResult>,
): boolean => {
  if (a.size !== b.size) return false;
  for (const [k, va] of a) {
    const vb = b.get(k);
    if (!vb) return false;
    if (va.evaluated !== vb.evaluated || va.passed !== vb.passed || va.value !== vb.value) return false;
  }
  return true;
};

const EMPTY: Map<string, ClientConfluenceResult> = new Map();
const THROTTLE_MS = 250;

export const useConfluenceEvaluation = ({
  symbol,
  interval,
  marketType,
  conditions,
}: UseConfluenceEvaluationProps): Map<string, ClientConfluenceResult> => {
  const [results, setResults] = useState<Map<string, ClientConfluenceResult>>(EMPTY);
  const latestResultsRef = useRef<Map<string, ClientConfluenceResult>>(EMPTY);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let pending = false;

    const run = () => {
      timer = null;
      pending = false;
      const entries = useChartLiveDataStore.getState().entries;
      const next = computeResults(entries, conditions, symbol, interval, marketType);
      if (resultsEqual(latestResultsRef.current, next)) return;
      latestResultsRef.current = next;
      setResults(next);
    };

    const schedule = () => {
      if (pending) return;
      pending = true;
      timer = setTimeout(run, THROTTLE_MS);
    };

    run();

    const unsub = useChartLiveDataStore.subscribe(schedule);

    return () => {
      unsub();
      if (timer !== null) clearTimeout(timer);
    };
  }, [conditions, symbol, interval, marketType]);

  return results;
};
