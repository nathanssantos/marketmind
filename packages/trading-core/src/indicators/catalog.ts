import type {
  ConditionOp,
  IndicatorCategory,
  IndicatorDefinition,
  IndicatorParamValue,
  ParamSchema,
} from './types';

const colorParam = (defaultColor: string): ParamSchema => ({
  key: 'color',
  labelKey: 'indicators.params.color',
  type: 'color',
  default: defaultColor,
  cosmetic: true,
});

const lineWidthParam = (defaultWidth = 1): ParamSchema => ({
  key: 'lineWidth',
  labelKey: 'indicators.params.lineWidth',
  type: 'integer',
  default: defaultWidth,
  min: 1,
  max: 5,
  step: 1,
  cosmetic: true,
});

const periodParam = (defaultPeriod: number, min = 2, max = 500): ParamSchema => ({
  key: 'period',
  labelKey: 'indicators.params.period',
  type: 'integer',
  default: defaultPeriod,
  min,
  max,
  step: 1,
});

const oscillatorOps: ConditionOp[] = [
  'gt',
  'lt',
  'between',
  'outside',
  'crossAbove',
  'crossBelow',
  'oversold',
  'overbought',
  'rising',
  'falling',
];

const trendOps: ConditionOp[] = ['gt', 'lt', 'crossAbove', 'crossBelow', 'rising', 'falling'];

const overlayLineOps: ConditionOp[] = ['gt', 'lt', 'crossAbove', 'crossBelow', 'rising', 'falling'];

const maDef = (
  type: string,
  labelKey: string,
  defaultPeriod: number,
  defaultColor: string,
  scriptId: 'sma' | 'ema' | 'wma' | 'hma',
): IndicatorDefinition => ({
  type,
  labelKey,
  category: 'movingAverages',
  params: [periodParam(defaultPeriod), colorParam(defaultColor), lineWidthParam()],
  outputs: [{ key: 'value', labelKey: 'indicators.outputs.value' }],
  render: { kind: 'overlay-line' },
  conditionOps: overlayLineOps,
  evaluator: { service: 'pine', scriptId },
  defaultLabel: (p) => `${type.toUpperCase()} ${p['period'] ?? defaultPeriod}`,
});

const demaDef: IndicatorDefinition = {
  type: 'dema',
  labelKey: 'indicators.dema',
  category: 'movingAverages',
  params: [periodParam(20), colorParam('#ff9800'), lineWidthParam()],
  outputs: [{ key: 'value', labelKey: 'indicators.outputs.value' }],
  render: { kind: 'overlay-line' },
  conditionOps: overlayLineOps,
  evaluator: { service: 'native', scriptId: 'dema' },
  defaultLabel: (p) => `DEMA ${p['period'] ?? 20}`,
};

const temaDef: IndicatorDefinition = {
  type: 'tema',
  labelKey: 'indicators.tema',
  category: 'movingAverages',
  params: [periodParam(20), colorParam('#e91e63'), lineWidthParam()],
  outputs: [{ key: 'value', labelKey: 'indicators.outputs.value' }],
  render: { kind: 'overlay-line' },
  conditionOps: overlayLineOps,
  evaluator: { service: 'native', scriptId: 'tema' },
  defaultLabel: (p) => `TEMA ${p['period'] ?? 20}`,
};

const entries: IndicatorDefinition[] = [
  maDef('sma', 'indicators.sma', 20, '#2196f3', 'sma'),
  maDef('ema', 'indicators.ema', 21, '#00e676', 'ema'),
  maDef('wma', 'indicators.wma', 20, '#9c27b0', 'wma'),
  maDef('hma', 'indicators.hma', 20, '#ff5722', 'hma'),
  demaDef,
  temaDef,

  {
    type: 'vwap',
    labelKey: 'indicators.vwap',
    category: 'volume',
    params: [colorParam('#ffc107'), lineWidthParam()],
    outputs: [{ key: 'value', labelKey: 'indicators.outputs.value' }],
    render: { kind: 'overlay-line' },
    conditionOps: overlayLineOps,
    evaluator: { service: 'pine', scriptId: 'vwap' },
    defaultLabel: () => 'VWAP',
  },

  {
    type: 'rsi',
    labelKey: 'indicators.rsi',
    category: 'oscillators',
    params: [periodParam(14, 2, 200), colorParam('#8b5cf6'), lineWidthParam()],
    outputs: [{ key: 'value', labelKey: 'indicators.outputs.value' }],
    render: { kind: 'pane-line', paneId: 'rsi' },
    conditionOps: oscillatorOps,
    valueRange: { min: 0, max: 100 },
    defaultThresholds: { oversold: 30, overbought: 70 },
    evaluator: { service: 'pine', scriptId: 'rsi' },
    defaultLabel: (p) => `RSI ${p['period'] ?? 14}`,
  },

  {
    type: 'stoch',
    labelKey: 'indicators.stoch',
    category: 'oscillators',
    params: [
      periodParam(14, 2, 100),
      { key: 'smoothK', labelKey: 'indicators.params.smoothK', type: 'integer', default: 3, min: 1, max: 50, step: 1 },
      { key: 'smoothD', labelKey: 'indicators.params.smoothD', type: 'integer', default: 3, min: 1, max: 50, step: 1 },
      colorParam('#00e676'),
      lineWidthParam(),
    ],
    outputs: [
      { key: 'k', labelKey: 'indicators.outputs.k' },
      { key: 'd', labelKey: 'indicators.outputs.d' },
    ],
    render: { kind: 'pane-multi', paneId: 'stoch' },
    conditionOps: oscillatorOps,
    valueRange: { min: 0, max: 100 },
    defaultThresholds: { oversold: 20, overbought: 80 },
    evaluator: { service: 'pine', scriptId: 'stoch', outputKey: 'k' },
    defaultLabel: (p) => `Stoch ${p['period'] ?? 14}`,
  },

  {
    type: 'stochRsi',
    labelKey: 'indicators.stochRsi',
    category: 'oscillators',
    params: [
      { key: 'rsiPeriod', labelKey: 'indicators.params.rsiPeriod', type: 'integer', default: 14, min: 2, max: 100, step: 1 },
      { key: 'stochPeriod', labelKey: 'indicators.params.stochPeriod', type: 'integer', default: 14, min: 2, max: 100, step: 1 },
      { key: 'kPeriod', labelKey: 'indicators.params.kPeriod', type: 'integer', default: 3, min: 1, max: 50, step: 1 },
      { key: 'dPeriod', labelKey: 'indicators.params.dPeriod', type: 'integer', default: 3, min: 1, max: 50, step: 1 },
      colorParam('#3b82f6'),
      lineWidthParam(),
    ],
    outputs: [
      { key: 'k', labelKey: 'indicators.outputs.k' },
      { key: 'd', labelKey: 'indicators.outputs.d' },
    ],
    render: { kind: 'pane-multi', paneId: 'stochRsi' },
    conditionOps: oscillatorOps,
    valueRange: { min: 0, max: 100 },
    defaultThresholds: { oversold: 20, overbought: 80 },
    evaluator: { service: 'native', scriptId: 'stochRsi', outputKey: 'k' },
    defaultLabel: (p) => `Stoch RSI ${p['rsiPeriod'] ?? 14}`,
  },

  {
    type: 'macd',
    labelKey: 'indicators.macd',
    category: 'momentum',
    params: [
      { key: 'fastPeriod', labelKey: 'indicators.params.fastPeriod', type: 'integer', default: 12, min: 2, max: 100, step: 1 },
      { key: 'slowPeriod', labelKey: 'indicators.params.slowPeriod', type: 'integer', default: 26, min: 2, max: 200, step: 1 },
      { key: 'signalPeriod', labelKey: 'indicators.params.signalPeriod', type: 'integer', default: 9, min: 2, max: 100, step: 1 },
      colorParam('#2196f3'),
      lineWidthParam(),
    ],
    outputs: [
      { key: 'line', labelKey: 'indicators.outputs.macdLine' },
      { key: 'signal', labelKey: 'indicators.outputs.macdSignal' },
      { key: 'histogram', labelKey: 'indicators.outputs.macdHistogram' },
    ],
    render: { kind: 'pane-multi', paneId: 'macd' },
    conditionOps: [...trendOps, 'crossAbove', 'crossBelow'],
    evaluator: { service: 'pine', scriptId: 'macd', outputKey: 'histogram' },
    defaultLabel: () => 'MACD',
  },

  {
    type: 'bollingerBands',
    labelKey: 'indicators.bollingerBands',
    category: 'volatility',
    params: [
      periodParam(20, 2, 200),
      { key: 'stdDev', labelKey: 'indicators.params.stdDev', type: 'number', default: 2, min: 0.1, max: 10, step: 0.1 },
      colorParam('#9c27b0'),
      lineWidthParam(),
    ],
    outputs: [
      { key: 'upper', labelKey: 'indicators.outputs.upper' },
      { key: 'middle', labelKey: 'indicators.outputs.middle' },
      { key: 'lower', labelKey: 'indicators.outputs.lower' },
    ],
    render: { kind: 'overlay-bands' },
    conditionOps: ['gt', 'lt', 'crossAbove', 'crossBelow'],
    evaluator: { service: 'pine', scriptId: 'bb', outputKey: 'middle' },
    defaultLabel: (p) => `BB ${p['period'] ?? 20} / ${p['stdDev'] ?? 2}σ`,
  },

  {
    type: 'keltner',
    labelKey: 'indicators.keltner',
    category: 'volatility',
    params: [
      periodParam(20, 2, 200),
      { key: 'multiplier', labelKey: 'indicators.params.multiplier', type: 'number', default: 2, min: 0.1, max: 10, step: 0.1 },
      colorParam('#00bcd4'),
      lineWidthParam(),
    ],
    outputs: [
      { key: 'upper', labelKey: 'indicators.outputs.upper' },
      { key: 'middle', labelKey: 'indicators.outputs.middle' },
      { key: 'lower', labelKey: 'indicators.outputs.lower' },
    ],
    render: { kind: 'overlay-bands' },
    conditionOps: ['gt', 'lt', 'crossAbove', 'crossBelow'],
    evaluator: { service: 'pine', scriptId: 'kc', outputKey: 'middle' },
    defaultLabel: (p) => `KC ${p['period'] ?? 20}`,
  },

  {
    type: 'donchian',
    labelKey: 'indicators.donchian',
    category: 'volatility',
    params: [periodParam(20, 2, 200), colorParam('#607d8b'), lineWidthParam()],
    outputs: [
      { key: 'upper', labelKey: 'indicators.outputs.upper' },
      { key: 'middle', labelKey: 'indicators.outputs.middle' },
      { key: 'lower', labelKey: 'indicators.outputs.lower' },
    ],
    render: { kind: 'overlay-bands' },
    conditionOps: ['gt', 'lt', 'crossAbove', 'crossBelow'],
    evaluator: { service: 'native', scriptId: 'donchian', outputKey: 'middle' },
    defaultLabel: (p) => `Donchian ${p['period'] ?? 20}`,
  },

  {
    type: 'atr',
    labelKey: 'indicators.atr',
    category: 'volatility',
    params: [periodParam(14, 2, 200), colorParam('#ff5722'), lineWidthParam()],
    outputs: [{ key: 'value', labelKey: 'indicators.outputs.value' }],
    render: { kind: 'pane-line', paneId: 'atr' },
    conditionOps: ['gt', 'lt', 'between', 'outside', 'rising', 'falling'],
    evaluator: { service: 'pine', scriptId: 'atr' },
    defaultLabel: (p) => `ATR ${p['period'] ?? 14}`,
  },

  {
    type: 'adx',
    labelKey: 'indicators.adx',
    category: 'trend',
    params: [periodParam(14, 2, 200), colorParam('#e91e63'), lineWidthParam()],
    outputs: [
      { key: 'adx', labelKey: 'indicators.outputs.adx' },
      { key: 'plusDI', labelKey: 'indicators.outputs.plusDI' },
      { key: 'minusDI', labelKey: 'indicators.outputs.minusDI' },
    ],
    render: { kind: 'pane-multi', paneId: 'adx' },
    conditionOps: ['gt', 'lt', 'between', 'rising', 'falling'],
    valueRange: { min: 0, max: 100 },
    defaultThresholds: { gt: 25 },
    evaluator: { service: 'pine', scriptId: 'dmi', outputKey: 'adx' },
    defaultLabel: (p) => `ADX ${p['period'] ?? 14}`,
  },

  {
    type: 'cci',
    labelKey: 'indicators.cci',
    category: 'oscillators',
    params: [periodParam(20, 2, 200), colorParam('#8bc34a'), lineWidthParam()],
    outputs: [{ key: 'value', labelKey: 'indicators.outputs.value' }],
    render: { kind: 'pane-line', paneId: 'cci' },
    conditionOps: oscillatorOps,
    defaultThresholds: { oversold: -100, overbought: 100 },
    evaluator: { service: 'pine', scriptId: 'cci' },
    defaultLabel: (p) => `CCI ${p['period'] ?? 20}`,
  },

  {
    type: 'williamsR',
    labelKey: 'indicators.williamsR',
    category: 'oscillators',
    params: [periodParam(14, 2, 200), colorParam('#ff9800'), lineWidthParam()],
    outputs: [{ key: 'value', labelKey: 'indicators.outputs.value' }],
    render: { kind: 'pane-line', paneId: 'williamsR' },
    conditionOps: oscillatorOps,
    valueRange: { min: -100, max: 0 },
    defaultThresholds: { oversold: -80, overbought: -20 },
    evaluator: { service: 'pine', scriptId: 'wpr' },
    defaultLabel: (p) => `W%R ${p['period'] ?? 14}`,
  },

  {
    type: 'mfi',
    labelKey: 'indicators.mfi',
    category: 'volume',
    params: [periodParam(14, 2, 200), colorParam('#00bcd4'), lineWidthParam()],
    outputs: [{ key: 'value', labelKey: 'indicators.outputs.value' }],
    render: { kind: 'pane-line', paneId: 'mfi' },
    conditionOps: oscillatorOps,
    valueRange: { min: 0, max: 100 },
    defaultThresholds: { oversold: 20, overbought: 80 },
    evaluator: { service: 'pine', scriptId: 'mfi' },
    defaultLabel: (p) => `MFI ${p['period'] ?? 14}`,
  },

  {
    type: 'cmo',
    labelKey: 'indicators.cmo',
    category: 'oscillators',
    params: [periodParam(14, 2, 200), colorParam('#3f51b5'), lineWidthParam()],
    outputs: [{ key: 'value', labelKey: 'indicators.outputs.value' }],
    render: { kind: 'pane-line', paneId: 'cmo' },
    conditionOps: oscillatorOps,
    valueRange: { min: -100, max: 100 },
    defaultThresholds: { oversold: -50, overbought: 50 },
    evaluator: { service: 'pine', scriptId: 'cmo' },
    defaultLabel: (p) => `CMO ${p['period'] ?? 14}`,
  },

  {
    type: 'tsi',
    labelKey: 'indicators.tsi',
    category: 'momentum',
    params: [
      { key: 'longPeriod', labelKey: 'indicators.params.longPeriod', type: 'integer', default: 25, min: 2, max: 200, step: 1 },
      { key: 'shortPeriod', labelKey: 'indicators.params.shortPeriod', type: 'integer', default: 13, min: 2, max: 200, step: 1 },
      { key: 'signalPeriod', labelKey: 'indicators.params.signalPeriod', type: 'integer', default: 13, min: 2, max: 100, step: 1 },
      colorParam('#009688'),
      lineWidthParam(),
    ],
    outputs: [{ key: 'value', labelKey: 'indicators.outputs.value' }],
    render: { kind: 'pane-line', paneId: 'tsi' },
    conditionOps: [...trendOps, 'between', 'outside'],
    valueRange: { min: -100, max: 100 },
    evaluator: { service: 'pine', scriptId: 'tsi' },
    defaultLabel: () => 'TSI',
  },

  {
    type: 'ppo',
    labelKey: 'indicators.ppo',
    category: 'momentum',
    params: [
      { key: 'fastPeriod', labelKey: 'indicators.params.fastPeriod', type: 'integer', default: 12, min: 2, max: 100, step: 1 },
      { key: 'slowPeriod', labelKey: 'indicators.params.slowPeriod', type: 'integer', default: 26, min: 2, max: 200, step: 1 },
      { key: 'signalPeriod', labelKey: 'indicators.params.signalPeriod', type: 'integer', default: 9, min: 2, max: 100, step: 1 },
      colorParam('#f44336'),
      lineWidthParam(),
    ],
    outputs: [
      { key: 'line', labelKey: 'indicators.outputs.line' },
      { key: 'signal', labelKey: 'indicators.outputs.signal' },
      { key: 'histogram', labelKey: 'indicators.outputs.histogram' },
    ],
    render: { kind: 'pane-multi', paneId: 'ppo' },
    conditionOps: [...trendOps, 'crossAbove', 'crossBelow'],
    evaluator: { service: 'native', scriptId: 'ppo', outputKey: 'histogram' },
    defaultLabel: () => 'PPO',
  },

  {
    type: 'roc',
    labelKey: 'indicators.roc',
    category: 'momentum',
    params: [periodParam(12, 2, 200), colorParam('#795548'), lineWidthParam()],
    outputs: [{ key: 'value', labelKey: 'indicators.outputs.value' }],
    render: { kind: 'pane-line', paneId: 'roc' },
    conditionOps: [...trendOps, 'between', 'outside'],
    evaluator: { service: 'pine', scriptId: 'roc' },
    defaultLabel: (p) => `ROC ${p['period'] ?? 12}`,
  },

  {
    type: 'supertrend',
    labelKey: 'indicators.supertrend',
    category: 'trend',
    params: [
      periodParam(10, 2, 100),
      { key: 'multiplier', labelKey: 'indicators.params.multiplier', type: 'number', default: 3, min: 0.1, max: 10, step: 0.1 },
      colorParam('#009688'),
      lineWidthParam(2),
    ],
    outputs: [
      { key: 'value', labelKey: 'indicators.outputs.value' },
      { key: 'direction', labelKey: 'indicators.outputs.direction' },
    ],
    render: { kind: 'overlay-line' },
    conditionOps: ['gt', 'lt', 'crossAbove', 'crossBelow'],
    evaluator: { service: 'pine', scriptId: 'supertrend', outputKey: 'value' },
    defaultLabel: (p) => `ST ${p['period'] ?? 10}/${p['multiplier'] ?? 3}`,
  },

  {
    type: 'parabolicSar',
    labelKey: 'indicators.parabolicSar',
    category: 'trend',
    params: [
      { key: 'start', labelKey: 'indicators.params.start', type: 'number', default: 0.02, min: 0.001, max: 1, step: 0.001 },
      { key: 'increment', labelKey: 'indicators.params.increment', type: 'number', default: 0.02, min: 0.001, max: 1, step: 0.001 },
      { key: 'max', labelKey: 'indicators.params.max', type: 'number', default: 0.2, min: 0.001, max: 1, step: 0.001 },
      colorParam('#ff5722'),
    ],
    outputs: [{ key: 'value', labelKey: 'indicators.outputs.value' }],
    render: { kind: 'overlay-points' },
    conditionOps: ['gt', 'lt', 'crossAbove', 'crossBelow'],
    evaluator: { service: 'pine', scriptId: 'sar' },
    defaultLabel: () => 'SAR',
  },

  {
    type: 'obv',
    labelKey: 'indicators.obv',
    category: 'volume',
    params: [colorParam('#2196f3'), lineWidthParam()],
    outputs: [{ key: 'value', labelKey: 'indicators.outputs.value' }],
    render: { kind: 'pane-line', paneId: 'obv' },
    conditionOps: ['rising', 'falling', 'crossAbove', 'crossBelow'],
    evaluator: { service: 'pine', scriptId: 'obv' },
    defaultLabel: () => 'OBV',
  },

  {
    type: 'volume',
    labelKey: 'indicators.volume',
    category: 'volume',
    params: [colorParam('#607d8b')],
    outputs: [{ key: 'value', labelKey: 'indicators.outputs.value' }],
    render: { kind: 'pane-histogram', paneId: 'volume' },
    conditionOps: ['gt', 'lt', 'rising', 'falling'],
    evaluator: { service: 'native', scriptId: 'volume' },
    defaultLabel: () => 'Volume',
  },

  {
    type: 'fibonacci',
    labelKey: 'indicators.fibonacci',
    category: 'priceStructure',
    params: [colorParam('#ffc107')],
    outputs: [{ key: 'levels', labelKey: 'indicators.outputs.levels' }],
    render: { kind: 'custom', rendererId: 'fibonacci' },
    conditionOps: [],
    evaluator: { service: 'native', scriptId: 'fibonacci' },
    defaultLabel: () => 'Fibonacci',
  },

  {
    type: 'fvg',
    labelKey: 'indicators.fvg',
    category: 'orderFlow',
    params: [colorParam('#4caf50')],
    outputs: [
      { key: 'bullishTop', labelKey: 'indicators.outputs.bullishTop' },
      { key: 'bullishBottom', labelKey: 'indicators.outputs.bullishBottom' },
      { key: 'bearishTop', labelKey: 'indicators.outputs.bearishTop' },
      { key: 'bearishBottom', labelKey: 'indicators.outputs.bearishBottom' },
    ],
    render: { kind: 'custom', rendererId: 'fvg' },
    conditionOps: [],
    evaluator: { service: 'native', scriptId: 'fvg' },
    defaultLabel: () => 'FVG',
  },

  {
    type: 'liquidityLevels',
    labelKey: 'indicators.liquidityLevels',
    category: 'orderFlow',
    params: [colorParam('#ffeb3b')],
    outputs: [{ key: 'levels', labelKey: 'indicators.outputs.levels' }],
    render: { kind: 'custom', rendererId: 'liquidityLevels' },
    conditionOps: [],
    evaluator: { service: 'native', scriptId: 'liquidityLevels' },
    defaultLabel: () => 'Liquidity',
  },
];

export const INDICATOR_CATALOG: Record<string, IndicatorDefinition> = Object.fromEntries(
  entries.map((e) => [e.type, e]),
);

export const INDICATOR_TYPES: string[] = entries.map((e) => e.type);

export const INDICATORS_BY_CATEGORY: Record<IndicatorCategory, IndicatorDefinition[]> = entries.reduce(
  (acc, def) => {
    if (!acc[def.category]) acc[def.category] = [];
    acc[def.category].push(def);
    return acc;
  },
  {} as Record<IndicatorCategory, IndicatorDefinition[]>,
);

export const getIndicatorDefinition = (type: string): IndicatorDefinition | undefined =>
  INDICATOR_CATALOG[type];

export const getDefaultParamsForType = (type: string): Record<string, IndicatorParamValue> => {
  const def = INDICATOR_CATALOG[type];
  if (!def) return {};
  return def.params.reduce<Record<string, IndicatorParamValue>>((acc, p) => {
    acc[p.key] = p.default;
    return acc;
  }, {});
};
