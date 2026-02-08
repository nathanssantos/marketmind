import type { ScreenerFilterCondition } from '@marketmind/types';
import { SCREENER } from '../../constants/screener';

export interface FilterEvalResult {
  passed: boolean;
  actualValue: number | null;
}

export interface FiltersEvalResult {
  passed: boolean;
  matchedCount: number;
  totalCount: number;
}

export const evaluateFilter = (
  condition: ScreenerFilterCondition,
  indicatorValues: Record<string, number | null>,
  previousValues?: Record<string, number | null>,
): FilterEvalResult => {
  const value = indicatorValues[condition.indicator] ?? null;
  if (value === null) return { passed: false, actualValue: null };

  const threshold = condition.compareIndicator
    ? indicatorValues[condition.compareIndicator] ?? null
    : condition.value ?? null;

  switch (condition.operator) {
    case 'ABOVE': {
      if (threshold === null) return { passed: false, actualValue: value };
      return { passed: value > threshold, actualValue: value };
    }
    case 'BELOW': {
      if (threshold === null) return { passed: false, actualValue: value };
      return { passed: value < threshold, actualValue: value };
    }
    case 'BETWEEN': {
      const min = condition.value ?? null;
      const max = condition.valueMax ?? null;
      if (min === null || max === null) return { passed: false, actualValue: value };
      return { passed: value >= min && value <= max, actualValue: value };
    }
    case 'CROSSES_ABOVE': {
      if (threshold === null) return { passed: false, actualValue: value };
      const prev = previousValues?.[condition.indicator] ?? null;
      if (prev === null) return { passed: false, actualValue: value };
      return { passed: value > threshold && prev <= threshold, actualValue: value };
    }
    case 'CROSSES_BELOW': {
      if (threshold === null) return { passed: false, actualValue: value };
      const prev = previousValues?.[condition.indicator] ?? null;
      if (prev === null) return { passed: false, actualValue: value };
      return { passed: value < threshold && prev >= threshold, actualValue: value };
    }
    case 'INCREASING': {
      const prev = previousValues?.[condition.indicator] ?? null;
      if (prev === null) return { passed: false, actualValue: value };
      return { passed: value > prev, actualValue: value };
    }
    case 'DECREASING': {
      const prev = previousValues?.[condition.indicator] ?? null;
      if (prev === null) return { passed: false, actualValue: value };
      return { passed: value < prev, actualValue: value };
    }
    default:
      return { passed: false, actualValue: value };
  }
};

export const evaluateFilters = (
  conditions: ScreenerFilterCondition[],
  indicatorValues: Record<string, number | null>,
  previousValues?: Record<string, number | null>,
): FiltersEvalResult => {
  if (conditions.length === 0) return { passed: true, matchedCount: 0, totalCount: 0 };

  const grouped = new Map<string, ScreenerFilterCondition[]>();
  const ungrouped: ScreenerFilterCondition[] = [];

  for (const cond of conditions) {
    if (cond.logicGroup) {
      const group = grouped.get(cond.logicGroup) ?? [];
      group.push(cond);
      grouped.set(cond.logicGroup, group);
    } else {
      ungrouped.push(cond);
    }
  }

  let matchedCount = 0;

  for (const cond of ungrouped) {
    const result = evaluateFilter(cond, indicatorValues, previousValues);
    if (result.passed) matchedCount++;
    else return { passed: false, matchedCount, totalCount: conditions.length };
  }

  for (const [_group, groupConditions] of grouped) {
    const anyPassed = groupConditions.some(
      (cond) => evaluateFilter(cond, indicatorValues, previousValues).passed,
    );
    if (anyPassed) matchedCount += groupConditions.length;
    else return { passed: false, matchedCount, totalCount: conditions.length };
  }

  return { passed: true, matchedCount, totalCount: conditions.length };
};

export const needsPreviousValues = (conditions: ScreenerFilterCondition[]): boolean =>
  conditions.some(
    (c) =>
      c.operator === 'CROSSES_ABOVE' ||
      c.operator === 'CROSSES_BELOW' ||
      c.operator === 'INCREASING' ||
      c.operator === 'DECREASING',
  );

export const getLookbackBars = (conditions: ScreenerFilterCondition[]): number => {
  if (!needsPreviousValues(conditions)) return 0;
  const hasCross = conditions.some(
    (c) => c.operator === 'CROSSES_ABOVE' || c.operator === 'CROSSES_BELOW',
  );
  return hasCross ? SCREENER.LOOKBACK_BARS_FOR_CROSS : SCREENER.LOOKBACK_BARS_FOR_TREND;
};
