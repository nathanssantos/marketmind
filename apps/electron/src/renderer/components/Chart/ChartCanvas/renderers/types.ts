import type { IndicatorDefinition, IndicatorParamValue, RenderKind } from '@marketmind/trading-core';
import type { FootprintBar, LiquidityHeatmapSnapshot, MarketEvent } from '@marketmind/types';
import type { ChartThemeColors } from '@renderer/hooks/useChartColors';
import type { IndicatorInstance } from '@renderer/store/indicatorStore';
import type { LiquidityColorMode } from '@renderer/components/Chart/liquidityLUTs';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';

export type IndicatorValueSeries = (number | null | undefined)[];

export interface GenericRendererExternal {
  marketEvents?: MarketEvent[];
  footprintBars?: FootprintBar[];
  liquidityHeatmap?: LiquidityHeatmapSnapshot | null;
  liquidityColorMode?: LiquidityColorMode;
  timeframe?: string;
  hoveredKlineIndex?: number;
  volumeHeightRatio?: number;
}

export interface GenericRendererCtx {
  manager: CanvasManager;
  colors: ChartThemeColors;
  external?: GenericRendererExternal;
}

export interface GenericRendererInput {
  instance: IndicatorInstance;
  definition: IndicatorDefinition;
  values: Record<string, IndicatorValueSeries>;
}

export type GenericRenderer = (ctx: GenericRendererCtx, input: GenericRendererInput) => void;

export type RendererRegistry = Partial<Record<RenderKind, GenericRenderer>>;

export const getInstanceParam = <T extends IndicatorParamValue>(
  instance: IndicatorInstance,
  definition: IndicatorDefinition,
  key: string,
): T | undefined => {
  const value = instance.params[key];
  if (value !== undefined) return value as T;
  const schema = definition.params.find((p) => p.key === key);
  return schema ? (schema.default as T) : undefined;
};
