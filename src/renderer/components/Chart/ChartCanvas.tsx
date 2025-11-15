import { Box } from '@chakra-ui/react';
import { CHART_COLORS_DARK, CHART_CONFIG } from '@shared/constants';
import type { Candle, ChartColors, Viewport } from '@shared/types';
import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';
import type { AdvancedControlsConfig } from './AdvancedControls';
import { ChartTooltip } from './ChartTooltip';
import { useCandlestickRenderer } from './useCandlestickRenderer';
import { useChartCanvas } from './useChartCanvas';
import { useGridRenderer } from './useGridRenderer';
import { useLineChartRenderer } from './useLineChartRenderer';
import { useMovingAverageRenderer, type MovingAverageConfig } from './useMovingAverageRenderer';
import { useVolumeRenderer } from './useVolumeRenderer';

export interface ChartCanvasProps {
  candles: Candle[];
  width?: string | number;
  height?: string | number;
  initialViewport?: Viewport;
  onViewportChange?: (viewport: Viewport) => void;
  colors?: ChartColors;
  showGrid?: boolean;
  showVolume?: boolean;
  movingAverages?: MovingAverageConfig[];
  chartType?: 'candlestick' | 'line';
  advancedConfig?: AdvancedControlsConfig;
}

export const ChartCanvas = ({
  candles,
  width = '100%',
  height = '600px',
  initialViewport,
  onViewportChange,
  colors = CHART_COLORS_DARK,
  showGrid = true,
  showVolume = true,
  movingAverages = [],
  chartType = 'candlestick',
  advancedConfig,
}: ChartCanvasProps): ReactElement => {
  const [tooltipData, setTooltipData] = useState<{
    candle: Candle | null;
    x: number;
    y: number;
    visible: boolean;
    containerWidth?: number;
    containerHeight?: number;
  }>({
    candle: null,
    x: 0,
    y: 0,
    visible: false,
  });
  const [cursor, setCursor] = useState<'crosshair' | 'ns-resize' | 'grab' | 'grabbing'>('crosshair');
  const {
    canvasRef,
    manager,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleMouseLeave,
  } = useChartCanvas({
    candles,
    ...(initialViewport !== undefined && { initialViewport }),
    ...(onViewportChange !== undefined && { onViewportChange }),
  });

  const { render: renderGrid } = useGridRenderer({
    manager,
    colors,
    enabled: showGrid,
    ...(advancedConfig?.gridLineWidth !== undefined && { gridLineWidth: advancedConfig.gridLineWidth }),
    ...(advancedConfig?.paddingRight !== undefined && { paddingRight: advancedConfig.paddingRight }),
    ...(advancedConfig?.rightMargin !== undefined && { rightMargin: advancedConfig.rightMargin }),
  });

  const { render: renderCandles } = useCandlestickRenderer({
    manager,
    colors,
    enabled: chartType === 'candlestick',
    ...(advancedConfig?.rightMargin !== undefined && { rightMargin: advancedConfig.rightMargin }),
    ...(advancedConfig?.candleWickWidth !== undefined && { candleWickWidth: advancedConfig.candleWickWidth }),
  });

  const { render: renderLineChart } = useLineChartRenderer({
    manager,
    colors,
    enabled: chartType === 'line',
    ...(advancedConfig?.rightMargin !== undefined && { rightMargin: advancedConfig.rightMargin }),
  });

  const { render: renderVolume } = useVolumeRenderer({
    manager,
    colors,
    enabled: showVolume,
    ...(advancedConfig?.rightMargin !== undefined && { rightMargin: advancedConfig.rightMargin }),
    ...(advancedConfig?.volumeHeightRatio !== undefined && { volumeHeightRatio: advancedConfig.volumeHeightRatio }),
  });

  const { render: renderMovingAverages } = useMovingAverageRenderer({
    manager,
    movingAverages,
    ...(advancedConfig?.rightMargin !== undefined && { rightMargin: advancedConfig.rightMargin }),
  });

  const handleCanvasMouseMove = (event: React.MouseEvent<HTMLCanvasElement>): void => {
    handleMouseMove(event);

    if (!manager || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    const viewport = manager.getViewport();
    const dimensions = manager.getDimensions();

    if (!dimensions) return;

    // Calculate scale boundaries
    const priceScaleLeft = dimensions.width - (advancedConfig?.paddingRight ?? CHART_CONFIG.CANVAS_PADDING_RIGHT);
    const timeScaleTop = dimensions.height - CHART_CONFIG.CANVAS_PADDING_BOTTOM;
    const chartAreaRight = dimensions.chartWidth - (advancedConfig?.rightMargin ?? CHART_CONFIG.CHART_RIGHT_MARGIN);

    // Check if mouse is over price scale (right side)
    const isOnPriceScale = mouseX >= priceScaleLeft && mouseY < timeScaleTop;
    
    // Check if mouse is over time scale (bottom)
    const isOnTimeScale = mouseY >= timeScaleTop;
    
    // Check if mouse is in chart area
    const isInChartArea = mouseX < chartAreaRight && mouseY < timeScaleTop;

    // Update cursor based on position
    if (isOnPriceScale) {
      setCursor('ns-resize');
    } else if (isOnTimeScale) {
      setCursor('crosshair');
    } else if (isInChartArea) {
      setCursor('crosshair');
    }

    // Only show tooltip if in chart area (not on scales)
    if (!isInChartArea || isOnPriceScale || isOnTimeScale) {
      setTooltipData({
        candle: null,
        x: 0,
        y: 0,
        visible: false,
      });
      return;
    }

    const candleWidth = dimensions.width / (viewport.end - viewport.start);
    const hoveredIndex = Math.floor(viewport.start + mouseX / candleWidth);

    if (hoveredIndex >= 0 && hoveredIndex < candles.length) {
      const candle = candles[hoveredIndex];
      if (candle) {
        setTooltipData({
          candle,
          x: mouseX,
          y: mouseY,
          visible: true,
          containerWidth: rect.width,
          containerHeight: rect.height,
        });
        return;
      }
    }

    setTooltipData({
      candle: null,
      x: 0,
      y: 0,
      visible: false,
    });
  };

  const handleCanvasMouseLeave = (): void => {
    handleMouseLeave();
    setTooltipData({
      candle: null,
      x: 0,
      y: 0,
      visible: false,
    });
  };

  // Update manager settings when advancedConfig changes
  useEffect(() => {
    if (!manager || !advancedConfig) return;
    
    if (advancedConfig.rightMargin !== undefined) {
      manager.setRightMargin(advancedConfig.rightMargin);
    }
  }, [manager, advancedConfig]);

  // Setup render callback and initial render
  useEffect(() => {
    if (!manager) return;

    const render = (): void => {
      manager.clear();
      renderGrid();
      renderVolume();
      if (chartType === 'candlestick') {
        renderCandles();
      } else {
        renderLineChart();
      }
      renderMovingAverages();
    };

    // Register render callback with manager (will trigger initial render)
    manager.setRenderCallback(render);

    return () => {
      manager.setRenderCallback(null);
    };
  }, [manager, renderGrid, renderVolume, renderCandles, renderLineChart, renderMovingAverages, chartType]);

  return (
    <Box
      position="relative"
      width={width}
      height={height}
      overflow="hidden"
      bg="gray.900"
      userSelect="none"
    >
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleCanvasMouseLeave}
        style={{
          width: '100%',
          height: '100%',
          cursor,
          display: 'block',
        }}
      />
      <ChartTooltip
        candle={tooltipData.candle}
        x={tooltipData.x}
        y={tooltipData.y}
        visible={tooltipData.visible}
        containerWidth={tooltipData.containerWidth ?? window.innerWidth}
        containerHeight={tooltipData.containerHeight ?? window.innerHeight}
      />
    </Box>
  );
};
