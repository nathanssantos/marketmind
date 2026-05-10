import type { PatternDefinition } from '../types';

export const MORNING_STAR: PatternDefinition = {
  id: 'morning-star',
  label: 'Morning Star',
  category: 'reversal-multi',
  sentiment: 'bullish',
  bars: 3,
  params: [
    { key: 'starMaxBodyRatio', label: 'Middle-bar max body / range', type: 'number', default: 0.3, min: 0.1, max: 0.5, step: 0.05 },
  ],
  constraints: [
    "direction(b2) = 'down'",
    'range(b1) > 0',
    'body(b1) <= params.starMaxBodyRatio * range(b1)',
    'topBody(b1) < bottomBody(b2)',
    "direction(b0) = 'up'",
    'close(b0) > (open(b2) + close(b2)) / 2',
  ],
  description: 'Three-bar bullish reversal: large bear, small-body star gapping down, large bull closing past the bear midpoint.',
};
