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
        { id: 'tg-1', indicator: 'PRICE_CHANGE_PERCENT_24H', operator: 'ABOVE', value: 1 },
        { id: 'tg-2', indicator: 'MARKET_CAP_RANK', operator: 'BELOW', value: 200 },
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
        { id: 'tl-1', indicator: 'PRICE_CHANGE_PERCENT_24H', operator: 'BELOW', value: -1 },
        { id: 'tl-2', indicator: 'MARKET_CAP_RANK', operator: 'BELOW', value: 200 },
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
    description: 'Oversold RSI in assets above EMA200',
    icon: 'ArrowDownCircle',
    category: 'mean_reversion',
    config: {
      filters: [
        { id: 'ou-1', indicator: 'RSI', indicatorParams: { period: 14 }, operator: 'BELOW', value: 35 },
        { id: 'ou-2', indicator: 'PRICE_CLOSE', operator: 'ABOVE', compareIndicator: 'EMA', compareIndicatorParams: { period: 200 } },
      ],
      sortBy: 'rsi',
      sortDirection: 'asc',
    },
  },
  {
    id: 'overbought-downtrend',
    name: 'Overbought in Downtrend',
    description: 'Overbought RSI in assets below EMA200',
    icon: 'ArrowUpCircle',
    category: 'mean_reversion',
    config: {
      filters: [
        { id: 'od-1', indicator: 'RSI', indicatorParams: { period: 14 }, operator: 'ABOVE', value: 65 },
        { id: 'od-2', indicator: 'PRICE_CLOSE', operator: 'BELOW', compareIndicator: 'EMA', compareIndicatorParams: { period: 200 } },
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
        { id: 'ml-2', indicator: 'ADX', indicatorParams: { period: 14 }, operator: 'ABOVE', value: 20 },
        { id: 'ml-3', indicator: 'VOLUME_RATIO', operator: 'ABOVE', value: 0.8 },
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
        { id: 'vs-1', indicator: 'VOLUME_RATIO', operator: 'ABOVE', value: 1.5 },
        { id: 'vs-2', indicator: 'MARKET_CAP_RANK', operator: 'BELOW', value: 200 },
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
        { id: 'bc-1', indicator: 'BOLLINGER_WIDTH', operator: 'BELOW', value: 0.12 },
        { id: 'bc-2', indicator: 'ADX', indicatorParams: { period: 14 }, operator: 'BELOW', value: 25 },
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
        { id: 'mr-1', indicator: 'RSI', indicatorParams: { period: 14 }, operator: 'BELOW', value: 30, logicGroup: 'rsi-extreme' },
        { id: 'mr-2', indicator: 'RSI', indicatorParams: { period: 14 }, operator: 'ABOVE', value: 70, logicGroup: 'rsi-extreme' },
        { id: 'mr-3', indicator: 'ATR_PERCENT', operator: 'ABOVE', value: 1.5 },
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
        { id: 'hv-1', indicator: 'ATR_PERCENT', operator: 'ABOVE', value: 1.5 },
        { id: 'hv-2', indicator: 'VOLUME_RATIO', operator: 'ABOVE', value: 0.8 },
        { id: 'hv-3', indicator: 'ADX', indicatorParams: { period: 14 }, operator: 'ABOVE', value: 15 },
      ],
      sortBy: 'atrPercent',
      sortDirection: 'desc',
    },
  },
  {
    id: 'best-for-long',
    name: 'Best for Long',
    description: 'Bullish bias: price above EMA200, RSI not overbought, MACD positive',
    icon: 'ArrowUpRight',
    category: 'momentum',
    config: {
      filters: [
        { id: 'bl-1', indicator: 'RSI', indicatorParams: { period: 14 }, operator: 'BETWEEN', value: 30, valueMax: 65 },
        { id: 'bl-2', indicator: 'PRICE_CLOSE', operator: 'ABOVE', compareIndicator: 'EMA', compareIndicatorParams: { period: 200 } },
        { id: 'bl-3', indicator: 'MACD_HISTOGRAM', operator: 'ABOVE', value: 0 },
      ],
      sortBy: 'compositeScore',
      sortDirection: 'desc',
    },
  },
  {
    id: 'best-for-short',
    name: 'Best for Short',
    description: 'Bearish bias: price below EMA200, RSI not oversold, MACD negative',
    icon: 'ArrowDownRight',
    category: 'momentum',
    config: {
      filters: [
        { id: 'bs-1', indicator: 'RSI', indicatorParams: { period: 14 }, operator: 'BETWEEN', value: 35, valueMax: 70 },
        { id: 'bs-2', indicator: 'PRICE_CLOSE', operator: 'BELOW', compareIndicator: 'EMA', compareIndicatorParams: { period: 200 } },
        { id: 'bs-3', indicator: 'MACD_HISTOGRAM', operator: 'BELOW', value: 0 },
      ],
      sortBy: 'compositeScore',
      sortDirection: 'desc',
    },
  },
  {
    id: 'straight-line-movers',
    name: 'Straight-Line Movers',
    description: 'Strong directional moves with high ATR, strong trend, and volume confirmation',
    icon: 'MoveRight',
    category: 'momentum',
    config: {
      filters: [
        { id: 'sl-1', indicator: 'ATR_PERCENT', operator: 'ABOVE', value: 2 },
        { id: 'sl-2', indicator: 'ADX', indicatorParams: { period: 14 }, operator: 'ABOVE', value: 20 },
        { id: 'sl-3', indicator: 'VOLUME_RATIO', operator: 'ABOVE', value: 1.0 },
      ],
      sortBy: 'atrPercent',
      sortDirection: 'desc',
    },
  },
  {
    id: 'best-for-scalping',
    name: 'Best for Scalping',
    description: 'High liquidity, moderate volatility — ideal for scalping',
    icon: 'Crosshair',
    category: 'scalping',
    assetClassRestriction: 'CRYPTO',
    config: {
      filters: [
        { id: 'sc-1', indicator: 'QUOTE_VOLUME_24H', operator: 'ABOVE', value: 100_000_000 },
        { id: 'sc-2', indicator: 'ATR_PERCENT', operator: 'BETWEEN', value: 1.5, valueMax: 10 },
        { id: 'sc-3', indicator: 'VOLUME_RATIO', operator: 'ABOVE', value: 0.5 },
      ],
      sortBy: 'quoteVolume24h',
      sortDirection: 'desc',
    },
  },
  {
    id: 'cci-scalping-long',
    name: 'CCI Scalping Long',
    description: 'CCI oversold with high liquidity — look for EMA cross long entry',
    icon: 'Crosshair',
    category: 'scalping',
    assetClassRestriction: 'CRYPTO',
    config: {
      filters: [
        { id: 'csl-1', indicator: 'CCI', operator: 'BETWEEN', value: -150, valueMax: -50 },
        { id: 'csl-2', indicator: 'QUOTE_VOLUME_24H', operator: 'ABOVE', value: 100_000_000 },
        { id: 'csl-3', indicator: 'VOLUME_RATIO', operator: 'ABOVE', value: 0.5 },
      ],
      sortBy: 'quoteVolume24h',
      sortDirection: 'desc',
    },
  },
  {
    id: 'cci-scalping-short',
    name: 'CCI Scalping Short',
    description: 'CCI overbought with high liquidity — look for EMA cross short entry',
    icon: 'Crosshair',
    category: 'scalping',
    assetClassRestriction: 'CRYPTO',
    config: {
      filters: [
        { id: 'css-1', indicator: 'CCI', operator: 'BETWEEN', value: 50, valueMax: 150 },
        { id: 'css-2', indicator: 'QUOTE_VOLUME_24H', operator: 'ABOVE', value: 100_000_000 },
        { id: 'css-3', indicator: 'VOLUME_RATIO', operator: 'ABOVE', value: 0.5 },
      ],
      sortBy: 'quoteVolume24h',
      sortDirection: 'desc',
    },
  },
  {
    id: 'session-openers',
    name: 'Session Openers',
    description: 'Most active assets at session opens with significant price moves',
    icon: 'Clock',
    category: 'volume',
    config: {
      filters: [
        { id: 'so-1', indicator: 'VOLUME_RATIO', operator: 'ABOVE', value: 1.2 },
        { id: 'so-2', indicator: 'PRICE_CHANGE_PERCENT_24H', operator: 'ABOVE', value: 1, logicGroup: 'price-move' },
        { id: 'so-3', indicator: 'PRICE_CHANGE_PERCENT_24H', operator: 'BELOW', value: -1, logicGroup: 'price-move' },
      ],
      sortBy: 'volumeRatio',
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
