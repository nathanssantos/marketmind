import type { PatternDefinition } from '../types';

export const HAMMER: PatternDefinition = {
  id: 'hammer',
  label: 'Hammer',
  category: 'reversal-single',
  sentiment: 'bullish',
  bars: 1,
  params: [
    { key: 'wickRatio', label: 'Min lower wick / body', type: 'number', default: 2.0, min: 1.5, max: 4.0, step: 0.1 },
    { key: 'topWickRatio', label: 'Max upper wick / body', type: 'number', default: 0.3, min: 0.0, max: 1.0, step: 0.05 },
  ],
  constraints: [
    'body(b0) > 0',
    'lowerWick(b0) >= params.wickRatio * body(b0)',
    'upperWick(b0) <= params.topWickRatio * body(b0)',
  ],
  description: 'Long lower wick, small body near the top, marginal upper wick. Bullish reversal at support.',
};
