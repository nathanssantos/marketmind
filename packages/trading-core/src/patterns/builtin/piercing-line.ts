import type { PatternDefinition } from '../types';

export const PIERCING_LINE: PatternDefinition = {
  id: 'piercing-line',
  label: 'Piercing Line',
  category: 'reversal-multi',
  sentiment: 'bullish',
  bars: 2,
  params: [],
  constraints: [
    "direction(b1) = 'down'",
    "direction(b0) = 'up'",
    'open(b0) < close(b1)',
    'close(b0) > (open(b1) + close(b1)) / 2',
    'close(b0) < open(b1)',
  ],
  description: 'Bull bar opens below the prior bear close and recovers past its midpoint without closing above the prior open. Bullish reversal.',
};
