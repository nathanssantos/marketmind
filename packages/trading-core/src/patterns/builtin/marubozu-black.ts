import type { PatternDefinition } from '../types';

export const MARUBOZU_BLACK: PatternDefinition = {
  id: 'marubozu-black',
  label: 'Marubozu Black',
  category: 'continuation',
  sentiment: 'bearish',
  bars: 1,
  params: [
    { key: 'maxWickRatio', label: 'Max each-wick / range', type: 'number', default: 0.05, min: 0.0, max: 0.15, step: 0.01 },
    { key: 'minBodyRatio', label: 'Min body / range', type: 'number', default: 0.9, min: 0.7, max: 1.0, step: 0.05 },
  ],
  constraints: [
    'range(b0) > 0',
    "direction(b0) = 'down'",
    'body(b0) >= params.minBodyRatio * range(b0)',
    'upperWick(b0) <= params.maxWickRatio * range(b0)',
    'lowerWick(b0) <= params.maxWickRatio * range(b0)',
  ],
  description: 'Strong bearish bar with negligible wicks — sellers controlled from open to close.',
};
