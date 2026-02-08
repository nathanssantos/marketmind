import type { ScreenerPreset } from '@marketmind/types';

export const SCREENER_PRESETS: ScreenerPreset[] = [
  {
    id: 'top-gainers',
    name: 'Top Gainers',
    description: 'Top gaining assets by 24h price change',
    icon: 'TrendingUp',
    category: 'momentum',
    config: {
      filters: [
        { id: 'tg-1', indicator: 'PRICE_CHANGE_PERCENT_24H', operator: 'ABOVE', value: 5 },
        { id: 'tg-2', indicator: 'MARKET_CAP_RANK', operator: 'BELOW', value: 100 },
      ],
      sortBy: 'priceChange24h',
      sortDirection: 'desc',
    },
  },
  {
    id: 'top-losers',
    name: 'Top Losers',
    description: 'Worst performing assets by 24h price change',
    icon: 'TrendingDown',
    category: 'momentum',
    config: {
      filters: [
        { id: 'tl-1', indicator: 'PRICE_CHANGE_PERCENT_24H', operator: 'BELOW', value: -5 },
        { id: 'tl-2', indicator: 'MARKET_CAP_RANK', operator: 'BELOW', value: 100 },
      ],
      sortBy: 'priceChange24h',
      sortDirection: 'asc',
    },
  },
  {
    id: 'btc-decorrelated',
    name: 'BTC Decorrelated',
    description: 'Assets with low Bitcoin correlation and positive momentum',
    icon: 'Unlink',
    category: 'market_data',
    assetClassRestriction: 'CRYPTO',
    config: {
      filters: [
        { id: 'bd-1', indicator: 'BTC_CORRELATION', operator: 'BELOW', value: 0.3 },
        { id: 'bd-2', indicator: 'PRICE_CHANGE_PERCENT_24H', operator: 'ABOVE', value: 0 },
      ],
      sortBy: 'compositeScore',
      sortDirection: 'desc',
    },
  },
  {
    id: 'oversold-uptrend',
    name: 'Oversold in Uptrend',
    description: 'Oversold RSI in assets above long-term moving averages',
    icon: 'ArrowDownCircle',
    category: 'mean_reversion',
    config: {
      filters: [
        { id: 'ou-1', indicator: 'RSI', indicatorParams: { period: 14 }, operator: 'BELOW', value: 30 },
        { id: 'ou-2', indicator: 'PRICE_CLOSE', operator: 'ABOVE', compareIndicator: 'EMA', compareIndicatorParams: { period: 50 } },
        { id: 'ou-3', indicator: 'PRICE_CLOSE', operator: 'ABOVE', compareIndicator: 'EMA', compareIndicatorParams: { period: 200 } },
      ],
      sortBy: 'rsi',
      sortDirection: 'asc',
    },
  },
  {
    id: 'overbought-downtrend',
    name: 'Overbought in Downtrend',
    description: 'Overbought RSI in assets below long-term moving averages',
    icon: 'ArrowUpCircle',
    category: 'mean_reversion',
    config: {
      filters: [
        { id: 'od-1', indicator: 'RSI', indicatorParams: { period: 14 }, operator: 'ABOVE', value: 70 },
        { id: 'od-2', indicator: 'PRICE_CLOSE', operator: 'BELOW', compareIndicator: 'EMA', compareIndicatorParams: { period: 50 } },
        { id: 'od-3', indicator: 'PRICE_CLOSE', operator: 'BELOW', compareIndicator: 'EMA', compareIndicatorParams: { period: 200 } },
      ],
      sortBy: 'rsi',
      sortDirection: 'desc',
    },
  },
  {
    id: 'momentum-leaders',
    name: 'Momentum Leaders',
    description: 'Strong trend with volume confirmation',
    icon: 'Zap',
    category: 'momentum',
    config: {
      filters: [
        { id: 'ml-1', indicator: 'RSI', indicatorParams: { period: 14 }, operator: 'BETWEEN', value: 55, valueMax: 80 },
        { id: 'ml-2', indicator: 'ADX', indicatorParams: { period: 14 }, operator: 'ABOVE', value: 25 },
        { id: 'ml-3', indicator: 'VOLUME_RATIO', operator: 'ABOVE', value: 1.2 },
      ],
      sortBy: 'adx',
      sortDirection: 'desc',
    },
  },
  {
    id: 'volume-spike',
    name: 'Volume Spike',
    description: 'Unusual volume activity in top market cap assets',
    icon: 'BarChart3',
    category: 'volume',
    config: {
      filters: [
        { id: 'vs-1', indicator: 'VOLUME_RATIO', operator: 'ABOVE', value: 2.0 },
        { id: 'vs-2', indicator: 'MARKET_CAP_RANK', operator: 'BELOW', value: 150 },
      ],
      sortBy: 'volumeRatio',
      sortDirection: 'desc',
    },
  },
  {
    id: 'breakout-candidates',
    name: 'Breakout Candidates',
    description: 'Tight Bollinger Bands squeeze with low ADX',
    icon: 'Target',
    category: 'volatility',
    config: {
      filters: [
        { id: 'bc-1', indicator: 'BOLLINGER_WIDTH', operator: 'BELOW', value: 0.04 },
        { id: 'bc-2', indicator: 'VOLUME_RATIO', operator: 'ABOVE', value: 1.0 },
        { id: 'bc-3', indicator: 'ADX', indicatorParams: { period: 14 }, operator: 'BELOW', value: 20 },
      ],
      sortBy: 'compositeScore',
      sortDirection: 'desc',
    },
  },
  {
    id: 'mean-reversion',
    name: 'Mean Reversion',
    description: 'Extreme RSI readings with high volatility',
    icon: 'RefreshCw',
    category: 'mean_reversion',
    config: {
      filters: [
        { id: 'mr-1', indicator: 'RSI', indicatorParams: { period: 14 }, operator: 'BELOW', value: 25, logicGroup: 'rsi-extreme' },
        { id: 'mr-2', indicator: 'RSI', indicatorParams: { period: 14 }, operator: 'ABOVE', value: 75, logicGroup: 'rsi-extreme' },
        { id: 'mr-3', indicator: 'ATR_PERCENT', operator: 'ABOVE', value: 2 },
      ],
      sortBy: 'rsi',
      sortDirection: 'asc',
    },
  },
  {
    id: 'high-volatility',
    name: 'High Volatility',
    description: 'High ATR with volume and trend confirmation',
    icon: 'Activity',
    category: 'volatility',
    config: {
      filters: [
        { id: 'hv-1', indicator: 'ATR_PERCENT', operator: 'ABOVE', value: 3 },
        { id: 'hv-2', indicator: 'VOLUME_RATIO', operator: 'ABOVE', value: 1.5 },
        { id: 'hv-3', indicator: 'ADX', indicatorParams: { period: 14 }, operator: 'ABOVE', value: 20 },
      ],
      sortBy: 'atrPercent',
      sortDirection: 'desc',
    },
  },
];

export const getPresets = (assetClass?: 'CRYPTO' | 'STOCKS'): ScreenerPreset[] => {
  if (!assetClass) return SCREENER_PRESETS;
  return SCREENER_PRESETS.filter(
    (p) => !p.assetClassRestriction || p.assetClassRestriction === assetClass,
  );
};

export const getPresetById = (id: string): ScreenerPreset | undefined =>
  SCREENER_PRESETS.find((p) => p.id === id);
