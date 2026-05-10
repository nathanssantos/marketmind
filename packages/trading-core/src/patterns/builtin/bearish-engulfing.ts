import type { PatternDefinition } from '../types';

export const BEARISH_ENGULFING: PatternDefinition = {
  id: 'bearish-engulfing',
  label: 'Bearish Engulfing',
  category: 'reversal-multi',
  sentiment: 'bearish',
  bars: 2,
  params: [],
  constraints: [
    "direction(b1) = 'up'",
    "direction(b0) = 'down'",
    'open(b0) >= close(b1)',
    'close(b0) <= open(b1)',
    'body(b0) > body(b1)',
  ],
  description: 'A small bull bar fully engulfed by a larger bear bar. Bearish reversal.',
};
