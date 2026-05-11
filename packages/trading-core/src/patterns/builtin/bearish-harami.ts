import type { PatternDefinition } from '../types';

export const BEARISH_HARAMI: PatternDefinition = {
  id: 'bearish-harami',
  label: 'Bearish Harami',
  category: 'reversal-multi',
  sentiment: 'bearish',
  bars: 2,
  params: [],
  constraints: [
    "direction(b1) = 'up'",
    "direction(b0) = 'down'",
    'topBody(b0) <= topBody(b1)',
    'bottomBody(b0) >= bottomBody(b1)',
    'body(b0) < body(b1)',
  ],
  description: 'A small bear bar contained inside the prior large bull body. Bearish reversal — momentum stalled.',
};
