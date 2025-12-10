export interface BTCDominanceData {
  timestamp: number;
  dominance: number;
  totalMarketCap?: number;
  btcMarketCap?: number;
}

export interface BTCDominanceResult {
  current: number | null;
  change: number | null;
  change7d: number | null;
  change30d: number | null;
  trend: 'rising' | 'falling' | 'stable';
  altcoinSeason: boolean;
}

export interface BTCDominanceConfig {
  altcoinSeasonThreshold: number;
  trendPeriod: number;
  changeThreshold: number;
}

const DEFAULT_CONFIG: BTCDominanceConfig = {
  altcoinSeasonThreshold: 50,
  trendPeriod: 7,
  changeThreshold: 2,
};

export const calculateBTCDominance = (
  data: BTCDominanceData[],
  config: Partial<BTCDominanceConfig> = {}
): BTCDominanceResult => {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  if (data.length === 0) {
    return {
      current: null,
      change: null,
      change7d: null,
      change30d: null,
      trend: 'stable',
      altcoinSeason: false,
    };
  }

  const sorted = [...data].sort((a, b) => b.timestamp - a.timestamp);
  const current = sorted[0]!.dominance;

  let change: number | null = null;
  let change7d: number | null = null;
  let change30d: number | null = null;

  if (sorted.length > 1) {
    change = current - sorted[1]!.dominance;
  }

  if (sorted.length > 7) {
    change7d = current - sorted[7]!.dominance;
  }

  if (sorted.length > 30) {
    change30d = current - sorted[30]!.dominance;
  }

  let trend: 'rising' | 'falling' | 'stable' = 'stable';
  if (sorted.length >= cfg.trendPeriod) {
    const recentChange = current - sorted[cfg.trendPeriod - 1]!.dominance;
    if (recentChange > cfg.changeThreshold) {
      trend = 'rising';
    } else if (recentChange < -cfg.changeThreshold) {
      trend = 'falling';
    }
  }

  const altcoinSeason =
    current < cfg.altcoinSeasonThreshold && trend === 'falling' && (change30d ?? 0) < -5;

  return {
    current,
    change,
    change7d,
    change30d,
    trend,
    altcoinSeason,
  };
};

export const calculateBTCDominanceSeries = (data: BTCDominanceData[]): number[] => {
  const sorted = [...data].sort((a, b) => a.timestamp - b.timestamp);
  return sorted.map((d) => d.dominance);
};

export const calculateBTCDominanceMA = (
  data: BTCDominanceData[],
  period: number = 7
): (number | null)[] => {
  const sorted = [...data].sort((a, b) => a.timestamp - b.timestamp);
  const values = sorted.map((d) => d.dominance);
  const result: (number | null)[] = [];

  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      result.push(null);
      continue;
    }

    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += values[i - j]!;
    }
    result.push(sum / period);
  }

  return result;
};

export const detectAltcoinSeason = (
  dominanceData: BTCDominanceData[],
  config: Partial<BTCDominanceConfig> = {}
): { isAltcoinSeason: boolean; confidence: number; phase: 'early' | 'mid' | 'late' | 'none' } => {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const result = calculateBTCDominance(dominanceData, config);

  if (!result.altcoinSeason || result.current === null) {
    return { isAltcoinSeason: false, confidence: 0, phase: 'none' };
  }

  let confidence = 0;

  if (result.current < cfg.altcoinSeasonThreshold) {
    confidence += 30;
  }
  if (result.current < cfg.altcoinSeasonThreshold - 5) {
    confidence += 20;
  }

  if (result.change30d !== null && result.change30d < -5) {
    confidence += 25;
  }
  if (result.change30d !== null && result.change30d < -10) {
    confidence += 15;
  }

  if (result.trend === 'falling') {
    confidence += 10;
  }

  let phase: 'early' | 'mid' | 'late' | 'none' = 'none';
  if (result.current >= cfg.altcoinSeasonThreshold - 5 && result.trend === 'falling') {
    phase = 'early';
  } else if (
    result.current < cfg.altcoinSeasonThreshold - 5 &&
    result.current >= cfg.altcoinSeasonThreshold - 10
  ) {
    phase = 'mid';
  } else if (result.current < cfg.altcoinSeasonThreshold - 10) {
    phase = 'late';
  }

  return {
    isAltcoinSeason: confidence >= 50,
    confidence: Math.min(100, confidence),
    phase,
  };
};

export const calculateAltcoinMarketCap = (
  btcDominance: number,
  totalMarketCap: number
): number => {
  return totalMarketCap * (1 - btcDominance / 100);
};

export const calculateDominanceChange = (
  data: BTCDominanceData[],
  period: number = 1
): (number | null)[] => {
  const sorted = [...data].sort((a, b) => a.timestamp - b.timestamp);
  const values = sorted.map((d) => d.dominance);
  const result: (number | null)[] = [];

  for (let i = 0; i < values.length; i++) {
    if (i < period) {
      result.push(null);
      continue;
    }

    result.push(values[i]! - values[i - period]!);
  }

  return result;
};

export const calculateInverseDominance = (data: BTCDominanceData[]): number[] => {
  const sorted = [...data].sort((a, b) => a.timestamp - b.timestamp);
  return sorted.map((d) => 100 - d.dominance);
};
