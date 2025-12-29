export const MIN_KLINES = 100;
export const MAX_KLINES = 500;
export const DEFAULT_KLINES = 300;

interface StrategyDefinition {
  id: string;
  indicators?: Record<string, { params: Record<string, number | string> }>;
  parameters?: Record<string, { default: number }>;
  filters?: { trendFilter?: { period: number } };
  optimizedParams?: { onlyWithTrend?: boolean };
}

export const calculateRequiredKlines = (strategies: StrategyDefinition[]): number => {
  let maxPeriod = 50;

  for (const strategy of strategies) {
    if (strategy.indicators) {
      for (const [, indicator] of Object.entries(strategy.indicators)) {
        const params = indicator.params || {};
        const period = params['period'] || params['emaPeriod'] || params['smaPeriod'] ||
                      params['lookback'] || params['kPeriod'] || params['slowPeriod'] || 0;

        const periodValue = typeof period === 'string' && period.startsWith('$')
          ? strategy.parameters?.[period.slice(1)]?.default || 0
          : period;

        if (typeof periodValue === 'number' && periodValue > maxPeriod) {
          maxPeriod = periodValue;
        }
      }
    }

    if (strategy.parameters) {
      for (const [paramName, paramDef] of Object.entries(strategy.parameters)) {
        if (paramName.toLowerCase().includes('trend') ||
            paramName.toLowerCase().includes('ema') ||
            paramName.toLowerCase().includes('sma')) {
          if (paramDef.default > maxPeriod) maxPeriod = paramDef.default;
        }
      }
    }

    if (strategy.filters?.trendFilter?.period && strategy.filters.trendFilter.period > maxPeriod) {
      maxPeriod = strategy.filters.trendFilter.period;
    }

    if (strategy.optimizedParams?.onlyWithTrend) {
      maxPeriod = Math.max(maxPeriod, 200);
    }
  }

  const requiredKlines = Math.ceil(maxPeriod * 1.5);
  return Math.min(Math.max(requiredKlines, MIN_KLINES), MAX_KLINES);
};
