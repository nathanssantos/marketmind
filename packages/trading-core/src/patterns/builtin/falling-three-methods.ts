import type { PatternDefinition } from '../types';

export const FALLING_THREE_METHODS: PatternDefinition = {
  id: 'falling-three-methods',
  label: 'Falling Three Methods',
  category: 'continuation',
  sentiment: 'bearish',
  bars: 5,
  params: [],
  constraints: [
    "direction(b4) = 'down'",
    'topBody(b3) <= high(b4)',
    'bottomBody(b3) >= low(b4)',
    'topBody(b2) <= high(b4)',
    'bottomBody(b2) >= low(b4)',
    'topBody(b1) <= high(b4)',
    'bottomBody(b1) >= low(b4)',
    "direction(b0) = 'down'",
    'close(b0) < close(b4)',
  ],
  description: 'Long bear bar, three small bars contained within its range, fifth bar a bear closing below the first. Bearish continuation.',
};
