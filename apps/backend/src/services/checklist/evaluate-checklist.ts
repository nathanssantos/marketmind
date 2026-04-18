import type { Kline, MarketType } from '@marketmind/types';
import {
  INDICATOR_CATALOG,
  calculateChecklistScore,
  evaluateCondition,
  type ChecklistCondition,
  type ChecklistScoreBreakdown,
  type ConditionEvaluationResult,
  type IndicatorDefinition,
} from '@marketmind/trading-core';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '../../db';
import { klines as klinesTable, userIndicators } from '../../db/schema';
import { mapDbKlinesToApi } from '../../utils/kline-mapper';
import { prefetchKlines } from '../kline-prefetch';
import { PineIndicatorService } from '../pine/PineIndicatorService';

const pineService = new PineIndicatorService();

const CHECKLIST_KLINE_LOOKBACK = 500;

export interface EvaluateChecklistInput {
  userId: string;
  symbol: string;
  interval: string;
  marketType: MarketType;
  conditions: ChecklistCondition[];
  side?: 'LONG' | 'SHORT' | 'BOTH';
}

export interface EvaluateChecklistConditionResult {
  conditionId: string;
  userIndicatorId: string;
  indicatorLabel: string;
  catalogType: string;
  timeframe: string;
  op: ChecklistCondition['op'];
  tier: ChecklistCondition['tier'];
  side: ChecklistCondition['side'];
  enabled: boolean;
  evaluated: boolean;
  passed: boolean;
  value: number | null;
  error?: string;
}

export interface EvaluateChecklistResult {
  results: EvaluateChecklistConditionResult[];
  score: ChecklistScoreBreakdown;
}

interface UserIndicatorRow {
  id: string;
  catalogType: string;
  label: string;
  params: Record<string, number | string | boolean>;
}

const toNumericParams = (
  params: Record<string, number | string | boolean>,
): Record<string, number> => {
  const out: Record<string, number> = {};
  for (const [key, val] of Object.entries(params)) {
    if (typeof val === 'number') out[key] = val;
    else if (typeof val === 'string') {
      const n = parseFloat(val);
      if (Number.isFinite(n)) out[key] = n;
    }
  }
  return out;
};

const resolveTimeframe = (conditionTf: string, currentInterval: string): string =>
  conditionTf === 'current' ? currentInterval : conditionTf;

const resolveInterval = (tf: string): string => tf;

const fetchKlinesForTimeframe = async (
  symbol: string,
  interval: string,
  marketType: MarketType,
): Promise<Kline[]> => {
  await prefetchKlines({ symbol, interval, targetCount: CHECKLIST_KLINE_LOOKBACK, marketType });

  const rows = await db.query.klines.findMany({
    where: and(
      eq(klinesTable.symbol, symbol),
      eq(klinesTable.interval, interval),
      eq(klinesTable.marketType, marketType),
    ),
    orderBy: [desc(klinesTable.openTime)],
    limit: CHECKLIST_KLINE_LOOKBACK,
  });

  rows.sort((a, b) => a.openTime.getTime() - b.openTime.getTime());

  return mapDbKlinesToApi(rows);
};

const computeChoppiness = async (klines: Kline[], period: number): Promise<(number | null)[]> => {
  if (klines.length === 0) return [];
  if (klines.length < period) return Array(klines.length).fill(null);

  const [atrValues, highestValues, lowestValues] = await Promise.all([
    pineService.compute('atr', klines, { period: 1 }),
    pineService.compute('highest', klines, { period }),
    pineService.compute('lowest', klines, { period }),
  ]);

  const result: (number | null)[] = [];
  for (let i = 0; i < klines.length; i++) {
    if (i < period - 1) {
      result.push(null);
      continue;
    }
    let atrSum = 0;
    let validAtrCount = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const atr = atrValues[j];
      if (atr !== null && atr !== undefined && !isNaN(atr)) {
        atrSum += atr;
        validAtrCount++;
      }
    }
    const highest = highestValues[i];
    const lowest = lowestValues[i];
    if (highest == null || lowest == null) {
      result.push(null);
      continue;
    }
    const range = highest - lowest;
    if (range === 0 || validAtrCount < period) {
      result.push(null);
      continue;
    }
    result.push((100 * Math.log10(atrSum / range)) / Math.log10(period));
  }
  return result;
};

type PineSingle = 'sma' | 'ema' | 'rsi' | 'atr' | 'hma' | 'wma' | 'cci' | 'mfi'
  | 'roc' | 'cmo' | 'vwap' | 'obv' | 'wpr' | 'tsi' | 'sar';
type PineMulti = 'bb' | 'macd' | 'stoch' | 'kc' | 'supertrend' | 'dmi';

const PINE_SINGLE_SET = new Set<PineSingle>([
  'sma', 'ema', 'rsi', 'atr', 'hma', 'wma', 'cci', 'mfi',
  'roc', 'cmo', 'vwap', 'obv', 'wpr', 'tsi', 'sar',
]);
const PINE_MULTI_SET = new Set<PineMulti>(['bb', 'macd', 'stoch', 'kc', 'supertrend', 'dmi']);

const computeIndicatorSeries = async (
  def: IndicatorDefinition,
  klines: Kline[],
  numericParams: Record<string, number>,
): Promise<(number | null)[]> => {
  const { service, scriptId, outputKey } = def.evaluator;

  if (service === 'pine') {
    if (PINE_SINGLE_SET.has(scriptId as PineSingle)) {
      return pineService.compute(scriptId as PineSingle, klines, numericParams);
    }
    if (PINE_MULTI_SET.has(scriptId as PineMulti)) {
      const multi = await pineService.computeMulti(scriptId as PineMulti, klines, numericParams);
      const key = outputKey ?? def.outputs[0]?.key;
      if (!key) throw new Error(`No outputKey available for ${def.type}`);
      const series = multi[key];
      if (!series) throw new Error(`Output "${key}" not found for ${def.type}`);
      return series;
    }
    throw new Error(`Pine scriptId not supported: ${scriptId}`);
  }

  if (scriptId === 'choppiness') {
    const period = numericParams['period'] ?? 14;
    return computeChoppiness(klines, period);
  }

  throw new Error(`Native scriptId not supported yet in checklist evaluator: ${scriptId}`);
};

const closeSeriesFromKlines = (klines: Kline[]): (number | null)[] =>
  klines.map((k) => {
    const n = parseFloat(k.close);
    return Number.isFinite(n) ? n : null;
  });

const indicatorComputeKey = (
  userIndicatorId: string,
  timeframe: string,
): string => `${userIndicatorId}::${timeframe}`;

export const evaluateChecklist = async (
  input: EvaluateChecklistInput,
): Promise<EvaluateChecklistResult> => {
  const { userId, symbol, interval, marketType, conditions, side } = input;

  const activeConditions = conditions.filter((c) => {
    if (!c.enabled) return false;
    if (!side || side === 'BOTH') return true;
    return c.side === side || c.side === 'BOTH';
  });

  if (activeConditions.length === 0) {
    return {
      results: [],
      score: calculateChecklistScore({
        requiredTotal: 0,
        requiredPassed: 0,
        preferredTotal: 0,
        preferredPassed: 0,
      }),
    };
  }

  const userIndicatorIds = Array.from(new Set(activeConditions.map((c) => c.userIndicatorId)));

  const indicatorRows = await db
    .select()
    .from(userIndicators)
    .where(eq(userIndicators.userId, userId));

  const indicatorMap = new Map<string, UserIndicatorRow>();
  for (const row of indicatorRows) {
    if (!userIndicatorIds.includes(row.id)) continue;
    indicatorMap.set(row.id, {
      id: row.id,
      catalogType: row.catalogType,
      label: row.label,
      params: JSON.parse(row.params) as Record<string, number | string | boolean>,
    });
  }

  const timeframes = new Set<string>();
  for (const c of activeConditions) timeframes.add(resolveTimeframe(c.timeframe, interval));

  const klinesByTimeframe = new Map<string, Kline[]>();
  await Promise.all(
    Array.from(timeframes).map(async (tf) => {
      const klines = await fetchKlinesForTimeframe(symbol, resolveInterval(tf), marketType);
      klinesByTimeframe.set(tf, klines);
    }),
  );

  const seriesCache = new Map<string, (number | null)[]>();

  const results: EvaluateChecklistConditionResult[] = [];
  let requiredTotal = 0;
  let requiredPassed = 0;
  let preferredTotal = 0;
  let preferredPassed = 0;

  for (const cond of activeConditions) {
    const userIndicator = indicatorMap.get(cond.userIndicatorId);
    if (!userIndicator) {
      results.push({
        conditionId: cond.id,
        userIndicatorId: cond.userIndicatorId,
        indicatorLabel: '',
        catalogType: '',
        timeframe: cond.timeframe,
        op: cond.op,
        tier: cond.tier,
        side: cond.side,
        enabled: cond.enabled,
        evaluated: false,
        passed: false,
        value: null,
        error: 'User indicator not found',
      });
      continue;
    }

    const catalogDef = INDICATOR_CATALOG[userIndicator.catalogType];
    if (!catalogDef) {
      results.push({
        conditionId: cond.id,
        userIndicatorId: cond.userIndicatorId,
        indicatorLabel: userIndicator.label,
        catalogType: userIndicator.catalogType,
        timeframe: cond.timeframe,
        op: cond.op,
        tier: cond.tier,
        side: cond.side,
        enabled: cond.enabled,
        evaluated: false,
        passed: false,
        value: null,
        error: `Unknown catalog type: ${userIndicator.catalogType}`,
      });
      continue;
    }

    const tf = resolveTimeframe(cond.timeframe, interval);
    const klines = klinesByTimeframe.get(tf) ?? [];
    const cacheKey = indicatorComputeKey(cond.userIndicatorId, tf);

    let series = seriesCache.get(cacheKey);
    if (!series) {
      try {
        const numericParams = toNumericParams(userIndicator.params);
        series = await computeIndicatorSeries(catalogDef, klines, numericParams);
        seriesCache.set(cacheKey, series);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'compute failed';
        results.push({
          conditionId: cond.id,
          userIndicatorId: cond.userIndicatorId,
          indicatorLabel: userIndicator.label,
          catalogType: userIndicator.catalogType,
          timeframe: cond.timeframe,
          op: cond.op,
          tier: cond.tier,
          side: cond.side,
          enabled: cond.enabled,
          evaluated: false,
          passed: false,
          value: null,
          error: message,
        });
        continue;
      }
    }

    const closeSeries = closeSeriesFromKlines(klines);

    let evaluation: ConditionEvaluationResult;
    try {
      evaluation = evaluateCondition({
        series,
        op: cond.op,
        threshold: cond.threshold,
        valueRange: catalogDef.valueRange,
        closeSeries,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'evaluate failed';
      results.push({
        conditionId: cond.id,
        userIndicatorId: cond.userIndicatorId,
        indicatorLabel: userIndicator.label,
        catalogType: userIndicator.catalogType,
        timeframe: cond.timeframe,
        op: cond.op,
        tier: cond.tier,
        side: cond.side,
        enabled: cond.enabled,
        evaluated: false,
        passed: false,
        value: null,
        error: message,
      });
      continue;
    }

    if (cond.tier === 'required') {
      requiredTotal += 1;
      if (evaluation.passed) requiredPassed += 1;
    } else {
      preferredTotal += 1;
      if (evaluation.passed) preferredPassed += 1;
    }

    results.push({
      conditionId: cond.id,
      userIndicatorId: cond.userIndicatorId,
      indicatorLabel: userIndicator.label,
      catalogType: userIndicator.catalogType,
      timeframe: cond.timeframe,
      op: cond.op,
      tier: cond.tier,
      side: cond.side,
      enabled: cond.enabled,
      evaluated: true,
      passed: evaluation.passed,
      value: evaluation.value,
    });
  }

  const score = calculateChecklistScore({
    requiredTotal,
    requiredPassed,
    preferredTotal,
    preferredPassed,
  });

  return { results, score };
};
