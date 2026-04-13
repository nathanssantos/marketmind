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
