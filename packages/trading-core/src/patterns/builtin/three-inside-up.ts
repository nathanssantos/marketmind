import type { PatternDefinition } from '../types';

export const THREE_INSIDE_UP: PatternDefinition = {
  id: 'three-inside-up',
  label: 'Three Inside Up',
  category: 'reversal-multi',
  sentiment: 'bullish',
  bars: 3,
  params: [],
  constraints: [
    "direction(b2) = 'down'",
    "direction(b1) = 'up'",
    'topBody(b1) <= topBody(b2)',
    'bottomBody(b1) >= bottomBody(b2)',
    'body(b1) < body(b2)',
    "direction(b0) = 'up'",
    'close(b0) > topBody(b2)',
  ],
  description: 'Bullish Harami confirmed by a third bar that closes above the prior down-bar body. Higher-confidence bullish reversal.',
};
