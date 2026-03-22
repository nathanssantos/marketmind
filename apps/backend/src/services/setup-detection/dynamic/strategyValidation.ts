import type {
  StrategyValidationResult,
  StrategyValidationError,
} from '@marketmind/types';

const VALID_INDICATOR_TYPES = [
  'sma',
  'ema',
  'rsi',
  'macd',
  'bollingerBands',
  'atr',
  'stochastic',
  'vwap',
  'pivotPoints',
  'adx',
  'obv',
  'williamsR',
  'cci',
  'mfi',
  'donchian',
  'keltner',
  'supertrend',
  'ibs',
  'percentB',
  'cumulativeRsi',
  'nDayHighLow',
  'nr7',
  'roc',
  'dema',
  'tema',
  'wma',
  'hma',
  'cmo',
  'ao',
  'ppo',
  'tsi',
  'ultimateOscillator',
  'aroon',
  'dmi',
  'vortex',
  'parabolicSar',
  'massIndex',
  'cmf',
  'klinger',
  'elderRay',
  'deltaVolume',
  'swingPoints',
  'fvg',
  'gapDetection',
  'fibonacci',
  'floorPivots',
  'liquidityLevels',
  'fundingRate',
  'openInterest',
  'liquidations',
  'btcDominance',
  'relativeStrength',
  'highest',
  'lowest',
];

const VALID_EXIT_LEVEL_TYPES = ['atr', 'percent', 'fixed', 'indicator', 'riskReward', 'swingHighLow', 'pivotBased'];

export const validateRequired = (
  obj: Record<string, unknown>,
  field: string,
  expectedType: string,
  errors: StrategyValidationError[]
): void => {
  if (obj[field] === undefined) {
    errors.push({
      path: field,
      message: `Missing required field: ${field}`,
      severity: 'error',
    });
  } else if (typeof obj[field] !== expectedType) {
    errors.push({
      path: field,
      message: `${field} must be a ${expectedType}`,
      severity: 'error',
    });
  }
};

export const validateIndicators = (
  indicators: Record<string, unknown>,
  errors: StrategyValidationError[],
  warnings: StrategyValidationError[]
): void => {
  for (const [id, indicator] of Object.entries(indicators)) {
    if (!indicator || typeof indicator !== 'object') {
      errors.push({
        path: `indicators.${id}`,
        message: 'Indicator must be an object',
        severity: 'error',
      });
      continue;
    }

    const ind = indicator as Record<string, unknown>;

    if (!ind['type'] || typeof ind['type'] !== 'string') {
      errors.push({
        path: `indicators.${id}.type`,
        message: 'Indicator type is required',
        severity: 'error',
      });
    } else if (!VALID_INDICATOR_TYPES.includes(ind['type'])) {
      errors.push({
        path: `indicators.${id}.type`,
        message: `Unknown indicator type: ${ind['type']}. Valid types: ${VALID_INDICATOR_TYPES.join(', ')}`,
        severity: 'error',
      });
    }

    if (!ind['params'] || typeof ind['params'] !== 'object') {
      warnings.push({
        path: `indicators.${id}.params`,
        message: 'Indicator params should be an object',
        severity: 'warning',
      });
    }
  }
};

export const validateConditionGroup = (
  group: unknown,
  path: string,
  errors: StrategyValidationError[]
): void => {
  if (!group || typeof group !== 'object') {
    errors.push({
      path,
      message: 'Condition group must be an object',
      severity: 'error',
    });
    return;
  }

  const g = group as Record<string, unknown>;

  if (!g['operator'] || !['AND', 'OR'].includes(g['operator'] as string)) {
    errors.push({
      path: `${path}.operator`,
      message: 'Condition group operator must be "AND" or "OR"',
      severity: 'error',
    });
  }

  if (!Array.isArray(g['conditions']) || g['conditions'].length === 0) {
    errors.push({
      path: `${path}.conditions`,
      message: 'Condition group must have at least one condition',
      severity: 'error',
    });
  }
};

export const validateEntry = (
  entry: Record<string, unknown>,
  errors: StrategyValidationError[]
): void => {
  if (!entry['long'] && !entry['short']) {
    errors.push({
      path: 'entry',
      message: 'At least one of entry.long or entry.short is required',
      severity: 'error',
    });
  }

  if (entry['long']) {
    validateConditionGroup(entry['long'], 'entry.long', errors);
  }

  if (entry['short']) {
    validateConditionGroup(entry['short'], 'entry.short', errors);
  }
};

export const validateExitLevel = (
  level: unknown,
  path: string,
  errors: StrategyValidationError[]
): void => {
  if (!level || typeof level !== 'object') {
    errors.push({
      path,
      message: 'Exit level must be an object',
      severity: 'error',
    });
    return;
  }

  const l = level as Record<string, unknown>;

  if (!l['type'] || !VALID_EXIT_LEVEL_TYPES.includes(l['type'] as string)) {
    errors.push({
      path: `${path}.type`,
      message: `Exit level type must be one of: ${VALID_EXIT_LEVEL_TYPES.join(', ')}`,
      severity: 'error',
    });
  }
};

export const validateExitConditions = (
  conditions: unknown,
  errors: StrategyValidationError[]
): void => {
  if (!conditions || typeof conditions !== 'object') {
    errors.push({
      path: 'exit.conditions',
      message: 'exit.conditions must be an object',
      severity: 'error',
    });
    return;
  }

  const cond = conditions as Record<string, unknown>;

  if (!cond['long'] && !cond['short']) {
    errors.push({
      path: 'exit.conditions',
      message: 'exit.conditions must have at least long or short',
      severity: 'error',
    });
  }

  if (cond['long']) {
    validateConditionGroup(cond['long'], 'exit.conditions.long', errors);
  }

  if (cond['short']) {
    validateConditionGroup(cond['short'], 'exit.conditions.short', errors);
  }
};

export const validateExit = (
  exit: Record<string, unknown>,
  errors: StrategyValidationError[]
): void => {
  const hasStopLoss = !!exit['stopLoss'];
  const hasTakeProfit = !!exit['takeProfit'];
  const hasConditions = !!exit['conditions'];

  if (!hasStopLoss && !hasConditions) {
    errors.push({
      path: 'exit',
      message: 'exit must have either stopLoss or conditions (or both)',
      severity: 'error',
    });
  }

  if (!hasTakeProfit && !hasConditions) {
    errors.push({
      path: 'exit',
      message: 'exit must have either takeProfit or conditions (or both)',
      severity: 'error',
    });
  }

  if (hasStopLoss) {
    validateExitLevel(exit['stopLoss'], 'exit.stopLoss', errors);
  }

  if (hasTakeProfit) {
    validateExitLevel(exit['takeProfit'], 'exit.takeProfit', errors);
  }

  if (hasConditions) {
    validateExitConditions(exit['conditions'], errors);
  }
};

export const validateStrategyDefinition = (definition: unknown): StrategyValidationResult => {
  const errors: StrategyValidationError[] = [];
  const warnings: StrategyValidationError[] = [];

  if (!definition || typeof definition !== 'object') {
    errors.push({
      path: '',
      message: 'Strategy must be an object',
      severity: 'error',
    });
    return { valid: false, errors, warnings };
  }

  const def = definition as Record<string, unknown>;

  validateRequired(def, 'id', 'string', errors);
  validateRequired(def, 'name', 'string', errors);
  validateRequired(def, 'version', 'string', errors);
  validateRequired(def, 'parameters', 'object', errors);
  validateRequired(def, 'indicators', 'object', errors);
  validateRequired(def, 'entry', 'object', errors);
  validateRequired(def, 'exit', 'object', errors);

  if (typeof def['id'] === 'string' && !/^[a-z0-9-]+$/.test(def['id'])) {
    errors.push({
      path: 'id',
      message: 'ID must be kebab-case (lowercase letters, numbers, hyphens)',
      severity: 'error',
    });
  }

  if (typeof def['version'] === 'string' && !/^\d+\.\d+\.\d+$/.test(def['version'])) {
    warnings.push({
      path: 'version',
      message: 'Version should follow semantic versioning (e.g., 1.0.0)',
      severity: 'warning',
    });
  }

  if (def['indicators'] && typeof def['indicators'] === 'object') {
    validateIndicators(
      def['indicators'] as Record<string, unknown>,
      errors,
      warnings
    );
  }

  if (def['entry'] && typeof def['entry'] === 'object') {
    validateEntry(def['entry'] as Record<string, unknown>, errors);
  }

  if (def['exit'] && typeof def['exit'] === 'object') {
    validateExit(def['exit'] as Record<string, unknown>, errors);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
};
