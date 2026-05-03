import type { IndicatorDefinition, IndicatorParamValue } from './types';

/**
 * Reserved keys inside `UserIndicator.params` for visual threshold
 * overrides. Prefixed with underscore to keep them out of the catalog's
 * compute-param namespace and to make them obvious as render-only
 * configuration when reading raw JSON.
 */
export const THRESHOLD_PARAM_KEYS = {
  oversold: '_thresholdOversold',
  overbought: '_thresholdOverbought',
} as const;

export interface OscillatorThresholds {
  oversold?: number;
  overbought?: number;
}

const readNumeric = (value: IndicatorParamValue | undefined): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const n = parseFloat(value);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
};

/**
 * Resolves the oversold / overbought thresholds an oscillator pane
 * should render, with user overrides taking precedence over the
 * catalog's defaults. Returns an empty object if the indicator has
 * neither user nor catalog thresholds — callers should treat that as
 * "no zones to draw".
 */
export const getEffectiveOscillatorThresholds = (
  definition: IndicatorDefinition,
  params: Record<string, IndicatorParamValue> | undefined,
): OscillatorThresholds => {
  const catalogOversold = typeof definition.defaultThresholds?.oversold === 'number'
    ? (definition.defaultThresholds.oversold as number)
    : undefined;
  const catalogOverbought = typeof definition.defaultThresholds?.overbought === 'number'
    ? (definition.defaultThresholds.overbought as number)
    : undefined;

  const userOversold = readNumeric(params?.[THRESHOLD_PARAM_KEYS.oversold]);
  const userOverbought = readNumeric(params?.[THRESHOLD_PARAM_KEYS.overbought]);

  return {
    oversold: userOversold ?? catalogOversold,
    overbought: userOverbought ?? catalogOverbought,
  };
};

/**
 * True when the catalog definition exposes both oversold AND overbought
 * defaults — used by the indicator config UI to decide whether to render
 * the threshold inputs at all (single-threshold indicators like ADX
 * don't fit the oversold/overbought UI shape).
 */
export const hasOscillatorThresholds = (definition: IndicatorDefinition): boolean =>
  typeof definition.defaultThresholds?.oversold === 'number' &&
  typeof definition.defaultThresholds?.overbought === 'number';
