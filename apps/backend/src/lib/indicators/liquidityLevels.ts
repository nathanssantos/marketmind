export interface LiquidityLevel {
  price: number;
  type: 'support' | 'resistance';
  strength: number;
  touches: number;
  firstIndex: number;
  lastIndex: number;
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
