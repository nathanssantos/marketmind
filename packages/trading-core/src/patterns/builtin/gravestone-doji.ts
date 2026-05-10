import type { PatternDefinition } from '../types';

export const GRAVESTONE_DOJI: PatternDefinition = {
  id: 'gravestone-doji',
  label: 'Gravestone Doji',
  category: 'reversal-single',
  sentiment: 'bearish',
  bars: 1,
  params: [
    { key: 'maxBodyRatio', label: 'Max body / range', type: 'number', default: 0.05, min: 0.01, max: 0.15, step: 0.01 },
    { key: 'maxLowerWickRatio', label: 'Max lower wick / range', type: 'number', default: 0.05, min: 0.0, max: 0.15, step: 0.01 },
  ],
  constraints: [
    'range(b0) > 0',
    'body(b0) <= params.maxBodyRatio * range(b0)',
    'lowerWick(b0) <= params.maxLowerWickRatio * range(b0)',
  ],
  description: 'Doji with no lower wick and a long upper wick. Bearish — sellers wiped out the entire up-move.',
};
