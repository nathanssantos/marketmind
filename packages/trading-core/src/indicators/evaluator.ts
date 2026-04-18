import type { ConditionOp, ConditionThreshold, ConditionEvaluationResult } from './types';

const DEFAULT_OVERSOLD_BOUND_PCT = 0.2;
const DEFAULT_OVERBOUGHT_BOUND_PCT = 0.8;

interface EvaluateInput {
  series: (number | null)[];
  op: ConditionOp;
  threshold?: ConditionThreshold;
  valueRange?: { min: number; max: number };
  compareSeries?: (number | null)[];
}

const latestDefined = (series: (number | null)[]): { index: number; value: number } | null => {
  for (let i = series.length - 1; i >= 0; i -= 1) {
    const v = series[i];
    if (v !== null && v !== undefined && Number.isFinite(v)) return { index: i, value: v };
  }
  return null;
};

const previousDefined = (
  series: (number | null)[],
  beforeIndex: number,
): { index: number; value: number } | null => {
  for (let i = beforeIndex - 1; i >= 0; i -= 1) {
    const v = series[i];
    if (v !== null && v !== undefined && Number.isFinite(v)) return { index: i, value: v };
  }
  return null;
};

const resolveBound = (
  range: { min: number; max: number } | undefined,
  pct: number,
): number | null => {
  if (!range) return null;
  return range.min + (range.max - range.min) * pct;
};

export const evaluateCondition = (input: EvaluateInput): ConditionEvaluationResult => {
  const { series, op, threshold, valueRange, compareSeries } = input;

  const latest = latestDefined(series);
  if (!latest) return { passed: false, value: null };

  const { value, index } = latest;

  switch (op) {
    case 'gt': {
      const t = typeof threshold === 'number' ? threshold : null;
      if (t === null) return { passed: false, value };
      return { passed: value > t, value };
    }

    case 'lt': {
      const t = typeof threshold === 'number' ? threshold : null;
      if (t === null) return { passed: false, value };
      return { passed: value < t, value };
    }

    case 'between': {
      if (!Array.isArray(threshold) || threshold.length !== 2) return { passed: false, value };
      const [lo, hi] = threshold;
      return { passed: value >= lo && value <= hi, value };
    }

    case 'outside': {
      if (!Array.isArray(threshold) || threshold.length !== 2) return { passed: false, value };
      const [lo, hi] = threshold;
      return { passed: value < lo || value > hi, value };
    }

    case 'crossAbove':
    case 'crossBelow': {
      const compareLatest = compareSeries ? latestDefined(compareSeries) : null;
      const ref =
        typeof threshold === 'number'
          ? threshold
          : compareLatest?.value ?? null;
      if (ref === null) return { passed: false, value };

      const prev = previousDefined(series, index);
      const prevRef =
        compareSeries && compareLatest
          ? previousDefined(compareSeries, compareLatest.index)?.value ?? ref
          : ref;

      if (!prev) return { passed: false, value };

      if (op === 'crossAbove') {
        return { passed: prev.value <= prevRef && value > ref, value };
      }
      return { passed: prev.value >= prevRef && value < ref, value };
    }

    case 'oversold': {
      const bound =
        typeof threshold === 'number'
          ? threshold
          : resolveBound(valueRange, DEFAULT_OVERSOLD_BOUND_PCT);
      if (bound === null) return { passed: false, value };
      return { passed: value <= bound, value };
    }

    case 'overbought': {
      const bound =
        typeof threshold === 'number'
          ? threshold
          : resolveBound(valueRange, DEFAULT_OVERBOUGHT_BOUND_PCT);
      if (bound === null) return { passed: false, value };
      return { passed: value >= bound, value };
    }

    case 'rising': {
      const prev = previousDefined(series, index);
      if (!prev) return { passed: false, value };
      return { passed: value > prev.value, value };
    }

    case 'falling': {
      const prev = previousDefined(series, index);
      if (!prev) return { passed: false, value };
      return { passed: value < prev.value, value };
    }

    default:
      return { passed: false, value };
  }
};
