import type { PatternDefinition } from '../types';

export const DARK_CLOUD_COVER: PatternDefinition = {
  id: 'dark-cloud-cover',
  label: 'Dark Cloud Cover',
  category: 'reversal-multi',
  sentiment: 'bearish',
  bars: 2,
  params: [],
  constraints: [
    "direction(b1) = 'up'",
    "direction(b0) = 'down'",
    'open(b0) > close(b1)',
    'close(b0) < (open(b1) + close(b1)) / 2',
    'close(b0) > open(b1)',
  ],
  description: 'Bear bar opens above the prior bull close and falls past its midpoint without closing below the prior open. Bearish reversal.',
};
