import type { IndicatorParamValue } from './types';

export interface IndicatorSeed {
  catalogType: string;
  label: string;
  params: Record<string, IndicatorParamValue>;
}

export const DEFAULT_USER_INDICATOR_SEEDS: IndicatorSeed[] = [
  { catalogType: 'ema', label: 'EMA 9', params: { period: 9, color: '#ff00ff', lineWidth: 1 } },
  { catalogType: 'ema', label: 'EMA 21', params: { period: 21, color: '#00e676', lineWidth: 1 } },
  { catalogType: 'ema', label: 'EMA 50', params: { period: 50, color: '#607d8b', lineWidth: 1 } },
  { catalogType: 'ema', label: 'EMA 100', params: { period: 100, color: '#607d8b', lineWidth: 2 } },
  { catalogType: 'ema', label: 'EMA 200', params: { period: 200, color: '#607d8b', lineWidth: 3 } },
  { catalogType: 'rsi', label: 'RSI 14', params: { period: 14, color: '#8b5cf6', lineWidth: 1 } },
  { catalogType: 'macd', label: 'MACD', params: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9, color: '#2196f3', lineWidth: 1 } },
  { catalogType: 'bollingerBands', label: 'BB 20 / 2σ', params: { period: 20, stdDev: 2, color: '#9c27b0', lineWidth: 1 } },
  { catalogType: 'atr', label: 'ATR 14', params: { period: 14, color: '#ff5722', lineWidth: 1 } },
  { catalogType: 'stoch', label: 'Stoch 14', params: { period: 14, smoothK: 3, smoothD: 3, color: '#00e676', lineWidth: 1 } },
  { catalogType: 'volume', label: 'Volume', params: { color: '#607d8b' } },
  { catalogType: 'vwap', label: 'VWAP', params: { color: '#ffc107', lineWidth: 1 } },
];

export const DEFAULT_ACTIVE_SEED_LABELS = new Set([
  'EMA 9',
  'EMA 21',
  'EMA 200',
  'RSI 14',
  'Volume',
]);
