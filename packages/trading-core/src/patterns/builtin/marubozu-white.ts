import type { PatternDefinition } from '../types';

export const MARUBOZU_WHITE: PatternDefinition = {
  id: 'marubozu-white',
  label: 'Marubozu White',
  category: 'continuation',
  sentiment: 'bullish',
  bars: 1,
  params: [
    { key: 'maxWickRatio', label: 'Max each-wick / range', type: 'number', default: 0.05, min: 0.0, max: 0.15, step: 0.01 },
    { key: 'minBodyRatio', label: 'Min body / range', type: 'number', default: 0.9, min: 0.7, max: 1.0, step: 0.05 },
  ],
  constraints: [
    'range(b0) > 0',
    "direction(b0) = 'up'",
    'body(b0) >= params.minBodyRatio * range(b0)',
    'upperWick(b0) <= params.maxWickRatio * range(b0)',
    'lowerWick(b0) <= params.maxWickRatio * range(b0)',
  ],
  description: 'Strong bullish bar with negligible wicks — buyers controlled from open to close.',
};
