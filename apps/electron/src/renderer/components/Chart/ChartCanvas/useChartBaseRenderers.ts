import type { ChartThemeColors } from '@renderer/hooks/useChartColors';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import type { HighlightedCandle, MarketType } from '@marketmind/types';
import type { AdvancedControlsConfig } from '../AdvancedControls';
import type { MovingAverageConfig } from '../useMovingAverageRenderer';
import { useGridRenderer } from '../useGridRenderer';
import { useKlineRenderer } from '../useKlineRenderer';
import { useLineChartRenderer } from '../useLineChartRenderer';
import { useVolumeRenderer } from '../useVolumeRenderer';
import { useMovingAverageRenderer } from '../useMovingAverageRenderer';
import { useCurrentPriceLineRenderer } from '../useCurrentPriceLineRenderer';
import { useCrosshairPriceLineRenderer } from '../useCrosshairPriceLineRenderer';
import { useWatermarkRenderer } from '../useWatermarkRenderer';
import { useMemo } from 'react';
import { calculateMovingAverage } from '@marketmind/indicators';
import type { Kline } from '@marketmind/types';

export interface UseChartBaseRenderersProps {
  manager: CanvasManager | null;
  klines: Kline[];
  colors: ChartThemeColors;
  chartType: string;
  advancedConfig?: AdvancedControlsConfig;
  movingAverages: MovingAverageConfig[];
  showGrid: boolean;
  showVolume: boolean;
  showCurrentPriceLine: boolean;
  showCrosshair: boolean;
  showActivityIndicator: boolean;
  hoveredKlineIndex?: number;
  highlightedCandlesRef: React.MutableRefObject<HighlightedCandle[]>;
  hoveredMAIndexRef: React.MutableRefObject<number | undefined>;
  mousePositionRef: React.MutableRefObject<{ x: number; y: number } | null>;
  timeframe: string;
  symbol?: string;
  marketType?: MarketType;
}

export interface UseChartBaseRenderersResult {
  renderGrid: () => void;
  renderKlines: () => void;
  renderLineChart: () => void;
  renderVolume: () => void;
  renderMovingAverages: () => void;
  renderCurrentPriceLine_Line: () => void;
  renderCurrentPriceLine_Label: () => void;
  renderCrosshairPriceLine: () => void;
  renderWatermark: () => void;
  getHoveredMATag: (x: number, y: number) => number | undefined;
  maValuesCache: Map<string, (number | null)[]>;
}

export const useChartBaseRenderers = ({
  manager,
  klines,
  colors,
  chartType,
  advancedConfig,
  movingAverages,
  showGrid,
  showVolume,
  showCurrentPriceLine,
  showCrosshair,
  showActivityIndicator,
  hoveredKlineIndex,
  highlightedCandlesRef,
  hoveredMAIndexRef,
  mousePositionRef,
  timeframe,
  symbol,
  marketType,
}: UseChartBaseRenderersProps): UseChartBaseRenderersResult => {
  const maValuesCache = useMemo(() => {
    const cache = new Map<string, (number | null)[]>();
    for (const ma of movingAverages) {
      if (ma.visible === false) continue;
      const key = `${ma.type}-${ma.period}`;
      cache.set(key, calculateMovingAverage(klines, ma.period, ma.type));
    }
    return cache;
  }, [klines, movingAverages]);

  const { render: renderGrid } = useGridRenderer({
    manager,
    colors,
    enabled: showGrid,
    ...(advancedConfig?.gridLineWidth !== undefined && {
      gridLineWidth: advancedConfig.gridLineWidth,
    }),
  });

  const { render: renderKlines } = useKlineRenderer({
    manager,
    colors,
    enabled: chartType === 'kline',
    showActivityIndicator,
    ...(advancedConfig?.rightMargin !== undefined && {
      rightMargin: advancedConfig.rightMargin,
    }),
    ...(advancedConfig?.klineWickWidth !== undefined && {
      klineWickWidth: advancedConfig.klineWickWidth,
    }),
    ...(hoveredKlineIndex !== undefined && { hoveredKlineIndex }),
    highlightedCandlesRef,
  });

  const { render: renderLineChart } = useLineChartRenderer({
    manager,
    colors,
    enabled: chartType === 'line',
    ...(advancedConfig?.rightMargin !== undefined && {
      rightMargin: advancedConfig.rightMargin,
    }),
  });

  const { render: renderVolume } = useVolumeRenderer({
    manager,
    colors,
    enabled: showVolume,
    ...(advancedConfig?.rightMargin !== undefined && {
      rightMargin: advancedConfig.rightMargin,
    }),
    ...(advancedConfig?.volumeHeightRatio !== undefined && {
      volumeHeightRatio: advancedConfig.volumeHeightRatio,
    }),
    ...(hoveredKlineIndex !== undefined && { hoveredKlineIndex }),
    timeframe,
    showVolumeMA: true,
  });

  const { render: renderMovingAverages, getHoveredMATag } = useMovingAverageRenderer({
    manager,
    movingAverages,
    ...(advancedConfig?.rightMargin !== undefined && {
      rightMargin: advancedConfig.rightMargin,
    }),
    hoveredMAIndexRef,
    maValuesCache,
  });

  const { renderLine: renderCurrentPriceLine_Line, renderLabel: renderCurrentPriceLine_Label } =
    useCurrentPriceLineRenderer({
      manager,
      colors,
      enabled: showCurrentPriceLine,
      ...(advancedConfig?.currentPriceLineWidth !== undefined && {
        lineWidth: advancedConfig.currentPriceLineWidth,
      }),
      timeframe,
    });

  const { render: renderCrosshairPriceLine } = useCrosshairPriceLineRenderer({
    manager,
    colors,
    enabled: showCrosshair,
    mousePositionRef,
    lineWidth: 1,
    lineStyle: 'solid',
    ...(advancedConfig?.rightMargin !== undefined && {
      rightMargin: advancedConfig.rightMargin,
    }),
  });

  const { render: renderWatermark } = useWatermarkRenderer({
    manager,
    colors,
    symbol,
    timeframe,
    marketType,
    enabled: true,
  });

  return {
    renderGrid,
    renderKlines,
    renderLineChart,
    renderVolume,
    renderMovingAverages,
    renderCurrentPriceLine_Line,
    renderCurrentPriceLine_Label,
    renderCrosshairPriceLine,
    renderWatermark,
    getHoveredMATag,
    maValuesCache,
  };
};
