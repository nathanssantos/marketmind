export interface LiquidationData {
  timestamp: number;
  longLiquidations: number;
  shortLiquidations: number;
  totalLiquidations: number;
  symbol?: string;
}

export interface LiquidationResult {
  longLiquidations: number;
  shortLiquidations: number;
  totalLiquidations: number;
  dominantSide: 'long' | 'short' | 'balanced';
  isCascade: boolean;
  cascadeStrength: number;
}

export interface LiquidationConfig {
  cascadeThreshold: number;
  lookbackPeriods: number;
  imbalanceThreshold: number;
}

const DEFAULT_CONFIG: LiquidationConfig = {
  cascadeThreshold: 50,
  lookbackPeriods: 6,
  imbalanceThreshold: 0.7,
};

export const calculateLiquidations = (
  data: LiquidationData[],
  config: Partial<LiquidationConfig> = {}
): LiquidationResult => {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  if (data.length === 0) {
    return {
      longLiquidations: 0,
      shortLiquidations: 0,
      totalLiquidations: 0,
      dominantSide: 'balanced',
      isCascade: false,
      cascadeStrength: 0,
    };
  }

  const sorted = [...data].sort((a, b) => b.timestamp - a.timestamp);
  const recent = sorted.slice(0, cfg.lookbackPeriods);

  const longLiquidations = recent.reduce((sum, d) => sum + d.longLiquidations, 0);
  const shortLiquidations = recent.reduce((sum, d) => sum + d.shortLiquidations, 0);
  const totalLiquidations = longLiquidations + shortLiquidations;

  let dominantSide: 'long' | 'short' | 'balanced' = 'balanced';
  if (totalLiquidations > 0) {
    const longRatio = longLiquidations / totalLiquidations;
    if (longRatio > cfg.imbalanceThreshold) {
      dominantSide = 'long';
    } else if (longRatio < 1 - cfg.imbalanceThreshold) {
      dominantSide = 'short';
    }
  }

  const isCascade = totalLiquidations >= cfg.cascadeThreshold;

  let cascadeStrength = 0;
  if (isCascade) {
    cascadeStrength = Math.min(100, (totalLiquidations / cfg.cascadeThreshold) * 50);
  }

  return {
    longLiquidations,
    shortLiquidations,
    totalLiquidations,
    dominantSide,
    isCascade,
    cascadeStrength,
  };
};

export const calculateLiquidationSeries = (
  data: LiquidationData[]
): { long: number[]; short: number[]; total: number[] } => {
  const sorted = [...data].sort((a, b) => a.timestamp - b.timestamp);

  return {
    long: sorted.map((d) => d.longLiquidations),
    short: sorted.map((d) => d.shortLiquidations),
    total: sorted.map((d) => d.totalLiquidations),
  };
};

export const calculateLiquidationMA = (
  data: LiquidationData[],
  period: number = 24
): { longMA: (number | null)[]; shortMA: (number | null)[]; totalMA: (number | null)[] } => {
  const sorted = [...data].sort((a, b) => a.timestamp - b.timestamp);

  const longMA: (number | null)[] = [];
  const shortMA: (number | null)[] = [];
  const totalMA: (number | null)[] = [];

  for (let i = 0; i < sorted.length; i++) {
    if (i < period - 1) {
      longMA.push(null);
      shortMA.push(null);
      totalMA.push(null);
      continue;
    }

    let longSum = 0;
    let shortSum = 0;
    let totalSum = 0;

    for (let j = 0; j < period; j++) {
      const d = sorted[i - j]!;
      longSum += d.longLiquidations;
      shortSum += d.shortLiquidations;
      totalSum += d.totalLiquidations;
    }

    longMA.push(longSum / period);
    shortMA.push(shortSum / period);
    totalMA.push(totalSum / period);
  }

  return { longMA, shortMA, totalMA };
};

export const detectLiquidationCascade = (
  data: LiquidationData[],
  priceChanges: number[],
  config: Partial<LiquidationConfig> = {}
): { cascade: boolean; signal: 'long' | 'short' | 'none'; strength: number } => {
  const result = calculateLiquidations(data, config);

  if (!result.isCascade) {
    return { cascade: false, signal: 'none', strength: 0 };
  }

  const recentPriceChange = priceChanges.length > 0 ? priceChanges[priceChanges.length - 1] : 0;

  if (result.dominantSide === 'long' && recentPriceChange !== undefined && recentPriceChange < -3) {
    return {
      cascade: true,
      signal: 'long',
      strength: result.cascadeStrength,
    };
  }

  if (result.dominantSide === 'short' && recentPriceChange !== undefined && recentPriceChange > 3) {
    return {
      cascade: true,
      signal: 'short',
      strength: result.cascadeStrength,
    };
  }

  return { cascade: true, signal: 'none', strength: result.cascadeStrength };
};

export const calculateLiquidationHeatmap = (
  _data: LiquidationData[],
  priceLevels: number[],
  _tolerance: number = 0.01
): Map<number, { long: number; short: number }> => {
  const heatmap = new Map<number, { long: number; short: number }>();

  for (const level of priceLevels) {
    heatmap.set(level, { long: 0, short: 0 });
  }

  return heatmap;
};

export const calculateLiquidationDelta = (data: LiquidationData[]): number[] => {
  const sorted = [...data].sort((a, b) => a.timestamp - b.timestamp);
  return sorted.map((d) => d.longLiquidations - d.shortLiquidations);
};

export const calculateCumulativeLiquidationDelta = (data: LiquidationData[]): number[] => {
  const delta = calculateLiquidationDelta(data);
  const cumulative: number[] = [];
  let sum = 0;

  for (const d of delta) {
    sum += d;
    cumulative.push(sum);
  }

  return cumulative;
};
