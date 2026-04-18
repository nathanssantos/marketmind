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
  { catalogType: 'rsi', label: 'RSI 14', params: { period: 14, color: '#2196f3', lineWidth: 1 } },
  { catalogType: 'macd', label: 'MACD', params: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9, color: '#2962ff', lineWidth: 1 } },
  { catalogType: 'bollingerBands', label: 'BB 20 / 2σ', params: { period: 20, stdDev: 2, color: '#9c27b0', lineWidth: 1 } },
  { catalogType: 'atr', label: 'ATR 14', params: { period: 14, color: '#ff9800', lineWidth: 1 } },
  { catalogType: 'adx', label: 'ADX 14', params: { period: 14, color: '#7c4dff', lineWidth: 1 } },
  { catalogType: 'choppinessIndex', label: 'CHOP 14', params: { period: 14, color: '#9e9e9e', lineWidth: 1 } },
  { catalogType: 'stoch', label: 'Stoch 14', params: { period: 14, smoothK: 3, smoothD: 3, color: '#2196f3', lineWidth: 1 } },
  { catalogType: 'volume', label: 'Volume', params: { color: '#607d8b' } },
  { catalogType: 'vwap', label: 'VWAP', params: { color: '#ffc107', lineWidth: 1 } },
  { catalogType: 'aroon', label: 'Aroon 25', params: { period: 25, color: '#26a69a', lineWidth: 1 } },
  { catalogType: 'vortex', label: 'Vortex 14', params: { period: 14, color: '#26a69a', lineWidth: 1 } },
  { catalogType: 'ichimoku', label: 'Ichimoku 9/26/52', params: { tenkanPeriod: 9, kijunPeriod: 26, senkouPeriod: 52, tenkanColor: '#2962ff', kijunColor: '#b71c1c', chikouColor: '#7c4dff', lineWidth: 1 } },
  { catalogType: 'pivotPoints', label: 'Pivot Points', params: { lookback: 5, lookahead: 2, highColor: '#ef4444', lowColor: '#22c55e' } },
  { catalogType: 'volumeProfile', label: 'Volume Profile', params: { numBuckets: 100, maxBarWidth: 120, opacity: 30 } },
  { catalogType: 'dailyVwap', label: 'Daily VWAP', params: { color: '#03a9f4', lineWidth: 1 } },
  { catalogType: 'weeklyVwap', label: 'Weekly VWAP', params: { color: '#7c4dff', lineWidth: 1 } },
  { catalogType: 'orb', label: 'ORB 15m', params: { orbPeriodMinutes: 15 } },
  { catalogType: 'sessionBoundaries', label: 'Session Boundaries', params: {} },
  { catalogType: 'footprint', label: 'Footprint', params: {} },
  { catalogType: 'liquidityHeatmap', label: 'Liquidity Heatmap', params: {} },
  { catalogType: 'liquidationMarkers', label: 'Liquidation Markers', params: {} },
];

export const DEFAULT_ACTIVE_SEED_LABELS = new Set([
  'EMA 9',
  'EMA 21',
  'EMA 200',
  'RSI 14',
  'Volume',
  'Volume Profile',
]);
