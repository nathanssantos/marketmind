import type { PatternDefinition } from '../types';

export const DRAGONFLY_DOJI: PatternDefinition = {
  id: 'dragonfly-doji',
  label: 'Dragonfly Doji',
  category: 'reversal-single',
  sentiment: 'bullish',
  bars: 1,
  params: [
    { key: 'maxBodyRatio', label: 'Max body / range', type: 'number', default: 0.05, min: 0.01, max: 0.15, step: 0.01 },
    { key: 'maxUpperWickRatio', label: 'Max upper wick / range', type: 'number', default: 0.05, min: 0.0, max: 0.15, step: 0.01 },
  ],
  constraints: [
    'range(b0) > 0',
    'body(b0) <= params.maxBodyRatio * range(b0)',
    'upperWick(b0) <= params.maxUpperWickRatio * range(b0)',
  ],
  description: 'Doji with no upper wick and a long lower wick. Bullish — buyers reclaimed the entire down-move.',
};
