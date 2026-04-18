import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import type { MutableRefObject } from 'react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { BackendExecution } from '../useOrderLinesRenderer';
import type { useOrderDragHandler } from '../useOrderDragHandler';
import type { useSlTpPlacementMode } from '@renderer/hooks/useSlTpPlacementMode';
import type { UseChartBaseRenderersResult } from './useChartBaseRenderers';
import type { UseChartIndicatorRenderersResult } from './useChartIndicatorRenderers';
import type { UseGenericChartIndicatorRenderersResult } from './useGenericChartIndicatorRenderers';
import type { ChartColors } from '@renderer/hooks/useChartColors';
import { renderDragPreview, renderSlTpPreview, renderTsPreview, renderOrderPreview } from './chartPreviewRenderers';

export interface UseChartRenderPipelineProps {
  manager: CanvasManager | null;
  chartType: string;
  colors: ChartColors;
  allExecutions: BackendExecution[];
  baseRenderers: UseChartBaseRenderersResult;
  indicatorRenderers: UseChartIndicatorRenderersResult;
  genericRenderers: UseGenericChartIndicatorRenderersResult;
  renderOrderLines: () => void;
  renderGridPreview: () => void;
  renderDrawings: () => void;
  orderDragHandler: ReturnType<typeof useOrderDragHandler>;
  slTpPlacement: ReturnType<typeof useSlTpPlacementMode>;
  tsPlacementActive: boolean;
  tsPlacementPreviewPrice: number | null;
  orderPreviewRef: MutableRefObject<{ price: number; type: 'long' | 'short' } | null>;
}

export const useChartRenderPipeline = ({
  manager,
  chartType,
  colors: _colors,
  allExecutions,
  baseRenderers,
  indicatorRenderers,
  genericRenderers,
  renderOrderLines,
  renderGridPreview,
  renderDrawings,
  orderDragHandler,
  slTpPlacement,
  tsPlacementActive,
  tsPlacementPreviewPrice,
  orderPreviewRef,
}: UseChartRenderPipelineProps): void => {
  const { t } = useTranslation();

  const {
    renderGrid,
    renderKlines,
    renderLineChart,
    renderVolume,
    renderCurrentPriceLine_Line,
    renderCurrentPriceLine_Label,
    renderCrosshairPriceLine,
    renderWatermark,
  } = baseRenderers;

  const {
    renderFibonacci,
    renderFVG,
    renderLiquidityLevels,
    renderEventScale,
    renderCVD,
    renderImbalance,
    renderVolumeProfile,
    renderFootprint,
  } = indicatorRenderers;

  const { renderAllOverlayIndicators, renderAllPanelIndicators, renderAllCustomIndicators } = genericRenderers;

  useEffect(() => {
    if (!manager) return;

    const render = (): void => {
      manager.clear();
      renderWatermark();
      renderGrid();
      renderAllCustomIndicators();
      renderVolume();
      if (chartType === 'kline' || chartType === 'tick' || chartType === 'volume' || chartType === 'footprint') {
        renderKlines();
      } else {
        renderLineChart();
      }
      renderAllOverlayIndicators();
      renderDrawings();
      renderFibonacci();
      renderFVG();
      renderLiquidityLevels();
      renderEventScale();
      renderAllPanelIndicators();
      renderCVD();
      renderImbalance();
      renderVolumeProfile();
      if (chartType === 'footprint') renderFootprint();
      renderCurrentPriceLine_Line();
      renderOrderLines();
      renderGridPreview();

      renderDragPreview(manager, orderDragHandler, t);
      renderSlTpPreview(manager, slTpPlacement, allExecutions);
      renderTsPreview(manager, tsPlacementActive, tsPlacementPreviewPrice);

      renderCurrentPriceLine_Label();
      renderCrosshairPriceLine();

      renderOrderPreview(manager, orderPreviewRef, t);
    };

    const renderWithDirtyFlagCleanup = () => {
      render();
      manager.clearDirtyFlags();
    };

    manager.setRenderCallback(renderWithDirtyFlagCleanup);

    return () => {
      manager.setRenderCallback(null);
    };
  }, [
    manager,
    renderWatermark,
    renderGrid,
    renderVolume,
    renderKlines,
    renderLineChart,
    renderAllOverlayIndicators,
    renderAllPanelIndicators,
    renderAllCustomIndicators,
    renderFibonacci,
    renderFVG,
    renderLiquidityLevels,
    renderEventScale,
    renderCVD,
    renderImbalance,
    renderVolumeProfile,
    renderFootprint,
    renderCurrentPriceLine_Line,
    renderCurrentPriceLine_Label,
    renderCrosshairPriceLine,
    renderOrderLines,
    renderGridPreview,
    renderDrawings,
    chartType,
    allExecutions,
    orderDragHandler,
    slTpPlacement,
    tsPlacementActive,
    tsPlacementPreviewPrice,
    t,
  ]);
};
