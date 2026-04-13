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
