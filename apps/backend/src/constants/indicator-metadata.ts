import type { IndicatorMeta } from '@marketmind/types';

export const INDICATOR_CATALOG: IndicatorMeta[] = [
  { id: 'RSI', name: 'RSI', category: 'oscillator', defaultParams: { period: 14 }, paramLabels: { period: 'Period' }, valueRange: { min: 0, max: 100 }, requiresKlines: true },
  { id: 'ADX', name: 'ADX', category: 'trend', defaultParams: { period: 14 }, paramLabels: { period: 'Period' }, valueRange: { min: 0, max: 100 }, requiresKlines: true },
  { id: 'EMA', name: 'EMA', category: 'trend', defaultParams: { period: 21 }, paramLabels: { period: 'Period' }, requiresKlines: true },
  { id: 'SMA', name: 'SMA', category: 'trend', defaultParams: { period: 20 }, paramLabels: { period: 'Period' }, requiresKlines: true },
  { id: 'MACD_HISTOGRAM', name: 'MACD Histogram', category: 'momentum', defaultParams: {}, requiresKlines: true },
  { id: 'MACD_SIGNAL', name: 'MACD Signal', category: 'momentum', defaultParams: {}, requiresKlines: true },
  { id: 'BOLLINGER_WIDTH', name: 'Bollinger Width', category: 'volatility', defaultParams: { period: 20, stdDev: 2 }, paramLabels: { period: 'Period', stdDev: 'Std Dev' }, valueRange: { min: 0, max: 1 }, requiresKlines: true },
  { id: 'BOLLINGER_UPPER', name: 'Bollinger Upper', category: 'volatility', defaultParams: { period: 20, stdDev: 2 }, paramLabels: { period: 'Period', stdDev: 'Std Dev' }, requiresKlines: true },
  { id: 'BOLLINGER_LOWER', name: 'Bollinger Lower', category: 'volatility', defaultParams: { period: 20, stdDev: 2 }, paramLabels: { period: 'Period', stdDev: 'Std Dev' }, requiresKlines: true },
  { id: 'ATR', name: 'ATR', category: 'volatility', defaultParams: { period: 14 }, paramLabels: { period: 'Period' }, requiresKlines: true },
  { id: 'ATR_PERCENT', name: 'ATR %', category: 'volatility', defaultParams: { period: 14 }, paramLabels: { period: 'Period' }, valueRange: { min: 0, max: 100 }, requiresKlines: true },
  { id: 'STOCHASTIC_K', name: 'Stochastic %K', category: 'oscillator', defaultParams: { period: 14, kSmoothing: 3, dPeriod: 3 }, paramLabels: { period: 'K Period', kSmoothing: 'K Smoothing', dPeriod: 'D Period' }, valueRange: { min: 0, max: 100 }, requiresKlines: true },
  { id: 'STOCHASTIC_D', name: 'Stochastic %D', category: 'oscillator', defaultParams: { period: 14, kSmoothing: 3, dPeriod: 3 }, paramLabels: { period: 'K Period', kSmoothing: 'K Smoothing', dPeriod: 'D Period' }, valueRange: { min: 0, max: 100 }, requiresKlines: true },
  { id: 'CCI', name: 'CCI', category: 'oscillator', defaultParams: { period: 20 }, paramLabels: { period: 'Period' }, requiresKlines: true },
  { id: 'MFI', name: 'MFI', category: 'volume', defaultParams: { period: 14 }, paramLabels: { period: 'Period' }, valueRange: { min: 0, max: 100 }, requiresKlines: true },
  { id: 'CMF', name: 'CMF', category: 'volume', defaultParams: { period: 20 }, paramLabels: { period: 'Period' }, valueRange: { min: -1, max: 1 }, requiresKlines: true },
  { id: 'OBV', name: 'OBV', category: 'volume', defaultParams: {}, requiresKlines: true },
  { id: 'VWAP', name: 'VWAP', category: 'volume', defaultParams: {}, requiresKlines: true },
  { id: 'ROC', name: 'ROC', category: 'momentum', defaultParams: { period: 12 }, paramLabels: { period: 'Period' }, requiresKlines: true },
  { id: 'WILLIAMS_R', name: 'Williams %R', category: 'oscillator', defaultParams: { period: 14 }, paramLabels: { period: 'Period' }, valueRange: { min: -100, max: 0 }, requiresKlines: true },
  { id: 'CHOPPINESS', name: 'Choppiness', category: 'volatility', defaultParams: { period: 14 }, paramLabels: { period: 'Period' }, valueRange: { min: 0, max: 100 }, requiresKlines: true },
  { id: 'TSI', name: 'TSI', category: 'momentum', defaultParams: {}, valueRange: { min: -100, max: 100 }, requiresKlines: true },
  { id: 'SUPERTREND', name: 'Supertrend', category: 'trend', defaultParams: { period: 10, multiplier: 3 }, paramLabels: { period: 'Period', multiplier: 'Multiplier' }, requiresKlines: true },
  { id: 'PRICE_CLOSE', name: 'Price (Close)', category: 'price', defaultParams: {}, requiresKlines: true },
  { id: 'PRICE_CHANGE_24H', name: 'Price Change 24h', category: 'price', defaultParams: {}, requiresKlines: false },
  { id: 'PRICE_CHANGE_PERCENT_24H', name: 'Price Change % 24h', category: 'price', defaultParams: {}, requiresKlines: false },
  { id: 'VOLUME_24H', name: 'Volume 24h', category: 'market_data', defaultParams: {}, requiresKlines: false },
  { id: 'VOLUME_RATIO', name: 'Volume Ratio', category: 'volume', defaultParams: { period: 20 }, paramLabels: { period: 'Period' }, requiresKlines: true },
  { id: 'MARKET_CAP_RANK', name: 'Market Cap Rank', category: 'market_data', defaultParams: {}, requiresKlines: false },
  { id: 'BTC_CORRELATION', name: 'BTC Correlation', category: 'crypto', defaultParams: { period: 30 }, paramLabels: { period: 'Period' }, valueRange: { min: -1, max: 1 }, requiresKlines: true, assetClassRestriction: 'CRYPTO' },
  { id: 'FUNDING_RATE', name: 'Funding Rate', category: 'crypto', defaultParams: {}, requiresKlines: false, assetClassRestriction: 'CRYPTO' },
];

const catalogMap = new Map(INDICATOR_CATALOG.map((m) => [m.id, m]));

export const getIndicatorMeta = (id: string): IndicatorMeta | undefined =>
  catalogMap.get(id as IndicatorMeta['id']);

export const getIndicatorCatalog = (assetClass?: 'CRYPTO' | 'STOCKS'): IndicatorMeta[] => {
  if (!assetClass) return INDICATOR_CATALOG;
  return INDICATOR_CATALOG.filter(
    (m) => !m.assetClassRestriction || m.assetClassRestriction === assetClass,
  );
};

export const isKlineRequired = (id: string): boolean => {
  const meta = getIndicatorMeta(id);
  return meta?.requiresKlines ?? true;
};
