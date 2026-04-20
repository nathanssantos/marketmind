import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import type { MutableRefObject } from 'react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { BackendExecution } from '../useOrderLinesRenderer';
import type { useOrderDragHandler } from '../useOrderDragHandler';
import type { useSlTpPlacementMode } from '@renderer/hooks/useSlTpPlacementMode';
import type { UseChartBaseRenderersResult } from './useChartBaseRenderers';
import type { UseGenericChartIndicatorRenderersResult } from './useGenericChartIndicatorRenderers';
import type { ChartColors } from '@renderer/hooks/useChartColors';
import { renderDragPreview, renderSlTpPreview, renderTsPreview, renderOrderPreview } from './chartPreviewRenderers';
import { perfMonitor } from '@renderer/utils/canvas/perfMonitor';

const timed = <T>(section: string, fn: () => T): T => {
  const ts = perfMonitor.mark();
  const result = fn();
  perfMonitor.measure(section, ts);
  return result;
};

export interface UseChartRenderPipelineProps {
  manager: CanvasManager | null;
  chartType: string;
  colors: ChartColors;
  allExecutions: BackendExecution[];
  baseRenderers: UseChartBaseRenderersResult;
  genericRenderers: UseGenericChartIndicatorRenderersResult;
  renderOrderLines: () => void;
  renderGridPreview: () => void;
  renderDrawings: () => void;
  renderEventScale: () => void;
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
  genericRenderers,
  renderOrderLines,
  renderGridPreview,
  renderDrawings,
  renderEventScale,
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
    renderCurrentPriceLine_Line,
    renderCurrentPriceLine_Label,
    renderCrosshairPriceLine,
    renderWatermark,
  } = baseRenderers;

  const { renderAllOverlayIndicators, renderAllPanelIndicators, renderAllCustomIndicators } = genericRenderers;

  useEffect(() => {
    if (!manager) return;

    const render = (): void => {
      timed('clear', () => manager.clear());
      timed('watermark', renderWatermark);
      timed('grid', renderGrid);
      timed('customIndicators', renderAllCustomIndicators);
      if (chartType === 'kline' || chartType === 'tick' || chartType === 'volume' || chartType === 'footprint') {
        timed('klines', renderKlines);
      } else {
        timed('lineChart', renderLineChart);
      }
      timed('overlayIndicators', renderAllOverlayIndicators);
      timed('drawings', renderDrawings);
      timed('eventScale', renderEventScale);
      timed('panelIndicators', renderAllPanelIndicators);
      timed('currentPriceLine', renderCurrentPriceLine_Line);
      timed('orderLines', renderOrderLines);
      timed('gridPreview', renderGridPreview);

      timed('previews', () => {
        renderDragPreview(manager, orderDragHandler, t);
        renderSlTpPreview(manager, slTpPlacement, allExecutions);
        renderTsPreview(manager, tsPlacementActive, tsPlacementPreviewPrice);
      });

      timed('currentPriceLabel', renderCurrentPriceLine_Label);
      timed('crosshair', renderCrosshairPriceLine);

      timed('orderPreview', () => renderOrderPreview(manager, orderPreviewRef, t));
    };

    const renderWithDirtyFlagCleanup = () => {
      const frameTs = perfMonitor.beginFrame();
      render();
      manager.clearDirtyFlags();
      perfMonitor.endFrame(frameTs);
    };

    manager.setRenderCallback(renderWithDirtyFlagCleanup);

    return () => {
      manager.setRenderCallback(null);
    };
  }, [
    manager,
    renderWatermark,
    renderGrid,
    renderKlines,
    renderLineChart,
    renderAllOverlayIndicators,
    renderAllPanelIndicators,
    renderAllCustomIndicators,
    renderCurrentPriceLine_Line,
    renderCurrentPriceLine_Label,
    renderCrosshairPriceLine,
    renderOrderLines,
    renderGridPreview,
    renderDrawings,
    renderEventScale,
    chartType,
    allExecutions,
    orderDragHandler,
    slTpPlacement,
    tsPlacementActive,
    tsPlacementPreviewPrice,
    t,
  ]);
};
