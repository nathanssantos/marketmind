export interface LiquidityLevel {
  price: number;
  type: 'support' | 'resistance';
  strength: number;
  touches: number;
  firstIndex: number;
  lastIndex: number;
}

export interface LiquidityZone {
  high: number;
  low: number;
  type: 'support' | 'resistance';
  strength: number;
  touches: number;
}

export interface LiquidityLevelsConfig {
  lookback: number;
  tolerance: number;
  minTouches: number;
  strengthDecay: number;
}

const DEFAULT_CONFIG: LiquidityLevelsConfig = {
  lookback: 50,
  tolerance: 0.002,
  minTouches: 2,
  strengthDecay: 0.95,
};

const isNearLevel = (price: number, level: number, tolerance: number): boolean => {
  const diff = Math.abs(price - level) / level;
  return diff <= tolerance;
};

export const findSwingHighs = (
  highs: number[],
  left: number = 2,
  right: number = 2
): { price: number; index: number }[] => {
  const swings: { price: number; index: number }[] = [];

  for (let i = left; i < highs.length - right; i++) {
    const current = highs[i];
    if (current === undefined) continue;

    let isSwing = true;

    for (let j = i - left; j < i; j++) {
      const h = highs[j];
      if (h !== undefined && h >= current) {
        isSwing = false;
        break;
      }
    }

    if (!isSwing) continue;

    for (let j = i + 1; j <= i + right; j++) {
      const h = highs[j];
      if (h !== undefined && h >= current) {
        isSwing = false;
        break;
      }
    }

    if (isSwing) {
      swings.push({ price: current, index: i });
    }
  }

  return swings;
};

export const findSwingLows = (
  lows: number[],
  left: number = 2,
  right: number = 2
): { price: number; index: number }[] => {
  const swings: { price: number; index: number }[] = [];

  for (let i = left; i < lows.length - right; i++) {
    const current = lows[i];
    if (current === undefined) continue;

    let isSwing = true;

    for (let j = i - left; j < i; j++) {
      const l = lows[j];
      if (l !== undefined && l <= current) {
        isSwing = false;
        break;
      }
    }

    if (!isSwing) continue;

    for (let j = i + 1; j <= i + right; j++) {
      const l = lows[j];
      if (l !== undefined && l <= current) {
        isSwing = false;
        break;
      }
    }

    if (isSwing) {
      swings.push({ price: current, index: i });
    }
  }

  return swings;
};

export const calculateLiquidityLevels = (
  highs: number[],
  lows: number[],
  closes: number[],
  config: Partial<LiquidityLevelsConfig> = {}
): LiquidityLevel[] => {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const len = Math.min(highs.length, lows.length, closes.length);

  if (len < cfg.lookback) {
    return [];
  }

  const startIdx = Math.max(0, len - cfg.lookback);
  const recentHighs = highs.slice(startIdx, len);
  const recentLows = lows.slice(startIdx, len);

  const swingHighs = findSwingHighs(recentHighs);
  const swingLows = findSwingLows(recentLows);

  const levels: LiquidityLevel[] = [];

  for (const swing of swingHighs) {
    let touches = 1;
    let lastTouch = swing.index;

    for (let i = swing.index + 1; i < recentHighs.length; i++) {
      const high = recentHighs[i];
      if (high !== undefined && isNearLevel(high, swing.price, cfg.tolerance)) {
        touches++;
        lastTouch = i;
      }
    }

    if (touches >= cfg.minTouches) {
      const age = recentHighs.length - 1 - lastTouch;
      const strength = Math.round(touches * 25 * Math.pow(cfg.strengthDecay, age));

      levels.push({
        price: swing.price,
        type: 'resistance',
        strength: Math.min(100, strength),
        touches,
        firstIndex: startIdx + swing.index,
        lastIndex: startIdx + lastTouch,
      });
    }
  }

  for (const swing of swingLows) {
    let touches = 1;
    let lastTouch = swing.index;

    for (let i = swing.index + 1; i < recentLows.length; i++) {
      const low = recentLows[i];
      if (low !== undefined && isNearLevel(low, swing.price, cfg.tolerance)) {
        touches++;
        lastTouch = i;
      }
    }

    if (touches >= cfg.minTouches) {
      const age = recentLows.length - 1 - lastTouch;
      const strength = Math.round(touches * 25 * Math.pow(cfg.strengthDecay, age));

      levels.push({
        price: swing.price,
        type: 'support',
        strength: Math.min(100, strength),
        touches,
        firstIndex: startIdx + swing.index,
        lastIndex: startIdx + lastTouch,
      });
    }
  }

  return levels.sort((a, b) => b.strength - a.strength);
};

export const findNearestLiquidity = (
  currentPrice: number,
  levels: LiquidityLevel[]
): { support: LiquidityLevel | null; resistance: LiquidityLevel | null } => {
  let nearestSupport: LiquidityLevel | null = null;
  let nearestResistance: LiquidityLevel | null = null;
  let supportDist = Infinity;
  let resistanceDist = Infinity;

  for (const level of levels) {
    const dist = Math.abs(level.price - currentPrice);

    if (level.type === 'support' && level.price < currentPrice && dist < supportDist) {
      nearestSupport = level;
      supportDist = dist;
    }

    if (level.type === 'resistance' && level.price > currentPrice && dist < resistanceDist) {
      nearestResistance = level;
      resistanceDist = dist;
    }
  }

  return { support: nearestSupport, resistance: nearestResistance };
};

export const detectLiquiditySweep = (
  highs: number[],
  lows: number[],
  closes: number[],
  levels: LiquidityLevel[],
  currentIndex: number,
  sweepThreshold: number = 0.001
): { swept: boolean; level: LiquidityLevel | null; direction: 'bullish' | 'bearish' | null } => {
  if (currentIndex < 1) {
    return { swept: false, level: null, direction: null };
  }

  const currentHigh = highs[currentIndex];
  const currentLow = lows[currentIndex];
  const currentClose = closes[currentIndex];
  const prevClose = closes[currentIndex - 1];

  if (
    currentHigh === undefined ||
    currentLow === undefined ||
    currentClose === undefined ||
    prevClose === undefined
  ) {
    return { swept: false, level: null, direction: null };
  }

  for (const level of levels) {
    if (level.type === 'support') {
      const sweepPrice = level.price * (1 - sweepThreshold);
      if (currentLow < sweepPrice && currentClose > level.price && currentClose > prevClose) {
        return { swept: true, level, direction: 'bullish' };
      }
    }

    if (level.type === 'resistance') {
      const sweepPrice = level.price * (1 + sweepThreshold);
      if (currentHigh > sweepPrice && currentClose < level.price && currentClose < prevClose) {
        return { swept: true, level, direction: 'bearish' };
      }
    }
  }

  return { swept: false, level: null, direction: null };
};

export const clusterLiquidityZones = (
  levels: LiquidityLevel[],
  clusterTolerance: number = 0.005
): LiquidityZone[] => {
  if (levels.length === 0) return [];

  const sorted = [...levels].sort((a, b) => a.price - b.price);
  const zones: LiquidityZone[] = [];
  let currentZone: LiquidityLevel[] = [sorted[0]!];

  for (let i = 1; i < sorted.length; i++) {
    const level = sorted[i]!;
    const lastInZone = currentZone[currentZone.length - 1]!;

    if (Math.abs(level.price - lastInZone.price) / lastInZone.price <= clusterTolerance) {
      currentZone.push(level);
    } else {
      if (currentZone.length > 0) {
        const prices = currentZone.map((l) => l.price);
        const totalStrength = currentZone.reduce((sum, l) => sum + l.strength, 0);
        const totalTouches = currentZone.reduce((sum, l) => sum + l.touches, 0);
        const hasMoreResistance =
          currentZone.filter((l) => l.type === 'resistance').length >
          currentZone.filter((l) => l.type === 'support').length;

        zones.push({
          high: Math.max(...prices),
          low: Math.min(...prices),
          type: hasMoreResistance ? 'resistance' : 'support',
          strength: Math.min(100, Math.round(totalStrength / currentZone.length)),
          touches: totalTouches,
        });
      }
      currentZone = [level];
    }
  }

  if (currentZone.length > 0) {
    const prices = currentZone.map((l) => l.price);
    const totalStrength = currentZone.reduce((sum, l) => sum + l.strength, 0);
    const totalTouches = currentZone.reduce((sum, l) => sum + l.touches, 0);
    const hasMoreResistance =
      currentZone.filter((l) => l.type === 'resistance').length >
      currentZone.filter((l) => l.type === 'support').length;

    zones.push({
      high: Math.max(...prices),
      low: Math.min(...prices),
      type: hasMoreResistance ? 'resistance' : 'support',
      strength: Math.min(100, Math.round(totalStrength / currentZone.length)),
      touches: totalTouches,
    });
  }

  return zones.sort((a, b) => b.strength - a.strength);
};
