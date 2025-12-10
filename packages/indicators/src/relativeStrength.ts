export interface RelativeStrengthResult {
  ratio: number | null;
  change: number | null;
  changePercent: number | null;
  outperforming: boolean;
  strength: 'strong' | 'moderate' | 'weak' | 'underperforming';
}

export interface RelativeStrengthConfig {
  period: number;
  outperformThreshold: number;
}

const DEFAULT_CONFIG: RelativeStrengthConfig = {
  period: 14,
  outperformThreshold: 1.0,
};

export const calculateRelativeStrength = (
  assetCloses: number[],
  baseCloses: number[],
  config: Partial<RelativeStrengthConfig> = {}
): RelativeStrengthResult => {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  if (assetCloses.length === 0 || baseCloses.length === 0) {
    return {
      ratio: null,
      change: null,
      changePercent: null,
      outperforming: false,
      strength: 'weak',
    };
  }

  const len = Math.min(assetCloses.length, baseCloses.length);

  const currentAsset = assetCloses[len - 1]!;
  const currentBase = baseCloses[len - 1]!;

  if (currentBase === 0) {
    return {
      ratio: null,
      change: null,
      changePercent: null,
      outperforming: false,
      strength: 'weak',
    };
  }

  const ratio = currentAsset / currentBase;

  let change: number | null = null;
  let changePercent: number | null = null;

  if (len > cfg.period) {
    const previousAsset = assetCloses[len - 1 - cfg.period]!;
    const previousBase = baseCloses[len - 1 - cfg.period]!;

    if (previousBase !== 0 && previousAsset !== 0) {
      const previousRatio = previousAsset / previousBase;
      change = ratio - previousRatio;
      changePercent = ((ratio - previousRatio) / previousRatio) * 100;
    }
  }

  const outperforming = ratio > cfg.outperformThreshold;

  let strength: 'strong' | 'moderate' | 'weak' | 'underperforming' = 'weak';
  if (ratio > 1.5) {
    strength = 'strong';
  } else if (ratio > 1.2) {
    strength = 'moderate';
  } else if (ratio >= 1.0) {
    strength = 'weak';
  } else {
    strength = 'underperforming';
  }

  return {
    ratio,
    change,
    changePercent,
    outperforming,
    strength,
  };
};

export const calculateRelativeStrengthSeries = (
  assetCloses: number[],
  baseCloses: number[]
): (number | null)[] => {
  const len = Math.min(assetCloses.length, baseCloses.length);
  const result: (number | null)[] = [];

  for (let i = 0; i < len; i++) {
    const asset = assetCloses[i];
    const base = baseCloses[i];

    if (asset === undefined || base === undefined || base === 0) {
      result.push(null);
      continue;
    }

    result.push(asset / base);
  }

  return result;
};

export const calculateRelativeStrengthNormalized = (
  assetCloses: number[],
  baseCloses: number[],
  startIndex: number = 0
): (number | null)[] => {
  const len = Math.min(assetCloses.length, baseCloses.length);

  if (len <= startIndex) {
    return [];
  }

  const baseAsset = assetCloses[startIndex];
  const baseBase = baseCloses[startIndex];

  if (baseAsset === undefined || baseBase === undefined || baseAsset === 0 || baseBase === 0) {
    return Array(len).fill(null);
  }

  const result: (number | null)[] = [];

  for (let i = 0; i < len; i++) {
    const asset = assetCloses[i];
    const base = baseCloses[i];

    if (asset === undefined || base === undefined || base === 0) {
      result.push(null);
      continue;
    }

    const assetReturn = (asset - baseAsset) / baseAsset;
    const baseReturn = (base - baseBase) / baseBase;

    result.push(assetReturn - baseReturn);
  }

  return result;
};

export const calculateRelativeStrengthMA = (
  assetCloses: number[],
  baseCloses: number[],
  period: number = 14
): (number | null)[] => {
  const ratios = calculateRelativeStrengthSeries(assetCloses, baseCloses);
  const result: (number | null)[] = [];

  for (let i = 0; i < ratios.length; i++) {
    if (i < period - 1) {
      result.push(null);
      continue;
    }

    let sum = 0;
    let count = 0;

    for (let j = 0; j < period; j++) {
      const val = ratios[i - j];
      if (val !== null && val !== undefined) {
        sum += val;
        count++;
      }
    }

    result.push(count > 0 ? sum / count : null);
  }

  return result;
};

export const detectRelativeStrengthSignal = (
  assetCloses: number[],
  baseCloses: number[],
  config: Partial<RelativeStrengthConfig> = {}
): { signal: 'outperform' | 'underperform' | 'neutral'; confidence: number } => {
  const result = calculateRelativeStrength(assetCloses, baseCloses, config);

  if (result.ratio === null) {
    return { signal: 'neutral', confidence: 0 };
  }

  if (result.ratio > 1.2 && result.changePercent !== null && result.changePercent > 5) {
    return { signal: 'outperform', confidence: Math.min(100, result.changePercent * 5) };
  }

  if (result.ratio < 0.8 && result.changePercent !== null && result.changePercent < -5) {
    return { signal: 'underperform', confidence: Math.min(100, Math.abs(result.changePercent) * 5) };
  }

  return { signal: 'neutral', confidence: 0 };
};

export const calculatePerformanceComparison = (
  assetCloses: number[],
  baseCloses: number[],
  periods: number[] = [7, 14, 30, 90]
): Map<number, { assetReturn: number; baseReturn: number; outperformance: number }> => {
  const result = new Map<
    number,
    { assetReturn: number; baseReturn: number; outperformance: number }
  >();

  const len = Math.min(assetCloses.length, baseCloses.length);

  for (const period of periods) {
    if (len <= period) {
      continue;
    }

    const currentAsset = assetCloses[len - 1]!;
    const previousAsset = assetCloses[len - 1 - period]!;
    const currentBase = baseCloses[len - 1]!;
    const previousBase = baseCloses[len - 1 - period]!;

    if (previousAsset === 0 || previousBase === 0) {
      continue;
    }

    const assetReturn = ((currentAsset - previousAsset) / previousAsset) * 100;
    const baseReturn = ((currentBase - previousBase) / previousBase) * 100;
    const outperformance = assetReturn - baseReturn;

    result.set(period, { assetReturn, baseReturn, outperformance });
  }

  return result;
};

export const findStrongestAssets = (
  assetClosesMap: Map<string, number[]>,
  baseCloses: number[],
  topN: number = 5,
  period: number = 14
): { symbol: string; ratio: number; changePercent: number }[] => {
  const results: { symbol: string; ratio: number; changePercent: number }[] = [];

  for (const [symbol, assetCloses] of assetClosesMap) {
    const result = calculateRelativeStrength(assetCloses, baseCloses, { period });

    if (result.ratio !== null && result.changePercent !== null) {
      results.push({
        symbol,
        ratio: result.ratio,
        changePercent: result.changePercent,
      });
    }
  }

  return results.sort((a, b) => b.ratio - a.ratio).slice(0, topN);
};
