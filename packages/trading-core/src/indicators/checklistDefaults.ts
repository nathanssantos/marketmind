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

export const DEFAULT_CHECKLIST_TEMPLATE: ChecklistTemplateEntry[] = [
  { seedLabel: 'EMA 200', timeframe: 'current', op: 'priceAbove', tier: 'preferred', side: 'LONG', weight: 1.5, enabled: false, order: 0 },
  { seedLabel: 'EMA 200', timeframe: 'current', op: 'priceBelow', tier: 'preferred', side: 'SHORT', weight: 1.5, enabled: false, order: 1 },
  { seedLabel: 'EMA 21', timeframe: 'current', op: 'priceAbove', tier: 'preferred', side: 'LONG', weight: 1, enabled: false, order: 2 },
  { seedLabel: 'EMA 21', timeframe: 'current', op: 'priceBelow', tier: 'preferred', side: 'SHORT', weight: 1, enabled: false, order: 3 },
  { seedLabel: 'RSI 14', timeframe: 'current', op: 'oversold', tier: 'preferred', side: 'LONG', weight: 1, enabled: false, order: 4 },
  { seedLabel: 'RSI 14', timeframe: 'current', op: 'overbought', tier: 'preferred', side: 'SHORT', weight: 1, enabled: false, order: 5 },
  { seedLabel: 'RSI 14', timeframe: '15m', op: 'oversold', tier: 'preferred', side: 'LONG', weight: 1, enabled: false, order: 6 },
  { seedLabel: 'RSI 14', timeframe: '15m', op: 'overbought', tier: 'preferred', side: 'SHORT', weight: 1, enabled: false, order: 7 },
  { seedLabel: 'RSI 14', timeframe: '1h', op: 'oversold', tier: 'preferred', side: 'LONG', weight: 1.5, enabled: false, order: 8 },
  { seedLabel: 'RSI 14', timeframe: '1h', op: 'overbought', tier: 'preferred', side: 'SHORT', weight: 1.5, enabled: false, order: 9 },
  { seedLabel: 'RSI 14', timeframe: '4h', op: 'oversold', tier: 'preferred', side: 'LONG', weight: 2, enabled: false, order: 10 },
  { seedLabel: 'RSI 14', timeframe: '4h', op: 'overbought', tier: 'preferred', side: 'SHORT', weight: 2, enabled: false, order: 11 },
  { seedLabel: 'Stoch 14', timeframe: 'current', op: 'oversold', tier: 'preferred', side: 'LONG', weight: 0.75, enabled: false, order: 12 },
  { seedLabel: 'Stoch 14', timeframe: 'current', op: 'overbought', tier: 'preferred', side: 'SHORT', weight: 0.75, enabled: false, order: 13 },
  { seedLabel: 'Stoch 14', timeframe: '15m', op: 'oversold', tier: 'preferred', side: 'LONG', weight: 0.75, enabled: false, order: 14 },
  { seedLabel: 'Stoch 14', timeframe: '15m', op: 'overbought', tier: 'preferred', side: 'SHORT', weight: 0.75, enabled: false, order: 15 },
  { seedLabel: 'Stoch 14', timeframe: '1h', op: 'oversold', tier: 'preferred', side: 'LONG', weight: 1.25, enabled: false, order: 16 },
  { seedLabel: 'Stoch 14', timeframe: '1h', op: 'overbought', tier: 'preferred', side: 'SHORT', weight: 1.25, enabled: false, order: 17 },
  { seedLabel: 'Stoch 14', timeframe: '4h', op: 'oversold', tier: 'preferred', side: 'LONG', weight: 1.75, enabled: false, order: 18 },
  { seedLabel: 'Stoch 14', timeframe: '4h', op: 'overbought', tier: 'preferred', side: 'SHORT', weight: 1.75, enabled: false, order: 19 },
  { seedLabel: 'Volume', timeframe: '1h', op: 'rising', tier: 'preferred', side: 'BOTH', weight: 1.5, enabled: false, order: 20 },
];
