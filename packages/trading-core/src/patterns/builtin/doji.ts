import type { PatternDefinition } from '../types';

export const DOJI: PatternDefinition = {
  id: 'doji',
  label: 'Doji',
  category: 'indecision',
  sentiment: 'neutral',
  bars: 1,
  params: [
    { key: 'maxBodyRatio', label: 'Max body / range', type: 'number', default: 0.05, min: 0.01, max: 0.15, step: 0.01 },
  ],
  constraints: [
    'range(b0) > 0',
    'body(b0) <= params.maxBodyRatio * range(b0)',
  ],
  description: 'Open and close are virtually equal. Indecision — strongest as a reversal hint after a directional move.',
};
