export interface FloorPivotLevels {
  pivot: number;
  r1: number;
  r2: number;
  r3: number;
  s1: number;
  s2: number;
  s3: number;
}

export type FloorPivotType = 'standard' | 'fibonacci' | 'woodie' | 'camarilla' | 'demark';

export interface FloorPivotInput {
  high: number;
  low: number;
  close: number;
  open?: number;
}

export const calculateStandardPivots = (input: FloorPivotInput): FloorPivotLevels => {
  const { high, low, close } = input;
  const pivot = (high + low + close) / 3;
  const range = high - low;

  return {
    pivot,
    r1: 2 * pivot - low,
    r2: pivot + range,
    r3: high + 2 * (pivot - low),
    s1: 2 * pivot - high,
    s2: pivot - range,
    s3: low - 2 * (high - pivot),
  };
};

export const calculateFibonacciPivots = (input: FloorPivotInput): FloorPivotLevels => {
  const { high, low, close } = input;
  const pivot = (high + low + close) / 3;
  const range = high - low;

  return {
    pivot,
    r1: pivot + 0.382 * range,
    r2: pivot + 0.618 * range,
    r3: pivot + range,
    s1: pivot - 0.382 * range,
    s2: pivot - 0.618 * range,
    s3: pivot - range,
  };
};

export const calculateWoodiePivots = (input: FloorPivotInput): FloorPivotLevels => {
  const { high, low, close } = input;
  const pivot = (high + low + 2 * close) / 4;
  const range = high - low;

  return {
    pivot,
    r1: 2 * pivot - low,
    r2: pivot + range,
    r3: high + 2 * (pivot - low),
    s1: 2 * pivot - high,
    s2: pivot - range,
    s3: low - 2 * (high - pivot),
  };
};

export const calculateCamarillaPivots = (input: FloorPivotInput): FloorPivotLevels => {
  const { high, low, close } = input;
  const pivot = (high + low + close) / 3;
  const range = high - low;

  return {
    pivot,
    r1: close + range * 1.1 / 12,
    r2: close + range * 1.1 / 6,
    r3: close + range * 1.1 / 4,
    s1: close - range * 1.1 / 12,
    s2: close - range * 1.1 / 6,
    s3: close - range * 1.1 / 4,
  };
};

export const calculateDemarkPivots = (input: FloorPivotInput): FloorPivotLevels => {
  const { high, low, close, open = close } = input;

  let x: number;
  if (close < open) {
    x = high + 2 * low + close;
  } else if (close > open) {
    x = 2 * high + low + close;
  } else {
    x = high + low + 2 * close;
  }

  const pivot = x / 4;

  return {
    pivot,
    r1: x / 2 - low,
    r2: x / 2 - low + (high - low) * 0.5,
    r3: x / 2 - low + (high - low),
    s1: x / 2 - high,
    s2: x / 2 - high - (high - low) * 0.5,
    s3: x / 2 - high - (high - low),
  };
};

export const calculateFloorPivots = (
  input: FloorPivotInput,
  type: FloorPivotType = 'standard'
): FloorPivotLevels => {
  switch (type) {
    case 'fibonacci':
      return calculateFibonacciPivots(input);
    case 'woodie':
      return calculateWoodiePivots(input);
    case 'camarilla':
      return calculateCamarillaPivots(input);
    case 'demark':
      return calculateDemarkPivots(input);
    case 'standard':
    default:
      return calculateStandardPivots(input);
  }
};

export interface FloorPivotSeriesResult {
  pivot: (number | null)[];
  r1: (number | null)[];
  r2: (number | null)[];
  r3: (number | null)[];
  s1: (number | null)[];
  s2: (number | null)[];
  s3: (number | null)[];
}

export const calculateFloorPivotSeries = (
  highs: number[],
  lows: number[],
  closes: number[],
  opens?: number[],
  type: FloorPivotType = 'standard'
): FloorPivotSeriesResult => {
  const len = closes.length;
  const result: FloorPivotSeriesResult = {
    pivot: [],
    r1: [],
    r2: [],
    r3: [],
    s1: [],
    s2: [],
    s3: [],
  };

  if (len === 0) {
    return result;
  }

  result.pivot.push(null);
  result.r1.push(null);
  result.r2.push(null);
  result.r3.push(null);
  result.s1.push(null);
  result.s2.push(null);
  result.s3.push(null);

  for (let i = 1; i < len; i++) {
    const prevHigh = highs[i - 1];
    const prevLow = lows[i - 1];
    const prevClose = closes[i - 1];
    const prevOpen = opens ? opens[i - 1] : undefined;

    if (prevHigh === undefined || prevLow === undefined || prevClose === undefined) {
      result.pivot.push(null);
      result.r1.push(null);
      result.r2.push(null);
      result.r3.push(null);
      result.s1.push(null);
      result.s2.push(null);
      result.s3.push(null);
      continue;
    }

    const levels = calculateFloorPivots(
      { high: prevHigh, low: prevLow, close: prevClose, open: prevOpen },
      type
    );

    result.pivot.push(levels.pivot);
    result.r1.push(levels.r1);
    result.r2.push(levels.r2);
    result.r3.push(levels.r3);
    result.s1.push(levels.s1);
    result.s2.push(levels.s2);
    result.s3.push(levels.s3);
  }

  return result;
};
