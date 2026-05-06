import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import type { MutableRefObject } from 'react';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { BackendExecution } from '../useOrderLinesRenderer';
import type { useOrderDragHandler } from '../useOrderDragHandler';
import type { useSlTpPlacementMode } from '@renderer/hooks/useSlTpPlacementMode';
import type { UseChartBaseRenderersResult } from './useChartBaseRenderers';
import type { UseGenericChartIndicatorRenderersResult } from './useGenericChartIndicatorRenderers';
import type { ChartColors } from '@renderer/hooks/useChartColors';
import { clearPriceTagBuffer } from '../utils/priceTagBuffer';
import { renderDragPreview, renderSlTpPreview, renderTsPreview, renderOrderPreview } from './chartPreviewRenderers';
import { perfMonitor } from '@renderer/utils/canvas/perfMonitor';

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

interface PipelineRefs {
  chartType: string;
  allExecutions: BackendExecution[];
  base: UseChartBaseRenderersResult;
  generic: UseGenericChartIndicatorRenderersResult;
  renderOrderLines: () => void;
  renderGridPreview: () => void;
  renderDrawings: () => void;
  renderEventScale: () => void;
  orderDragHandler: ReturnType<typeof useOrderDragHandler>;
  slTpPlacement: ReturnType<typeof useSlTpPlacementMode>;
  tsPlacementActive: boolean;
  tsPlacementPreviewPrice: number | null;
  orderPreviewRef: MutableRefObject<{ price: number; type: 'long' | 'short' } | null>;
  t: ReturnType<typeof useTranslation>['t'];
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

  const refs = useRef<PipelineRefs>({
    chartType,
    allExecutions,
    base: baseRenderers,
    generic: genericRenderers,
    renderOrderLines,
    renderGridPreview,
    renderDrawings,
    renderEventScale,
    orderDragHandler,
    slTpPlacement,
    tsPlacementActive,
    tsPlacementPreviewPrice,
    orderPreviewRef,
    t,
  });

  refs.current.chartType = chartType;
  refs.current.allExecutions = allExecutions;
  refs.current.base = baseRenderers;
  refs.current.generic = genericRenderers;
  refs.current.renderOrderLines = renderOrderLines;
  refs.current.renderGridPreview = renderGridPreview;
  refs.current.renderDrawings = renderDrawings;
  refs.current.renderEventScale = renderEventScale;
  refs.current.orderDragHandler = orderDragHandler;
  refs.current.slTpPlacement = slTpPlacement;
  refs.current.tsPlacementActive = tsPlacementActive;
  refs.current.tsPlacementPreviewPrice = tsPlacementPreviewPrice;
  refs.current.orderPreviewRef = orderPreviewRef;
  refs.current.t = t;

  useEffect(() => {
    if (!manager) return;

    const timed = <T,>(section: string, fn: () => T): T => {
      const ts = perfMonitor.mark();
      const result = fn();
      perfMonitor.measure(section, ts);
      return result;
    };

    const renderBase = (): void => {
      const r = refs.current;
      const b = r.base;
      const g = r.generic;

      timed('clear', () => manager.clear());
      clearPriceTagBuffer(manager);
      timed('watermark', b.renderWatermark);
      timed('grid', b.renderGrid);
      timed('customIndicators', g.renderAllCustomIndicators);
      if (r.chartType === 'line') {
        timed('lineChart', b.renderLineChart);
      } else {
        timed('klines', b.renderKlines);
      }
      timed('overlayIndicators', g.renderAllOverlayIndicators);
      timed('panelIndicators', g.renderAllPanelIndicators);
      timed('currentPriceLine', b.renderCurrentPriceLine_Line);
    };

    const renderOverlayOnly = (): void => {
      const r = refs.current;
      const b = r.base;

      timed('drawings', r.renderDrawings);
      timed('eventScale', r.renderEventScale);
      timed('orderLines', r.renderOrderLines);
      timed('gridPreview', r.renderGridPreview);

      timed('previews', () => {
        renderDragPreview(manager, r.orderDragHandler, r.t, _colors.background, _colors.text);
        renderSlTpPreview(manager, r.slTpPlacement, r.allExecutions, _colors.background, _colors.text);
        renderTsPreview(manager, r.tsPlacementActive, r.tsPlacementPreviewPrice, _colors.background, _colors.text);
      });

      timed('currentPriceLabel', b.renderCurrentPriceLine_Label);
      timed('crosshair', b.renderCrosshairPriceLine);

      timed('orderPreview', () => renderOrderPreview(manager, r.orderPreviewRef, r.t, _colors.background, _colors.text));
    };

    const renderWithDirtyFlagCleanup = (): void => {
      const frameTs = perfMonitor.beginFrame();
      const flags = manager.getDirtyFlags();
      const isOverlayOnly = flags.overlays && !flags.all && !flags.klines && !flags.viewport && !flags.dimensions;

      if (isOverlayOnly && manager.hasBaseSnapshot() && manager.restoreBaseLayer()) {
        renderOverlayOnly();
      } else {
        renderBase();
        manager.snapshotBaseLayer();
        renderOverlayOnly();
      }

      manager.clearDirtyFlags();
      perfMonitor.endFrame(frameTs);
    };

    manager.setRenderCallback(renderWithDirtyFlagCleanup);

    return () => {
      manager.setRenderCallback(null);
    };
  }, [manager]);
};
