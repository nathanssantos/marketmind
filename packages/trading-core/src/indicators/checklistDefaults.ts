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
//   Indicator base (period-2 oscillators are fast + tight-extreme + premium-weighted):
//     RSI 14 / Stoch 14 = base 1.0
//     RSI 2  / Stoch 2  = base 2.0
//
// Stoch 14 / Stoch 2 cover the full 1m..1d ladder (good for scalping signals).
// RSI 14 / RSI 2 cover only the 15m..1d ladder — RSI on 1m/5m is too noisy to
// be useful as a confirmation signal in this strategy. This keeps the lower
// timeframes specifically targeted at the fast-oscillator family.
const TF_WEIGHTS = {
  '1m': -0.75,
  '5m': -0.5,
  '15m': 0,
  '1h': 0.5,
  '4h': 1.0,
  '1d': 1.5,
} as const;

const SLOW_TFS = ['15m', '1h', '4h', '1d'] as const;
const FULL_TFS = ['1m', '5m', '15m', '1h', '4h', '1d'] as const;

// Thresholds — period-2 oscillators get tight extremes (7/93) because they're
// fast and noisy without them; the tight bound is what makes the high weight
// usable across TFs. RSI 14 and Stoch 14 use `undefined` so the evaluator
// falls back to the catalog default (20/80 of valueRange — classic 20/80 on
// the 0-100 scale).
type IndicatorSpec = {
  seedLabel: string;
  base: number;
  oversold?: number;
  overbought?: number;
  timeframes: readonly string[];
};
const INDICATORS: IndicatorSpec[] = [
  { seedLabel: 'RSI 14', base: 1.0, timeframes: SLOW_TFS },
  { seedLabel: 'RSI 2', base: 2.0, oversold: 7, overbought: 93, timeframes: SLOW_TFS },
  { seedLabel: 'Stoch 14', base: 1.0, timeframes: FULL_TFS },
  { seedLabel: 'Stoch 2', base: 2.0, oversold: 7, overbought: 93, timeframes: FULL_TFS },
];

const buildTemplate = (): ChecklistTemplateEntry[] => {
  const out: ChecklistTemplateEntry[] = [];
  let order = 0;
  for (const ind of INDICATORS) {
    for (const tf of ind.timeframes) {
      const weight = ind.base + TF_WEIGHTS[tf as keyof typeof TF_WEIGHTS];
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
