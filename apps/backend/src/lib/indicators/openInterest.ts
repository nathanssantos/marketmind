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
