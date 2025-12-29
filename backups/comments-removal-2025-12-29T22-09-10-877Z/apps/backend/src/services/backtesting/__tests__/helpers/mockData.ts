import type { Kline } from '@marketmind/types';

function createKline(
  currentTime: number,
  intervalMs: number,
  open: number,
  high: number,
  low: number,
  close: number,
  volume: number
): Kline {
  return {
    openTime: currentTime,
    closeTime: currentTime + intervalMs - 1,
    open: open.toString(),
    high: high.toString(),
    low: low.toString(),
    close: close.toString(),
    volume: volume.toString(),
    quoteVolume: (volume * close).toString(),
    trades: Math.floor(Math.random() * 1000),
    takerBuyBaseVolume: (volume * 0.5).toString(),
    takerBuyQuoteVolume: (volume * close * 0.5).toString(),
  };
}

export function generateMockKlines(
  count: number,
  basePrice: number = 50000,
  interval: string = '1h'
): Kline[] {
  const klines: Kline[] = [];
  const intervalMs = getIntervalMs(interval);
  let currentTime = new Date('2024-01-01T00:00:00Z').getTime();

  for (let i = 0; i < count; i++) {
    const change = (Math.random() - 0.48) * basePrice * 0.02;
    const open = basePrice;
    const close = basePrice + change;
    const high = Math.max(open, close) * (1 + Math.random() * 0.01);
    const low = Math.min(open, close) * (1 - Math.random() * 0.01);
    const volume = 100 + Math.random() * 1000;

    klines.push(createKline(currentTime, intervalMs, open, high, low, close, volume));

    basePrice = close;
    currentTime += intervalMs;
  }

  return klines;
}

export function generateTrendingKlines(
  count: number,
  basePrice: number = 50000,
  trendDirection: 'up' | 'down' = 'up',
  trendStrength: number = 0.001,
  interval: string = '1h'
): Kline[] {
  const klines: Kline[] = [];
  const intervalMs = getIntervalMs(interval);
  let currentTime = new Date('2024-01-01T00:00:00Z').getTime();

  for (let i = 0; i < count; i++) {
    const trend = trendDirection === 'up' ? trendStrength : -trendStrength;
    const noise = (Math.random() - 0.5) * basePrice * 0.01;
    const change = basePrice * trend + noise;

    const open = basePrice;
    const close = basePrice + change;
    const high = Math.max(open, close) * (1 + Math.random() * 0.005);
    const low = Math.min(open, close) * (1 - Math.random() * 0.005);
    const volume = 100 + Math.random() * 1000;

    klines.push(createKline(currentTime, intervalMs, open, high, low, close, volume));

    basePrice = close;
    currentTime += intervalMs;
  }

  return klines;
}

export function generateRangingKlines(
  count: number,
  basePrice: number = 50000,
  rangePercent: number = 0.05,
  interval: string = '1h'
): Kline[] {
  const klines: Kline[] = [];
  const intervalMs = getIntervalMs(interval);
  let currentTime = new Date('2024-01-01T00:00:00Z').getTime();

  const rangeTop = basePrice * (1 + rangePercent / 2);
  const rangeBottom = basePrice * (1 - rangePercent / 2);

  for (let i = 0; i < count; i++) {
    const progress = (i % 20) / 20;
    const targetPrice = rangeBottom + (rangeTop - rangeBottom) * Math.sin(progress * Math.PI * 2);
    const noise = (Math.random() - 0.5) * basePrice * 0.01;

    const open = basePrice;
    const close = targetPrice + noise;
    const high = Math.max(open, close) * (1 + Math.random() * 0.005);
    const low = Math.min(open, close) * (1 - Math.random() * 0.005);
    const volume = 100 + Math.random() * 1000;

    klines.push(createKline(currentTime, intervalMs, open, high, low, close, volume));

    basePrice = close;
    currentTime += intervalMs;
  }

  return klines;
}

function getIntervalMs(interval: string): number {
  const value = parseInt(interval);
  const unit = interval.replace(/[0-9]/g, '');

  const multipliers: Record<string, number> = {
    'm': 60 * 1000,
    'h': 60 * 60 * 1000,
    'd': 24 * 60 * 60 * 1000,
    'w': 7 * 24 * 60 * 60 * 1000,
  };

  return value * (multipliers[unit] ?? multipliers['h'] ?? 3600000);
}

export function createMockBacktestConfig(overrides?: Record<string, unknown>) {
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
