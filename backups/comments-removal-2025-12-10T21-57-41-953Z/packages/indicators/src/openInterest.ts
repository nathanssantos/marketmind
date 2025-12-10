export interface OpenInterestData {
  timestamp: number;
  value: number;
  symbol?: string;
}

export interface OpenInterestResult {
  current: number | null;
  change: number | null;
  changePercent: number | null;
  trend: 'increasing' | 'decreasing' | 'stable';
  divergence: 'bullish' | 'bearish' | 'none';
}

export interface OpenInterestConfig {
  lookback: number;
  changeThreshold: number;
  trendPeriod: number;
}

const DEFAULT_CONFIG: OpenInterestConfig = {
  lookback: 10,
  changeThreshold: 5,
  trendPeriod: 5,
};

export const calculateOpenInterest = (
  data: OpenInterestData[],
  priceChanges?: number[],
  config: Partial<OpenInterestConfig> = {}
): OpenInterestResult => {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  if (data.length === 0) {
    return {
      current: null,
      change: null,
      changePercent: null,
      trend: 'stable',
      divergence: 'none',
    };
  }

  const sorted = [...data].sort((a, b) => b.timestamp - a.timestamp);
  const current = sorted[0]!.value;

  let change: number | null = null;
  let changePercent: number | null = null;

  if (sorted.length > cfg.lookback) {
    const previous = sorted[cfg.lookback]!.value;
    change = current - previous;
    changePercent = previous !== 0 ? (change / previous) * 100 : 0;
  }

  let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
  if (sorted.length >= cfg.trendPeriod) {
    const recentValues = sorted.slice(0, cfg.trendPeriod).map((d) => d.value);
    const oldestRecent = recentValues[recentValues.length - 1]!;
    const newestRecent = recentValues[0]!;
    const trendChange = ((newestRecent - oldestRecent) / oldestRecent) * 100;

    if (trendChange > cfg.changeThreshold / 2) {
      trend = 'increasing';
    } else if (trendChange < -cfg.changeThreshold / 2) {
      trend = 'decreasing';
    }
  }

  let divergence: 'bullish' | 'bearish' | 'none' = 'none';
  if (priceChanges && priceChanges.length > 0 && changePercent !== null) {
    const recentPriceChange = priceChanges[priceChanges.length - 1];

    if (recentPriceChange !== undefined) {
      if (changePercent > cfg.changeThreshold && recentPriceChange < 0) {
        divergence = 'bullish';
      } else if (changePercent < -cfg.changeThreshold && recentPriceChange > 0) {
        divergence = 'bearish';
      }
    }
  }

  return {
    current,
    change,
    changePercent,
    trend,
    divergence,
  };
};

export const calculateOpenInterestSeries = (data: OpenInterestData[]): number[] => {
  const sorted = [...data].sort((a, b) => a.timestamp - b.timestamp);
  return sorted.map((d) => d.value);
};

export const calculateOpenInterestChange = (
  data: OpenInterestData[],
  period: number = 1
): (number | null)[] => {
  const sorted = [...data].sort((a, b) => a.timestamp - b.timestamp);
  const values = sorted.map((d) => d.value);
  const result: (number | null)[] = [];

  for (let i = 0; i < values.length; i++) {
    if (i < period) {
      result.push(null);
      continue;
    }

    const current = values[i]!;
    const previous = values[i - period]!;
    const changePercent = previous !== 0 ? ((current - previous) / previous) * 100 : 0;
    result.push(changePercent);
  }

  return result;
};

export const detectOIDivergence = (
  oiData: OpenInterestData[],
  closes: number[],
  lookback: number = 10,
  threshold: number = 5
): { divergence: 'bullish' | 'bearish' | 'none'; strength: number } => {
  if (oiData.length < lookback || closes.length < lookback) {
    return { divergence: 'none', strength: 0 };
  }

  const sortedOI = [...oiData].sort((a, b) => b.timestamp - a.timestamp);
  const currentOI = sortedOI[0]!.value;
  const previousOI = sortedOI[Math.min(lookback - 1, sortedOI.length - 1)]!.value;
  const oiChange = previousOI !== 0 ? ((currentOI - previousOI) / previousOI) * 100 : 0;

  const currentPrice = closes[closes.length - 1]!;
  const previousPrice = closes[closes.length - lookback] ?? closes[0]!;
  const priceChange = previousPrice !== 0 ? ((currentPrice - previousPrice) / previousPrice) * 100 : 0;

  if (oiChange > threshold && priceChange < -threshold / 2) {
    const strength = Math.min(100, Math.abs(oiChange) + Math.abs(priceChange));
    return { divergence: 'bullish', strength };
  }

  if (oiChange < -threshold && priceChange > threshold / 2) {
    const strength = Math.min(100, Math.abs(oiChange) + Math.abs(priceChange));
    return { divergence: 'bearish', strength };
  }

  return { divergence: 'none', strength: 0 };
};

export const calculateOIRatio = (
  longOI: number,
  shortOI: number
): { ratio: number; sentiment: 'bullish' | 'bearish' | 'neutral' } => {
  if (shortOI === 0) {
    return { ratio: longOI > 0 ? Infinity : 1, sentiment: 'bullish' };
  }

  const ratio = longOI / shortOI;

  let sentiment: 'bullish' | 'bearish' | 'neutral' = 'neutral';
  if (ratio > 1.2) {
    sentiment = 'bullish';
  } else if (ratio < 0.8) {
    sentiment = 'bearish';
  }

  return { ratio, sentiment };
};
