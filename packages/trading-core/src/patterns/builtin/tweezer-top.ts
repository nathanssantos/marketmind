import type { PatternDefinition } from '../types';

export const TWEEZER_TOP: PatternDefinition = {
  id: 'tweezer-top',
  label: 'Tweezer Top',
  category: 'reversal-multi',
  sentiment: 'bearish',
  bars: 2,
  params: [
    { key: 'tolerance', label: 'High-match tolerance / range', type: 'number', default: 0.005, min: 0.0, max: 0.02, step: 0.001 },
  ],
  constraints: [
    "direction(b1) = 'up'",
    "direction(b0) = 'down'",
    'range(b1) > 0',
    'high(b0) - high(b1) <= params.tolerance * range(b1)',
    'high(b1) - high(b0) <= params.tolerance * range(b1)',
  ],
  description: 'Two consecutive bars (up then down) sharing the same high. Sellers rejected the level twice — bearish reversal.',
};
