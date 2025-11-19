import type { AIStudyType } from '../types/aiStudy';

export const STUDY_COLORS: Record<AIStudyType, string> = {
  // Support/Resistance
  support: '#22c55e',
  resistance: '#ef4444',

  // Trendlines
  'trendline-bullish': '#10b981',
  'trendline-bearish': '#f43f5e',

  // Channels
  'channel-ascending': '#059669',
  'channel-descending': '#dc2626',
  'channel-horizontal': '#3b82f6',

  // Fibonacci
  'fibonacci-retracement': '#8b5cf6',
  'fibonacci-extension': '#a78bfa',

  // Reversal Patterns
  'head-and-shoulders': '#ef4444',
  'inverse-head-and-shoulders': '#22c55e',
  'double-top': '#dc2626',
  'double-bottom': '#16a34a',
  'triple-top': '#b91c1c',
  'triple-bottom': '#15803d',
  'rounding-bottom': '#4ade80',

  // Continuation Patterns
  'triangle-ascending': '#10b981',
  'triangle-descending': '#f43f5e',
  'triangle-symmetrical': '#6366f1',
  'wedge-rising': '#f97316',
  'wedge-falling': '#06b6d4',
  'flag-bullish': '#84cc16',
  'flag-bearish': '#f59e0b',
  pennant: '#8b5cf6',
  'cup-and-handle': '#14b8a6',

  // Gaps
  'gap-common': '#94a3b8',
  'gap-breakaway': '#6366f1',
  'gap-runaway': '#8b5cf6',
  'gap-exhaustion': '#ec4899',

  // Advanced
  'elliott-wave': '#7c3aed',

  // Zones (Legacy - keeping for backward compatibility)
  'liquidity-zone': '#3b82f6',
  'sell-zone': '#ef4444',
  'buy-zone': '#22c55e',
  'accumulation-zone': '#8b5cf6',
} as const;

export const LINE_STYLES: Record<string, 'solid' | 'dashed' | 'dotted'> = {
  support: 'solid',
  resistance: 'solid',
  'trendline-bullish': 'dashed',
  'trendline-bearish': 'dashed',
  fibonacci: 'dotted',
  channel: 'solid',
  pattern: 'solid',
  zone: 'solid',
  gap: 'dashed',
} as const;

export const LINE_WIDTHS = {
  primary: 2,
  secondary: 1.5,
  thin: 1,
  thick: 3,
} as const;

export const OPACITY = {
  line: 0.8,
  zone: 0.2,
  label: 0.9,
  inactive: 0.4,
  hover: 1.0,
} as const;

export const STUDY_LABELS: Record<AIStudyType, string> = {
  // Support/Resistance
  support: 'Support',
  resistance: 'Resistance',

  // Trendlines
  'trendline-bullish': 'Bullish Trendline',
  'trendline-bearish': 'Bearish Trendline',

  // Channels
  'channel-ascending': 'Ascending Channel',
  'channel-descending': 'Descending Channel',
  'channel-horizontal': 'Horizontal Channel',

  // Fibonacci
  'fibonacci-retracement': 'Fibonacci Retracement',
  'fibonacci-extension': 'Fibonacci Extension',

  // Reversal Patterns
  'head-and-shoulders': 'Head and Shoulders',
  'inverse-head-and-shoulders': 'Inverse H&S',
  'double-top': 'Double Top',
  'double-bottom': 'Double Bottom',
  'triple-top': 'Triple Top',
  'triple-bottom': 'Triple Bottom',
  'rounding-bottom': 'Rounding Bottom',

  // Continuation Patterns
  'triangle-ascending': 'Ascending Triangle',
  'triangle-descending': 'Descending Triangle',
  'triangle-symmetrical': 'Symmetrical Triangle',
  'wedge-rising': 'Rising Wedge',
  'wedge-falling': 'Falling Wedge',
  'flag-bullish': 'Bullish Flag',
  'flag-bearish': 'Bearish Flag',
  pennant: 'Pennant',
  'cup-and-handle': 'Cup and Handle',

  // Gaps
  'gap-common': 'Common Gap',
  'gap-breakaway': 'Breakaway Gap',
  'gap-runaway': 'Runaway Gap',
  'gap-exhaustion': 'Exhaustion Gap',

  // Advanced
  'elliott-wave': 'Elliott Wave',

  // Zones
  'liquidity-zone': 'Liquidity Zone',
  'sell-zone': 'Sell Zone',
  'buy-zone': 'Buy Zone',
  'accumulation-zone': 'Accumulation Zone',
} as const;

export const STUDY_CATEGORIES = {
  'Support & Resistance': ['support', 'resistance'],
  Trendlines: ['trendline-bullish', 'trendline-bearish'],
  Channels: ['channel-ascending', 'channel-descending', 'channel-horizontal'],
  Fibonacci: ['fibonacci-retracement', 'fibonacci-extension'],
  'Reversal Patterns': [
    'head-and-shoulders',
    'inverse-head-and-shoulders',
    'double-top',
    'double-bottom',
    'triple-top',
    'triple-bottom',
    'rounding-bottom',
  ],
  'Continuation Patterns': [
    'triangle-ascending',
    'triangle-descending',
    'triangle-symmetrical',
    'wedge-rising',
    'wedge-falling',
    'flag-bullish',
    'flag-bearish',
    'pennant',
    'cup-and-handle',
  ],
  Gaps: ['gap-common', 'gap-breakaway', 'gap-runaway', 'gap-exhaustion'],
  Advanced: ['elliott-wave'],
  Zones: ['liquidity-zone', 'sell-zone', 'buy-zone', 'accumulation-zone'],
} as const;

export const getStudyStyle = (type: AIStudyType) => {
  const category = Object.keys(STUDY_CATEGORIES).find((cat) =>
    STUDY_CATEGORIES[cat as keyof typeof STUDY_CATEGORIES].includes(
      type as never
    )
  );

  let lineStyle: 'solid' | 'dashed' | 'dotted' = 'solid';
  if (type.startsWith('trendline')) lineStyle = 'dashed';
  else if (type.startsWith('fibonacci')) lineStyle = 'dotted';
  else if (type.startsWith('gap')) lineStyle = 'dashed';

  return {
    color: STUDY_COLORS[type],
    lineStyle,
    lineWidth: LINE_WIDTHS.primary,
    opacity: OPACITY.line,
    zoneOpacity: OPACITY.zone,
    category,
    label: STUDY_LABELS[type],
  };
};
