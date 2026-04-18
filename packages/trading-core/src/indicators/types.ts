export type ParamType = 'number' | 'integer' | 'select' | 'color' | 'boolean';

export type RenderKind =
  | 'overlay-line'
  | 'overlay-bands'
  | 'overlay-points'
  | 'pane-line'
  | 'pane-histogram'
  | 'pane-multi'
  | 'custom';

export type ConditionOp =
  | 'gt'
  | 'lt'
  | 'between'
  | 'outside'
  | 'crossAbove'
  | 'crossBelow'
  | 'oversold'
  | 'overbought'
  | 'rising'
  | 'falling';

export type IndicatorCategory =
  | 'oscillators'
  | 'momentum'
  | 'trend'
  | 'volatility'
  | 'volume'
  | 'movingAverages'
  | 'priceStructure'
  | 'orderFlow';

export type IndicatorParamValue = number | string | boolean;

export interface ParamOption {
  value: string | number;
  labelKey: string;
}

export interface ParamSchema {
  key: string;
  labelKey: string;
  type: ParamType;
  default: IndicatorParamValue;
  min?: number;
  max?: number;
  step?: number;
  options?: ParamOption[];
  cosmetic?: boolean;
}

export interface OutputSpec {
  key: string;
  labelKey: string;
}

export interface IndicatorRenderSpec {
  kind: RenderKind;
  paneId?: string;
  rendererId?: string;
}

export type ConditionThreshold = number | [number, number];

export interface IndicatorEvaluatorSpec {
  service: 'pine' | 'native';
  scriptId: string;
  outputKey?: string;
}

export interface IndicatorDefinition {
  type: string;
  labelKey: string;
  category: IndicatorCategory;
  params: ParamSchema[];
  outputs: OutputSpec[];
  render: IndicatorRenderSpec;
  conditionOps: ConditionOp[];
  valueRange?: { min: number; max: number };
  defaultThresholds?: Partial<Record<ConditionOp, ConditionThreshold>>;
  evaluator: IndicatorEvaluatorSpec;
  defaultLabel: (params: Record<string, IndicatorParamValue>) => string;
}

export interface UserIndicator {
  id: string;
  catalogType: string;
  label: string;
  params: Record<string, IndicatorParamValue>;
  isCustom: boolean;
}

export interface ChecklistCondition {
  id: string;
  userIndicatorId: string;
  timeframe: string;
  op: ConditionOp;
  threshold?: ConditionThreshold;
  tier: 'required' | 'preferred';
  side: 'LONG' | 'SHORT' | 'BOTH';
  enabled: boolean;
  order: number;
}

export interface ConditionEvaluationResult {
  passed: boolean;
  value: number | null;
}

export interface ChecklistScoreBreakdown {
  requiredTotal: number;
  requiredPassed: number;
  preferredTotal: number;
  preferredPassed: number;
  score: number;
  requiredAllPassed: boolean;
}
