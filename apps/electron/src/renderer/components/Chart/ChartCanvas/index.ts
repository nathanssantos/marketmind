export { useChartState, useCursorManager } from './useChartState';
export type {
  TooltipData,
  OrderPreview,
  ChartState,
  UseChartStateProps,
  UseChartStateResult,
  CursorManager,
} from './useChartState';

export { useChartIndicators } from './useChartIndicators';
export type {
  IndicatorId,
  UseChartIndicatorsProps,
  UseChartIndicatorsResult,
} from './useChartIndicators';

export {
  useChartRendering,
  useLayerDirtyTracking,
  useOffscreenCache,
  useAnimationFrame,
  useThrottledRender,
} from './useChartRendering';
export type {
  RenderLayerId,
  RenderLayer,
  UseChartRenderingProps,
  UseChartRenderingResult,
  LayerDirtyState,
  OffscreenCacheEntry,
} from './useChartRendering';

export { useChartPanelHeights } from './useChartPanelHeights';
export type { UseChartPanelHeightsProps, PanelIndicatorId } from './useChartPanelHeights';

export { useChartBaseRenderers } from './useChartBaseRenderers';
export type {
  UseChartBaseRenderersProps,
  UseChartBaseRenderersResult,
} from './useChartBaseRenderers';

export { useChartIndicatorRenderers } from './useChartIndicatorRenderers';
export type {
  UseChartIndicatorRenderersProps,
  UseChartIndicatorRenderersResult,
} from './useChartIndicatorRenderers';

export { useChartInteraction } from './useChartInteraction';
export type {
  UseChartInteractionProps,
  UseChartInteractionResult,
} from './useChartInteraction';

export {
  useLayerCache,
  shouldRerenderStatic,
  shouldRerenderData,
  shouldRerenderIndicators,
  shouldRerenderOverlays,
} from './useLayerCache';
export type {
  LayerCacheId,
  LayerCacheEntry,
  LayerCacheState,
  UseLayerCacheProps,
  UseLayerCacheResult,
} from './useLayerCache';

export {
  useVirtualizedKlines,
  getVisibleRange,
  isKlineVisible,
  calculateOptimalBuffer,
} from './useVirtualizedKlines';
export type {
  VirtualizedKlinesResult,
  UseVirtualizedKlinesProps,
} from './useVirtualizedKlines';

export {
  useRenderLoop,
  createFrameLimiter,
  measureRenderTime,
  batchRenders,
} from './useRenderLoop';
export type {
  RenderLoopStats,
  UseRenderLoopProps,
  UseRenderLoopResult,
} from './useRenderLoop';

export { useTouchGestures, isTouchDevice } from './useTouchGestures';
export type {
  UseTouchGesturesProps,
  UseTouchGesturesResult,
} from './useTouchGestures';

export { useKeyboardNavigation, KEYBOARD_SHORTCUTS } from './useKeyboardNavigation';
export type {
  UseKeyboardNavigationProps,
  UseKeyboardNavigationResult,
} from './useKeyboardNavigation';

export { useOptimizedRendering } from './useOptimizedRendering';
export type {
  UseOptimizedRenderingProps,
  UseOptimizedRenderingResult,
} from './useOptimizedRendering';

export {
  createBackgroundLayer,
  createDataLayer,
  createIndicatorLayer,
  createOverlayLayer,
  getIndicatorRenderOrder,
} from './layers';
export type {
  BackgroundLayerProps,
  BackgroundLayerResult,
  DataLayerProps,
  DataLayerResult,
  IndicatorLayerProps,
  IndicatorLayerResult,
  IndicatorRenderFunctions,
  OverlayLayerProps,
  OverlayLayerResult,
  OverlayRenderFunctions,
} from './layers';
