import type { PatternDefinition } from '../types';

export const BULLISH_HARAMI: PatternDefinition = {
  id: 'bullish-harami',
  label: 'Bullish Harami',
  category: 'reversal-multi',
  sentiment: 'bullish',
  bars: 2,
  params: [],
  constraints: [
    "direction(b1) = 'down'",
    "direction(b0) = 'up'",
    'topBody(b0) <= topBody(b1)',
    'bottomBody(b0) >= bottomBody(b1)',
    'body(b0) < body(b1)',
  ],
  description: 'A small bull bar contained inside the prior large bear body. Bullish reversal — momentum stalled.',
};
