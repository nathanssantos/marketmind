import type { PatternDefinition } from '../types';

export const RISING_THREE_METHODS: PatternDefinition = {
  id: 'rising-three-methods',
  label: 'Rising Three Methods',
  category: 'continuation',
  sentiment: 'bullish',
  bars: 5,
  params: [],
  constraints: [
    "direction(b4) = 'up'",
    'topBody(b3) <= high(b4)',
    'bottomBody(b3) >= low(b4)',
    'topBody(b2) <= high(b4)',
    'bottomBody(b2) >= low(b4)',
    'topBody(b1) <= high(b4)',
    'bottomBody(b1) >= low(b4)',
    "direction(b0) = 'up'",
    'close(b0) > close(b4)',
  ],
  description: 'Long bull bar, three small bars contained within its range, fifth bar a bull closing above the first. Bullish continuation.',
};
