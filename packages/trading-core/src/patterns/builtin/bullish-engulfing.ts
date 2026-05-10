import type { PatternDefinition } from '../types';

export const BULLISH_ENGULFING: PatternDefinition = {
  id: 'bullish-engulfing',
  label: 'Bullish Engulfing',
  category: 'reversal-multi',
  sentiment: 'bullish',
  bars: 2,
  params: [],
  constraints: [
    "direction(b1) = 'down'",
    "direction(b0) = 'up'",
    'open(b0) <= close(b1)',
    'close(b0) >= open(b1)',
    'body(b0) > body(b1)',
  ],
  description: 'A small bear bar fully engulfed by a larger bull bar. Bullish reversal.',
};
