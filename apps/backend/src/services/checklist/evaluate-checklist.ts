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
import { parseIndicatorParams } from '../../utils/profile-transformers';
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
  resolvedTimeframe: string;
  op: ChecklistCondition['op'];
  tier: ChecklistCondition['tier'];
  side: ChecklistCondition['side'];
  enabled: boolean;
  evaluated: boolean;
  passed: boolean;
  value: number | null;
  countedLong: boolean;
  countedShort: boolean;
  error?: string;
}

export interface EvaluateChecklistResult {
  results: EvaluateChecklistConditionResult[];
  score: ChecklistScoreBreakdown;
  scoreLong: ChecklistScoreBreakdown;
  scoreShort: ChecklistScoreBreakdown;
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

const dedupKey = (cond: ChecklistCondition, resolvedTf: string): string =>
  `${cond.userIndicatorId}::${resolvedTf}::${cond.op}::${JSON.stringify(cond.threshold ?? null)}`;

interface CountableCondition {
  cond: ChecklistCondition;
  isExplicitTimeframe: boolean;
}

const pickRepresentativeConditions = (
  conditions: ChecklistCondition[],
  interval: string,
): Map<string, CountableCondition> => {
  const byKey = new Map<string, CountableCondition>();
  for (const cond of conditions) {
    const tf = resolveTimeframe(cond.timeframe, interval);
    const key = dedupKey(cond, tf);
    const isExplicit = cond.timeframe !== 'current';
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, { cond, isExplicitTimeframe: isExplicit });
      continue;
    }
    if (!existing.isExplicitTimeframe && isExplicit) {
      byKey.set(key, { cond, isExplicitTimeframe: isExplicit });
    }
  }
  return byKey;
};

const conditionAppliesToSide = (
  cond: ChecklistCondition,
  side: 'LONG' | 'SHORT',
): boolean => cond.side === side || cond.side === 'BOTH';

export const evaluateChecklist = async (
  input: EvaluateChecklistInput,
): Promise<EvaluateChecklistResult> => {
  const { userId, symbol, interval, marketType, conditions, side } = input;

  const enabledConditions = conditions.filter((c) => c.enabled);

  const emptyScore = calculateChecklistScore({
    requiredTotal: 0,
    requiredPassed: 0,
    preferredTotal: 0,
    preferredPassed: 0,
  });

  if (enabledConditions.length === 0) {
    return {
      results: [],
      score: emptyScore,
      scoreLong: emptyScore,
      scoreShort: emptyScore,
    };
  }

  const userIndicatorIds = Array.from(new Set(enabledConditions.map((c) => c.userIndicatorId)));

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
      params: parseIndicatorParams(row.params),
    });
  }

  const timeframes = new Set<string>();
  for (const c of enabledConditions) timeframes.add(resolveTimeframe(c.timeframe, interval));

  const klinesByTimeframe = new Map<string, Kline[]>();
  await Promise.all(
    Array.from(timeframes).map(async (tf) => {
      const klines = await fetchKlinesForTimeframe(symbol, tf, marketType);
      klinesByTimeframe.set(tf, klines);
    }),
  );

  const seriesCache = new Map<string, (number | null)[]>();

  const longApplicable = enabledConditions.filter((c) => conditionAppliesToSide(c, 'LONG'));
  const shortApplicable = enabledConditions.filter((c) => conditionAppliesToSide(c, 'SHORT'));
  const longRepresentatives = pickRepresentativeConditions(longApplicable, interval);
  const shortRepresentatives = pickRepresentativeConditions(shortApplicable, interval);
  const longRepIds = new Set(Array.from(longRepresentatives.values()).map((v) => v.cond.id));
  const shortRepIds = new Set(Array.from(shortRepresentatives.values()).map((v) => v.cond.id));

  const results: EvaluateChecklistConditionResult[] = [];
  let longRequiredTotal = 0;
  let longRequiredPassed = 0;
  let longPreferredTotal = 0;
  let longPreferredPassed = 0;
  let shortRequiredTotal = 0;
  let shortRequiredPassed = 0;
  let shortPreferredTotal = 0;
  let shortPreferredPassed = 0;

  for (const cond of enabledConditions) {
    const resolvedTf = resolveTimeframe(cond.timeframe, interval);
    const countsTowardLong = longRepIds.has(cond.id);
    const countsTowardShort = shortRepIds.has(cond.id);

    const userIndicator = indicatorMap.get(cond.userIndicatorId);
    if (!userIndicator) {
      results.push({
        conditionId: cond.id,
        userIndicatorId: cond.userIndicatorId,
        indicatorLabel: '',
        catalogType: '',
        timeframe: cond.timeframe,
        resolvedTimeframe: resolvedTf,
        op: cond.op,
        tier: cond.tier,
        side: cond.side,
        enabled: cond.enabled,
        evaluated: false,
        passed: false,
        value: null,
        countedLong: countsTowardLong,
        countedShort: countsTowardShort,
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
        resolvedTimeframe: resolvedTf,
        op: cond.op,
        tier: cond.tier,
        side: cond.side,
        enabled: cond.enabled,
        evaluated: false,
        passed: false,
        value: null,
        countedLong: countsTowardLong,
        countedShort: countsTowardShort,
        error: `Unknown catalog type: ${userIndicator.catalogType}`,
      });
      continue;
    }

    const klines = klinesByTimeframe.get(resolvedTf) ?? [];
    const cacheKey = indicatorComputeKey(cond.userIndicatorId, resolvedTf);

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
          resolvedTimeframe: resolvedTf,
          op: cond.op,
          tier: cond.tier,
          side: cond.side,
          enabled: cond.enabled,
          evaluated: false,
          passed: false,
          value: null,
          countedLong: countsTowardLong,
          countedShort: countsTowardShort,
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
        resolvedTimeframe: resolvedTf,
        op: cond.op,
        tier: cond.tier,
        side: cond.side,
        enabled: cond.enabled,
        evaluated: false,
        passed: false,
        value: null,
        countedLong: countsTowardLong,
        countedShort: countsTowardShort,
        error: message,
      });
      continue;
    }

    if (countsTowardLong) {
      if (cond.tier === 'required') {
        longRequiredTotal += 1;
        if (evaluation.passed) longRequiredPassed += 1;
      } else {
        longPreferredTotal += 1;
        if (evaluation.passed) longPreferredPassed += 1;
      }
    }
    if (countsTowardShort) {
      if (cond.tier === 'required') {
        shortRequiredTotal += 1;
        if (evaluation.passed) shortRequiredPassed += 1;
      } else {
        shortPreferredTotal += 1;
        if (evaluation.passed) shortPreferredPassed += 1;
      }
    }

    results.push({
      conditionId: cond.id,
      userIndicatorId: cond.userIndicatorId,
      indicatorLabel: userIndicator.label,
      catalogType: userIndicator.catalogType,
      timeframe: cond.timeframe,
      resolvedTimeframe: resolvedTf,
      op: cond.op,
      tier: cond.tier,
      side: cond.side,
      enabled: cond.enabled,
      evaluated: true,
      passed: evaluation.passed,
      value: evaluation.value,
      countedLong: countsTowardLong,
      countedShort: countsTowardShort,
    });
  }

  const scoreLong = calculateChecklistScore({
    requiredTotal: longRequiredTotal,
    requiredPassed: longRequiredPassed,
    preferredTotal: longPreferredTotal,
    preferredPassed: longPreferredPassed,
  });
  const scoreShort = calculateChecklistScore({
    requiredTotal: shortRequiredTotal,
    requiredPassed: shortRequiredPassed,
    preferredTotal: shortPreferredTotal,
    preferredPassed: shortPreferredPassed,
  });

  const score = side === 'LONG' ? scoreLong : side === 'SHORT' ? scoreShort : scoreLong;

  return { results, score, scoreLong, scoreShort };
};
