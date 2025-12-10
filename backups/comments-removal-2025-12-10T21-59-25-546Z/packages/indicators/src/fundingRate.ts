export interface FundingRateData {
  timestamp: number;
  rate: number;
  symbol?: string;
}

export interface FundingRateResult {
  current: number | null;
  average: number | null;
  cumulative: number | null;
  isExtreme: boolean;
  direction: 'positive' | 'negative' | 'neutral';
}

export interface FundingRateConfig {
  extremeThreshold: number;
  averagePeriod: number;
}

const DEFAULT_CONFIG: FundingRateConfig = {
  extremeThreshold: 0.1,
  averagePeriod: 7,
};

export const calculateFundingRate = (
  data: FundingRateData[],
  config: Partial<FundingRateConfig> = {}
): FundingRateResult => {
  const cfg = { ...DEFAULT_CONFIG, ...config };

  if (data.length === 0) {
    return {
      current: null,
      average: null,
      cumulative: null,
      isExtreme: false,
      direction: 'neutral',
    };
  }

  const sorted = [...data].sort((a, b) => b.timestamp - a.timestamp);
  const current = sorted[0]!.rate;

  const recentData = sorted.slice(0, cfg.averagePeriod * 3);
  const average =
    recentData.length > 0
      ? recentData.reduce((sum, d) => sum + d.rate, 0) / recentData.length
      : current;

  const cumulative = recentData.reduce((sum, d) => sum + d.rate, 0);

  const isExtreme = Math.abs(current) >= cfg.extremeThreshold;

  let direction: 'positive' | 'negative' | 'neutral' = 'neutral';
  if (current > 0.01) {
    direction = 'positive';
  } else if (current < -0.01) {
    direction = 'negative';
  }

  return {
    current,
    average,
    cumulative,
    isExtreme,
    direction,
  };
};

export const calculateFundingRateSeries = (
  data: FundingRateData[],
  _config: Partial<FundingRateConfig> = {}
): number[] => {
  const sorted = [...data].sort((a, b) => a.timestamp - b.timestamp);

  return sorted.map((d) => d.rate);
};

export const calculateFundingRateMA = (
  data: FundingRateData[],
  period: number = 7
): (number | null)[] => {
  const sorted = [...data].sort((a, b) => a.timestamp - b.timestamp);
  const rates = sorted.map((d) => d.rate);
  const result: (number | null)[] = [];

  const periodsPerDay = 3;
  const maPeriod = period * periodsPerDay;

  for (let i = 0; i < rates.length; i++) {
    if (i < maPeriod - 1) {
      result.push(null);
      continue;
    }

    let sum = 0;
    for (let j = 0; j < maPeriod; j++) {
      sum += rates[i - j]!;
    }
    result.push(sum / maPeriod);
  }

  return result;
};

export const detectFundingRateSignal = (
  data: FundingRateData[],
  config: Partial<FundingRateConfig> = {}
): { signal: 'long' | 'short' | 'none'; strength: number } => {
  const result = calculateFundingRate(data, config);

  if (result.current === null) {
    return { signal: 'none', strength: 0 };
  }

  const cfg = { ...DEFAULT_CONFIG, ...config };

  if (result.current <= -cfg.extremeThreshold) {
    const strength = Math.min(100, Math.abs(result.current / cfg.extremeThreshold) * 50);
    return { signal: 'long', strength };
  }

  if (result.current >= cfg.extremeThreshold) {
    const strength = Math.min(100, Math.abs(result.current / cfg.extremeThreshold) * 50);
    return { signal: 'short', strength };
  }

  return { signal: 'none', strength: 0 };
};

export const annualizeFundingRate = (rate: number, periodsPerDay: number = 3): number => {
  return rate * periodsPerDay * 365;
};

export const calculateFundingCost = (
  rate: number,
  positionSize: number,
  holdingPeriods: number = 1
): number => {
  return positionSize * rate * holdingPeriods;
};
