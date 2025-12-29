export const ENABLED_STRATEGIES = [
  'keltner-breakout-optimized',
  'bollinger-breakout-crypto',
  'larry-williams-9-1',
  'larry-williams-9-2',
  'larry-williams-9-3',
  'larry-williams-9-4',
  'williams-momentum',
  'tema-momentum',
  'elder-ray-crypto',
  'ppo-momentum',
  'parabolic-sar-crypto',
  'supertrend-follow',
  'percent-b-connors',
  'triple-confirmation-reversal',
  'momentum-rotation',
  'momentum-breakout-2025',
  'stochastic-double-touch',
] as const;

export type EnabledStrategy = (typeof ENABLED_STRATEGIES)[number];
