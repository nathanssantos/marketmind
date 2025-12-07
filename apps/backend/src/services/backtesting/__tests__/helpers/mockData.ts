import type { Kline } from '@marketmind/types';

/**
 * Generate mock klines for testing
 */
export function generateMockKlines(
  count: number,
  basePrice: number = 50000,
  interval: string = '1h'
): Kline[] {
  const klines: Kline[] = [];
  const intervalMs = getIntervalMs(interval);
  let currentTime = new Date('2024-01-01T00:00:00Z').getTime();

  for (let i = 0; i < count; i++) {
    // Simulate price movement (random walk with slight upward bias)
    const change = (Math.random() - 0.48) * basePrice * 0.02; // -2% to +2% with slight upward bias
    const open = basePrice;
    const close = basePrice + change;
    const high = Math.max(open, close) * (1 + Math.random() * 0.01); // Up to 1% above
    const low = Math.min(open, close) * (1 - Math.random() * 0.01); // Up to 1% below
    const volume = 100 + Math.random() * 1000;

    klines.push({
      openTime: currentTime,
      closeTime: currentTime + intervalMs - 1,
      open,
      high,
      low,
      close,
      volume,
      symbol: 'BTCUSDT',
      interval: interval as any,
    });

    basePrice = close; // Next candle starts at previous close
    currentTime += intervalMs;
  }

  return klines;
}

/**
 * Generate trending klines (uptrend or downtrend)
 */
export function generateTrendingKlines(
  count: number,
  basePrice: number = 50000,
  trendDirection: 'up' | 'down' = 'up',
  trendStrength: number = 0.001, // 0.1% per candle
  interval: string = '1h'
): Kline[] {
  const klines: Kline[] = [];
  const intervalMs = getIntervalMs(interval);
  let currentTime = new Date('2024-01-01T00:00:00Z').getTime();

  for (let i = 0; i < count; i++) {
    // Add trend + noise
    const trend = trendDirection === 'up' ? trendStrength : -trendStrength;
    const noise = (Math.random() - 0.5) * basePrice * 0.01; // +/- 1% noise
    const change = basePrice * trend + noise;

    const open = basePrice;
    const close = basePrice + change;
    const high = Math.max(open, close) * (1 + Math.random() * 0.005);
    const low = Math.min(open, close) * (1 - Math.random() * 0.005);
    const volume = 100 + Math.random() * 1000;

    klines.push({
      openTime: currentTime,
      closeTime: currentTime + intervalMs - 1,
      open,
      high,
      low,
      close,
      volume,
      symbol: 'BTCUSDT',
      interval: interval as any,
    });

    basePrice = close;
    currentTime += intervalMs;
  }

  return klines;
}

/**
 * Generate ranging (sideways) klines
 */
export function generateRangingKlines(
  count: number,
  basePrice: number = 50000,
  rangePercent: number = 0.05, // 5% range
  interval: string = '1h'
): Kline[] {
  const klines: Kline[] = [];
  const intervalMs = getIntervalMs(interval);
  let currentTime = new Date('2024-01-01T00:00:00Z').getTime();

  const rangeTop = basePrice * (1 + rangePercent / 2);
  const rangeBottom = basePrice * (1 - rangePercent / 2);

  for (let i = 0; i < count; i++) {
    // Price oscillates within range
    const progress = (i % 20) / 20; // Cycle every 20 candles
    const targetPrice = rangeBottom + (rangeTop - rangeBottom) * Math.sin(progress * Math.PI * 2);
    const noise = (Math.random() - 0.5) * basePrice * 0.01;

    const open = basePrice;
    const close = targetPrice + noise;
    const high = Math.max(open, close) * (1 + Math.random() * 0.005);
    const low = Math.min(open, close) * (1 - Math.random() * 0.005);
    const volume = 100 + Math.random() * 1000;

    klines.push({
      openTime: currentTime,
      closeTime: currentTime + intervalMs - 1,
      open,
      high,
      low,
      close,
      volume,
      symbol: 'BTCUSDT',
      interval: interval as any,
    });

    basePrice = close;
    currentTime += intervalMs;
  }

  return klines;
}

/**
 * Convert interval string to milliseconds
 */
function getIntervalMs(interval: string): number {
  const value = parseInt(interval);
  const unit = interval.replace(/[0-9]/g, '');

  const multipliers: Record<string, number> = {
    'm': 60 * 1000,
    'h': 60 * 60 * 1000,
    'd': 24 * 60 * 60 * 1000,
    'w': 7 * 24 * 60 * 60 * 1000,
  };

  return value * (multipliers[unit] || multipliers['h']);
}

/**
 * Create a mock backtest config
 */
export function createMockBacktestConfig(overrides?: any) {
  return {
    symbol: 'BTCUSDT',
    interval: '1h',
    startDate: '2024-01-01',
    endDate: '2024-01-31',
    initialCapital: 1000,
    setupTypes: ['setup91'],
    maxPositionSize: 10,
    commission: 0.001,
    useAlgorithmicLevels: false,
    onlyWithTrend: false,
    stopLossPercent: 2,
    takeProfitPercent: 6,
    minConfidence: 50,
    ...overrides,
  };
}
