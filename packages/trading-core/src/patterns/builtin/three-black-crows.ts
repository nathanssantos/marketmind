import type { PatternDefinition } from '../types';

export const THREE_BLACK_CROWS: PatternDefinition = {
  id: 'three-black-crows',
  label: 'Three Black Crows',
  category: 'reversal-multi',
  sentiment: 'bearish',
  bars: 3,
  params: [],
  constraints: [
    "direction(b2) = 'down'",
    "direction(b1) = 'down'",
    "direction(b0) = 'down'",
    'open(b1) < open(b2)',
    'open(b1) > close(b2)',
    'open(b0) < open(b1)',
    'open(b0) > close(b1)',
    'close(b0) < close(b1)',
    'close(b1) < close(b2)',
  ],
  description: 'Three consecutive bear bars each opening inside the prior body and closing lower. Strong bearish continuation/reversal.',
};
