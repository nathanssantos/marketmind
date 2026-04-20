import type { Kline, MarketType } from '@marketmind/types';
import type { IndicatorParamValue } from '@marketmind/trading-core';
import { INDICATOR_CATALOG } from '@marketmind/trading-core';
import { computeMulti, computeSingle } from '@renderer/workers/pineWorkerService';
import { getNativeEvaluator, type NativeEvaluatorContext } from '@renderer/lib/indicators/nativeEvaluators';
import type { IndicatorInstance } from '@renderer/store/indicatorStore';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import { buildChartLiveDataKey, useChartLiveDataStore, type ChartLiveIndicatorEntry } from '@renderer/store/chartLiveDataStore';
import type { MutableRefObject } from 'react';
import { useCallback, useEffect, useMemo, useRef } from 'react';

export type IndicatorOutputSeries = (number | null)[];
export type IndicatorOutputs = Record<string, IndicatorOutputSeries>;

export interface UseGenericChartIndicatorsResult {
  outputsRef: MutableRefObject<Map<string, IndicatorOutputs>>;
}

export interface LiveDataTarget {
  symbol: string;
  marketType: MarketType;
  timeframe: string;
}

export interface BatchKey {
  scriptId: string;
  paramsHash: string;
  service: 'pine' | 'native';
  catalogType: string;
  params: Record<string, IndicatorParamValue>;
  instanceIds: string[];
}

export const SINGLE_PINE_SCRIPTS = new Set([
  'sma', 'ema', 'rsi', 'atr', 'hma', 'wma', 'cci', 'mfi',
  'roc', 'cmo', 'vwap', 'obv', 'wpr', 'tsi', 'sar',
]);

export const MULTI_PINE_SCRIPTS = new Set(['bb', 'macd', 'stoch', 'kc', 'supertrend', 'dmi']);

export const COSMETIC_PARAM_KEYS = new Set(['color', 'lineWidth']);

const TICK_POLL_MS = 500;

export const stableSerialize = (params: Record<string, IndicatorParamValue>): string => {
  const keys = Object.keys(params).filter((k) => !COSMETIC_PARAM_KEYS.has(k)).sort();
  return keys.map((k) => `${k}=${params[k]}`).join('|');
};

export const buildBatches = (instances: IndicatorInstance[]): BatchKey[] => {
  const map = new Map<string, BatchKey>();
  for (const instance of instances) {
    if (!instance.visible) continue;
    const def = INDICATOR_CATALOG[instance.catalogType];
    if (!def) continue;
    const { scriptId, service } = def.evaluator;
    const mergedParams = def.params.reduce<Record<string, IndicatorParamValue>>((acc, p) => {
      acc[p.key] = instance.params[p.key] ?? p.default;
      return acc;
    }, {});
    const paramsHash = stableSerialize(mergedParams);
    const key = `${service}:${scriptId}:${paramsHash}`;
    const existing = map.get(key);
    if (existing) {
      existing.instanceIds.push(instance.id);
    } else {
      map.set(key, {
        scriptId,
        paramsHash,
        service,
        catalogType: instance.catalogType,
        params: mergedParams,
        instanceIds: [instance.id],
      });
    }
  }
  return Array.from(map.values());
};

const runPineBatch = async (
  klines: Kline[],
  scriptId: string,
  params: Record<string, IndicatorParamValue>,
): Promise<IndicatorOutputs> => {
  const numericParams: Record<string, number> = {};
  for (const [k, v] of Object.entries(params)) {
    if (typeof v === 'number') numericParams[k] = v;
    else if (typeof v === 'string' && v !== '' && Number.isFinite(Number(v))) numericParams[k] = Number(v);
  }

  if (SINGLE_PINE_SCRIPTS.has(scriptId)) {
    const series = await computeSingle(scriptId as Parameters<typeof computeSingle>[0], klines, numericParams);
    return { value: series };
  }

  if (MULTI_PINE_SCRIPTS.has(scriptId)) {
    const result = await computeMulti(scriptId as Parameters<typeof computeMulti>[0], klines, numericParams);
    return result;
  }

  return {};
};

const runNativeBatch = (
  klines: Kline[],
  scriptId: string,
  params: Record<string, IndicatorParamValue>,
  ctx: NativeEvaluatorContext,
): IndicatorOutputs => {
  const evaluator = getNativeEvaluator(scriptId);
  if (!evaluator) return {};
  return evaluator(klines, params, ctx);
};

const syncLiveData = (
  target: LiveDataTarget,
  instances: IndicatorInstance[],
  outputs: Map<string, IndicatorOutputs>,
  klines: Kline[],
): void => {
  const key = buildChartLiveDataKey(target.symbol, target.timeframe, target.marketType);
  const indicators = new Map<string, ChartLiveIndicatorEntry>();
  for (const inst of instances) {
    if (!inst.visible) continue;
    const out = outputs.get(inst.id);
    if (!out) continue;
    indicators.set(inst.userIndicatorId, { catalogType: inst.catalogType, outputs: out });
  }
  useChartLiveDataStore.getState().setEntry(key, {
    symbol: target.symbol,
    interval: target.timeframe,
    marketType: target.marketType,
    klines,
    indicators,
  });
};

export const useGenericChartIndicators = (
  klines: Kline[],
  instances: IndicatorInstance[],
  externalCtx: NativeEvaluatorContext = {},
  managerRef?: MutableRefObject<CanvasManager | null>,
  liveDataTarget?: LiveDataTarget | null,
): UseGenericChartIndicatorsResult => {
  const batches = useMemo(() => buildBatches(instances), [instances]);

  const klinesRef = useRef(klines);
  klinesRef.current = klines;
  const instancesRef = useRef(instances);
  instancesRef.current = instances;
  const batchesRef = useRef(batches);
  batchesRef.current = batches;
  const ctxRef = useRef<NativeEvaluatorContext>(externalCtx);
  ctxRef.current = externalCtx;
  const managerRefStable = useRef(managerRef);
  managerRefStable.current = managerRef;
  const liveTargetRef = useRef(liveDataTarget ?? null);
  liveTargetRef.current = liveDataTarget ?? null;

  const outputsRef = useRef<Map<string, IndicatorOutputs>>(new Map());
  const cancellationRef = useRef<{ cancelled: boolean } | null>(null);
  const pendingRef = useRef(false);

  const runCompute = useCallback(() => {
    if (pendingRef.current) return;
    pendingRef.current = true;

    queueMicrotask(async () => {
      pendingRef.current = false;
      if (cancellationRef.current) cancellationRef.current.cancelled = true;
      const token = { cancelled: false };
      cancellationRef.current = token;

      const currentBatches = batchesRef.current;
      const currentKlines = klinesRef.current;
      const currentCtx = ctxRef.current;
      const currentInstances = instancesRef.current;
      const currentTarget = liveTargetRef.current;
      const currentManagerRef = managerRefStable.current;

      const out = outputsRef.current;

      if (currentKlines.length === 0 || currentBatches.length === 0) {
        if (out.size > 0) out.clear();
        currentManagerRef?.current?.markDirty('overlays');
        if (currentTarget) syncLiveData(currentTarget, currentInstances, out, currentKlines);
        return;
      }

      const expectedIds = new Set<string>();
      for (const batch of currentBatches) {
        if (token.cancelled) return;
        try {
          const result = batch.service === 'pine'
            ? await runPineBatch(currentKlines, batch.scriptId, batch.params)
            : runNativeBatch(currentKlines, batch.scriptId, batch.params, currentCtx);
          for (const id of batch.instanceIds) {
            out.set(id, result);
            expectedIds.add(id);
          }
        } catch (err) {
          console.error(`[useGenericChartIndicators] batch failed: ${batch.service}/${batch.scriptId}`, err);
          for (const id of batch.instanceIds) {
            out.set(id, {});
            expectedIds.add(id);
          }
        }
      }
      if (token.cancelled) return;

      for (const id of Array.from(out.keys())) {
        if (!expectedIds.has(id)) out.delete(id);
      }

      currentManagerRef?.current?.markDirty('overlays');
      if (currentTarget) syncLiveData(currentTarget, currentInstances, out, currentKlines);
    });
  }, []);

  const klinesSignature = useMemo(() => {
    if (klines.length === 0) return 'empty';
    const first = klines[0]!;
    const last = klines[klines.length - 1]!;
    return `${klines.length}:${first.openTime}:${last.openTime}`;
  }, [klines]);

  const ctxSignature = useMemo(() => {
    const events = externalCtx.marketEvents?.length ?? 0;
    const fp = externalCtx.footprintBars?.length ?? 0;
    const heat = externalCtx.liquidityHeatmap?.buckets.length ?? 0;
    const liq = externalCtx.liquidityHeatmap?.liquidations?.length ?? 0;
    const interval = externalCtx.intervalMinutes ?? 0;
    return `e${events}|f${fp}|h${heat}|l${liq}|i${interval}`;
  }, [externalCtx]);

  useEffect(() => {
    runCompute();
  }, [batches, klinesSignature, ctxSignature, runCompute]);

  const lastTickKeyRef = useRef<string>('');
  useEffect(() => {
    const id = setInterval(() => {
      const arr = klinesRef.current;
      if (arr.length === 0) return;
      const manager = managerRefStable.current?.current;
      if (manager?.isRecentlyPanning?.()) return;
      const last = arr[arr.length - 1]!;
      const key = `${last.close}:${last.high}:${last.low}:${last.volume}`;
      if (key === lastTickKeyRef.current) return;
      lastTickKeyRef.current = key;
      runCompute();
    }, TICK_POLL_MS);
    return () => clearInterval(id);
  }, [runCompute]);

  useEffect(() => {
    const target = liveDataTarget;
    if (!target) return;
    const key = buildChartLiveDataKey(target.symbol, target.timeframe, target.marketType);
    return () => useChartLiveDataStore.getState().clearEntry(key);
  }, [liveDataTarget?.symbol, liveDataTarget?.marketType, liveDataTarget?.timeframe]);

  return useMemo(() => ({ outputsRef }), []);
};
