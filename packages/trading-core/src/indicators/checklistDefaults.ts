import type { ConditionOp, ConditionSide, ConditionThreshold, ConditionTier } from './types';

export interface ChecklistTemplateEntry {
  seedLabel: string;
  timeframe: string;
  op: ConditionOp;
  threshold?: ConditionThreshold;
  tier: ConditionTier;
  side: ConditionSide;
  weight: number;
  enabled: boolean;
  order: number;
}

// Weight matrix — drives both per-indicator importance and per-timeframe importance.
//   TF multipliers (higher TF = more confirmation weight, lower TF = noisier so smaller deltas):
//     1m=-0.75, 5m=-0.5, 15m=0, 1h=+0.5, 4h=+1.0, 1d=+1.5
//   Indicator base (RSI 2 is faster + premium-weighted in this strategy):
//     RSI 14 / Stoch 14 = base 1.0 → 0.25 / 0.5 / 1.0 / 1.5 / 2.0 / 2.5
//     RSI 2             = base 2.0 → 1.25 / 1.5 / 2.0 / 2.5 / 3.0 / 3.5
const TF_WEIGHTS = {
  '1m': -0.75,
  '5m': -0.5,
  '15m': 0,
  '1h': 0.5,
  '4h': 1.0,
  '1d': 1.5,
} as const;
const TIMEFRAMES = ['1m', '5m', '15m', '1h', '4h', '1d'] as const;

// Thresholds — RSI 2 gets tight extremes (7/93) because it's fast and noisy
// without them; the tight bound is what makes the high weight usable across
// TFs. RSI 14 and Stoch 14 use `undefined` so the evaluator falls back to the
// catalog default (20/80 of valueRange — classic 20/80 on the 0-100 scale).
type IndicatorSpec = {
  seedLabel: string;
  base: number;
  oversold?: number;
  overbought?: number;
};
const INDICATORS: IndicatorSpec[] = [
  { seedLabel: 'RSI 14', base: 1.0 },
  { seedLabel: 'RSI 2', base: 2.0, oversold: 7, overbought: 93 },
  { seedLabel: 'Stoch 14', base: 1.0 },
];

const buildTemplate = (): ChecklistTemplateEntry[] => {
  const out: ChecklistTemplateEntry[] = [];
  let order = 0;
  for (const ind of INDICATORS) {
    for (const tf of TIMEFRAMES) {
      const weight = ind.base + TF_WEIGHTS[tf];
      out.push({
        seedLabel: ind.seedLabel, timeframe: tf, op: 'oversold',
        threshold: ind.oversold,
        tier: 'preferred', side: 'LONG', weight, enabled: false, order: order++,
      });
      out.push({
        seedLabel: ind.seedLabel, timeframe: tf, op: 'overbought',
        threshold: ind.overbought,
        tier: 'preferred', side: 'SHORT', weight, enabled: false, order: order++,
      });
    }
  }
  return out;
};

export const DEFAULT_CHECKLIST_TEMPLATE: ChecklistTemplateEntry[] = buildTemplate();
