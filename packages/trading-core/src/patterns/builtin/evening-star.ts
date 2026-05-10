import type { PatternDefinition } from '../types';

export const EVENING_STAR: PatternDefinition = {
  id: 'evening-star',
  label: 'Evening Star',
  category: 'reversal-multi',
  sentiment: 'bearish',
  bars: 3,
  params: [
    { key: 'starMaxBodyRatio', label: 'Middle-bar max body / range', type: 'number', default: 0.3, min: 0.1, max: 0.5, step: 0.05 },
  ],
  constraints: [
    "direction(b2) = 'up'",
    'range(b1) > 0',
    'body(b1) <= params.starMaxBodyRatio * range(b1)',
    'bottomBody(b1) > topBody(b2)',
    "direction(b0) = 'down'",
    'close(b0) < (open(b2) + close(b2)) / 2',
  ],
  description: 'Three-bar bearish reversal: large bull, small-body star gapping up, large bear closing past the bull midpoint.',
};
