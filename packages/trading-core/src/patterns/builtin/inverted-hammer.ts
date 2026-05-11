import type { PatternDefinition } from '../types';

export const INVERTED_HAMMER: PatternDefinition = {
  id: 'inverted-hammer',
  label: 'Inverted Hammer',
  category: 'reversal-single',
  sentiment: 'bullish',
  bars: 1,
  params: [
    { key: 'wickRatio', label: 'Min upper wick / body', type: 'number', default: 2.0, min: 1.5, max: 4.0, step: 0.1 },
    { key: 'bottomWickRatio', label: 'Max lower wick / body', type: 'number', default: 0.3, min: 0.0, max: 1.0, step: 0.05 },
  ],
  constraints: [
    'body(b0) > 0',
    'upperWick(b0) >= params.wickRatio * body(b0)',
    'lowerWick(b0) <= params.bottomWickRatio * body(b0)',
  ],
  description: 'Long upper wick, small body near the bottom, marginal lower wick. Bullish reversal context required (downtrend).',
};
