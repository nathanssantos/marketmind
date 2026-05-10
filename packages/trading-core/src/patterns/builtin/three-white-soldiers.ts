import type { PatternDefinition } from '../types';

export const THREE_WHITE_SOLDIERS: PatternDefinition = {
  id: 'three-white-soldiers',
  label: 'Three White Soldiers',
  category: 'reversal-multi',
  sentiment: 'bullish',
  bars: 3,
  params: [],
  constraints: [
    "direction(b2) = 'up'",
    "direction(b1) = 'up'",
    "direction(b0) = 'up'",
    'open(b1) > open(b2)',
    'open(b1) < close(b2)',
    'open(b0) > open(b1)',
    'open(b0) < close(b1)',
    'close(b0) > close(b1)',
    'close(b1) > close(b2)',
  ],
  description: 'Three consecutive bull bars each opening inside the prior body and closing higher. Strong bullish continuation/reversal.',
};
