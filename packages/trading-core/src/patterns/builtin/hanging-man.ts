import type { PatternDefinition } from '../types';

export const HANGING_MAN: PatternDefinition = {
  id: 'hanging-man',
  label: 'Hanging Man',
  category: 'reversal-single',
  sentiment: 'bearish',
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
  description: 'Same shape as Hammer — long lower wick, small body, tiny upper wick — but appearing at the top of an uptrend signals exhaustion.',
};
