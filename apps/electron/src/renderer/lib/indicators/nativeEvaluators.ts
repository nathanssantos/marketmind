import type {
  Kline,
  LiquidityHeatmapSnapshot,
  MarketEvent,
} from '@marketmind/types';
import type { IndicatorParamValue } from '@marketmind/trading-core';
import { NATIVE_SERIES_EVALUATORS } from '@marketmind/trading-core';

export type NativeEvaluatorOutput = Record<string, (number | null)[]>;

export interface NativeEvaluatorContext {
  marketEvents?: MarketEvent[];
  liquidityHeatmap?: LiquidityHeatmapSnapshot | null;
  intervalMinutes?: number;
}

export type NativeEvaluator = (
  klines: Kline[],
  params: Record<string, IndicatorParamValue>,
  ctx?: NativeEvaluatorContext,
) => NativeEvaluatorOutput;

const renderOnly: NativeEvaluator = (klines) => ({ rendered: new Array(klines.length).fill(null) });

export const NATIVE_EVALUATORS: Record<string, NativeEvaluator> = {
  ...NATIVE_SERIES_EVALUATORS,

  volumeProfile: renderOnly,
  orb: renderOnly,
  sessionBoundaries: renderOnly,
  footprint: renderOnly,
  liquidityHeatmap: renderOnly,
  liquidationMarkers: renderOnly,
  fibonacci: renderOnly,
  fvg: renderOnly,
  liquidityLevels: renderOnly,
};

export const hasNativeEvaluator = (scriptId: string): boolean =>
  Object.prototype.hasOwnProperty.call(NATIVE_EVALUATORS, scriptId);

export const getNativeEvaluator = (scriptId: string): NativeEvaluator | undefined =>
  NATIVE_EVALUATORS[scriptId];
