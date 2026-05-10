import type { PatternDefinition } from '../types';

export const SPINNING_TOP: PatternDefinition = {
  id: 'spinning-top',
  label: 'Spinning Top',
  category: 'indecision',
  sentiment: 'neutral',
  bars: 1,
  params: [
    { key: 'maxBodyRatio', label: 'Max body / range', type: 'number', default: 0.3, min: 0.1, max: 0.5, step: 0.05 },
    { key: 'minWickRatio', label: 'Min each-wick / body', type: 'number', default: 1.0, min: 0.5, max: 3.0, step: 0.1 },
  ],
  constraints: [
    'range(b0) > 0',
    'body(b0) > 0',
    'body(b0) <= params.maxBodyRatio * range(b0)',
    'upperWick(b0) >= params.minWickRatio * body(b0)',
    'lowerWick(b0) >= params.minWickRatio * body(b0)',
  ],
  description: 'Small body framed by long wicks on both sides. Indecision — buyers and sellers fought to a draw.',
};
