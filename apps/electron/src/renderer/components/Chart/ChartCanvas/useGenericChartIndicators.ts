import type { Kline } from '@marketmind/types';
import type { IndicatorParamValue } from '@marketmind/trading-core';
import { INDICATOR_CATALOG } from '@marketmind/trading-core';
import { computeMulti, computeSingle } from '@renderer/workers/pineWorkerService';
import { getNativeEvaluator, type NativeEvaluatorContext } from '@renderer/lib/indicators/nativeEvaluators';
import type { IndicatorInstance } from '@renderer/store/indicatorStore';
import { useEffect, useMemo, useRef, useState } from 'react';

export type IndicatorOutputSeries = (number | null)[];
export type IndicatorOutputs = Record<string, IndicatorOutputSeries>;

export interface UseGenericChartIndicatorsResult {
  outputs: Map<string, IndicatorOutputs>;
  isComputing: boolean;
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

export const useGenericChartIndicators = (
  klines: Kline[],
  instances: IndicatorInstance[],
  externalCtx: NativeEvaluatorContext = {},
): UseGenericChartIndicatorsResult => {
  const batches = useMemo(() => buildBatches(instances), [instances]);
  const klinesRef = useRef(klines);
  klinesRef.current = klines;
  const ctxRef = useRef<NativeEvaluatorContext>(externalCtx);
  ctxRef.current = externalCtx;

  const klinesSignature = useMemo(() => {
    if (klines.length === 0) return 'empty';
    const first = klines[0]!;
    const last = klines[klines.length - 1]!;
    return `${klines.length}:${first.openTime}:${last.openTime}:${last.close}:${last.high}:${last.low}:${last.volume}`;
  }, [klines]);

  const ctxSignature = useMemo(() => {
    const events = externalCtx.marketEvents?.length ?? 0;
    const fp = externalCtx.footprintBars?.length ?? 0;
    const heat = externalCtx.liquidityHeatmap?.buckets.length ?? 0;
    const liq = externalCtx.liquidityHeatmap?.liquidations?.length ?? 0;
    const interval = externalCtx.intervalMinutes ?? 0;
    return `e${events}|f${fp}|h${heat}|l${liq}|i${interval}`;
  }, [externalCtx]);

  const [outputs, setOutputs] = useState<Map<string, IndicatorOutputs>>(() => new Map());
  const [isComputing, setIsComputing] = useState(false);

  useEffect(() => {
    if (klines.length === 0 || batches.length === 0) {
      setOutputs(new Map());
      setIsComputing(false);
      return;
    }

    let cancelled = false;
    setIsComputing(true);

    const compute = async () => {
      const next = new Map<string, IndicatorOutputs>();
      for (const batch of batches) {
        if (cancelled) return;
        try {
          const result = batch.service === 'pine'
            ? await runPineBatch(klinesRef.current, batch.scriptId, batch.params)
            : runNativeBatch(klinesRef.current, batch.scriptId, batch.params, ctxRef.current);
          for (const id of batch.instanceIds) next.set(id, result);
        } catch (err) {
          console.error(`[useGenericChartIndicators] batch failed: ${batch.service}/${batch.scriptId}`, err);
          for (const id of batch.instanceIds) next.set(id, {});
        }
      }
      if (!cancelled) {
        setOutputs(next);
        setIsComputing(false);
      }
    };

    void compute();

    return () => {
      cancelled = true;
    };
  }, [batches, klinesSignature, klines.length, ctxSignature]);

  return useMemo(() => ({ outputs, isComputing }), [outputs, isComputing]);
};
