import type { ConditionOp, ConditionThreshold } from './types';

export interface ChecklistTemplateEntry {
  seedLabel: string;
  timeframe: string;
  op: ConditionOp;
  threshold?: ConditionThreshold;
  tier: 'required' | 'preferred';
  side: 'LONG' | 'SHORT' | 'BOTH';
  enabled: boolean;
  order: number;
}

export const DEFAULT_CHECKLIST_TEMPLATE: ChecklistTemplateEntry[] = [
  {
    seedLabel: 'ADX 14',
    timeframe: 'current',
    op: 'gt',
    threshold: 25,
    tier: 'required',
    side: 'BOTH',
    enabled: true,
    order: 0,
  },
  {
    seedLabel: 'EMA 21',
    timeframe: 'current',
    op: 'priceAbove',
    tier: 'required',
    side: 'LONG',
    enabled: true,
    order: 1,
  },
  {
    seedLabel: 'EMA 21',
    timeframe: 'current',
    op: 'priceBelow',
    tier: 'required',
    side: 'SHORT',
    enabled: true,
    order: 2,
  },
  {
    seedLabel: 'CHOP 14',
    timeframe: 'current',
    op: 'lt',
    threshold: 61.8,
    tier: 'required',
    side: 'BOTH',
    enabled: true,
    order: 3,
  },
  {
    seedLabel: 'VWAP',
    timeframe: 'current',
    op: 'priceAbove',
    tier: 'required',
    side: 'LONG',
    enabled: true,
    order: 4,
  },
  {
    seedLabel: 'VWAP',
    timeframe: 'current',
    op: 'priceBelow',
    tier: 'required',
    side: 'SHORT',
    enabled: true,
    order: 5,
  },
];
