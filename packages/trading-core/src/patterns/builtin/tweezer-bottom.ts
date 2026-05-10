import type { PatternDefinition } from '../types';

export const TWEEZER_BOTTOM: PatternDefinition = {
  id: 'tweezer-bottom',
  label: 'Tweezer Bottom',
  category: 'reversal-multi',
  sentiment: 'bullish',
  bars: 2,
  params: [
    { key: 'tolerance', label: 'Low-match tolerance / range', type: 'number', default: 0.005, min: 0.0, max: 0.02, step: 0.001 },
  ],
  constraints: [
    "direction(b1) = 'down'",
    "direction(b0) = 'up'",
    'range(b1) > 0',
    'low(b0) - low(b1) <= params.tolerance * range(b1)',
    'low(b1) - low(b0) <= params.tolerance * range(b1)',
  ],
  description: 'Two consecutive bars (down then up) sharing the same low. Buyers defended the level twice — bullish reversal.',
};
