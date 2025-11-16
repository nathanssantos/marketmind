import { Box } from '@chakra-ui/react';
import { CHART_CONFIG } from '@shared/constants';
import type { AIStudy, Candle, Viewport } from '@shared/types';
import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';
import { useChartColors } from '@renderer/hooks/useChartColors';
import type { AdvancedControlsConfig } from './AdvancedControls';
import { AIStudyRenderer } from './AIStudyRenderer';
import { ChartContextMenu } from './ChartContextMenu';
import { ChartTooltip } from './ChartTooltip';
import { useCandlestickRenderer } from './useCandlestickRenderer';
import { useChartCanvas } from './useChartCanvas';
import { useCurrentPriceLineRenderer } from './useCurrentPriceLineRenderer';
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
  showGrid?: boolean;
  showVolume?: boolean;
  showCurrentPriceLine?: boolean;
  movingAverages?: MovingAverageConfig[];
  chartType?: 'candlestick' | 'line';
  advancedConfig?: AdvancedControlsConfig;
  aiStudies?: AIStudy[];
  onDeleteAIStudies?: () => void;
  onToggleAIStudiesVisibility?: () => void;
  aiStudiesVisible?: boolean;
}

export const ChartCanvas = ({
  candles,
  width = '100%',
  height = '600px',
  initialViewport,
  onViewportChange,
  showGrid = true,
  showVolume = true,
  showCurrentPriceLine = true,
  movingAverages = [],
  chartType = 'candlestick',
  advancedConfig,
  aiStudies = [],
  onDeleteAIStudies,
  onToggleAIStudiesVisibility,
  aiStudiesVisible = true,
}: ChartCanvasProps): ReactElement => {
  const colors = useChartColors();
  const [tooltipData, setTooltipData] = useState<{
    candle: Candle | null;
    x: number;
    y: number;
    visible: boolean;
    containerWidth?: number;
    containerHeight?: number;
    candleIndex?: number;
    aiStudy?: AIStudy;
  }>({
    candle: null,
    x: 0,
    y: 0,
    visible: false,
  });
  const [mousePosition, setMousePosition] = useState<{ x: number; y: number } | null>(null);
  const [hoveredAIStudy, setHoveredAIStudy] = useState<AIStudy | null>(null);
  const [isInteracting, setIsInteracting] = useState(false);
  const [interactionTimeout, setInteractionTimeout] = useState<NodeJS.Timeout | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean;
    x: number;
    y: number;
  }>({
    isOpen: false,
    x: 0,
    y: 0,
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
    ...(tooltipData.candleIndex !== undefined && { hoveredCandleIndex: tooltipData.candleIndex }),
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
    ...(tooltipData.candleIndex !== undefined && { hoveredCandleIndex: tooltipData.candleIndex }),
  });

  const { render: renderMovingAverages } = useMovingAverageRenderer({
    manager,
    movingAverages,
    ...(advancedConfig?.rightMargin !== undefined && { rightMargin: advancedConfig.rightMargin }),
  });

  const { render: renderCurrentPriceLine } = useCurrentPriceLineRenderer({
    manager,
    colors,
    enabled: showCurrentPriceLine,
    ...(advancedConfig?.currentPriceLineWidth !== undefined && { lineWidth: advancedConfig.currentPriceLineWidth }),
    ...(advancedConfig?.currentPriceLineStyle !== undefined && { lineStyle: advancedConfig.currentPriceLineStyle }),
    ...(advancedConfig?.rightMargin !== undefined && { rightMargin: advancedConfig.rightMargin }),
  });

  const handleCanvasMouseMove = (event: React.MouseEvent<HTMLCanvasElement>): void => {
    handleMouseMove(event);

    if (!manager || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    setMousePosition({ x: mouseX, y: mouseY });

    const viewport = manager.getViewport();
    const dimensions = manager.getDimensions();

    if (!dimensions) return;

    const priceScaleLeft = dimensions.width - (advancedConfig?.paddingRight ?? CHART_CONFIG.CANVAS_PADDING_RIGHT);
    const timeScaleTop = dimensions.height - CHART_CONFIG.CANVAS_PADDING_BOTTOM;
    const chartAreaRight = dimensions.chartWidth - (advancedConfig?.rightMargin ?? CHART_CONFIG.CHART_RIGHT_MARGIN);

    const isOnPriceScale = mouseX >= priceScaleLeft && mouseY < timeScaleTop;
    
    const isOnTimeScale = mouseY >= timeScaleTop;
    
    const isInChartArea = mouseX < chartAreaRight && mouseY < timeScaleTop;

    if (isOnPriceScale) {
      setCursor('ns-resize');
    } else if (isOnTimeScale) {
      setCursor('crosshair');
    } else if (isInChartArea) {
      setCursor('crosshair');
    }

    if (!isInChartArea || isOnPriceScale || isOnTimeScale) {
      setTooltipData({
        candle: null,
        x: 0,
        y: 0,
        visible: false,
      });
      return;
    }

    if (hoveredAIStudy) {
      setTooltipData({
        candle: null,
        x: mouseX,
        y: mouseY,
        visible: true,
        containerWidth: rect.width,
        containerHeight: rect.height,
        aiStudy: hoveredAIStudy,
      });
      return;
    }

    const effectiveChartWidth = chartAreaRight;
    const hoveredIndex = Math.floor(viewport.start + (mouseX / effectiveChartWidth) * (viewport.end - viewport.start));

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
          candleIndex: hoveredIndex,
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
    setMousePosition(null);
    setHoveredAIStudy(null);
    setTooltipData({
      candle: null,
      x: 0,
      y: 0,
      visible: false,
    });
  };

  const handleAIStudyHover = (study: AIStudy | null): void => {
    setHoveredAIStudy(study);
  };

  const handleContextMenu = (event: React.MouseEvent<HTMLCanvasElement>): void => {
    event.preventDefault();
    setContextMenu({
      isOpen: true,
      x: event.clientX,
      y: event.clientY,
    });
  };

  const handleCloseContextMenu = (): void => {
    setContextMenu({
      isOpen: false,
      x: 0,
      y: 0,
    });
  };

  const handleDeleteStudies = (): void => {
    onDeleteAIStudies?.();
    handleCloseContextMenu();
  };

  const handleToggleStudiesVisibility = (): void => {
    onToggleAIStudiesVisibility?.();
    handleCloseContextMenu();
  };

  const startInteraction = (): void => {
    setIsInteracting(true);
    if (interactionTimeout) {
      clearTimeout(interactionTimeout);
    }
  };

  const endInteraction = (): void => {
    const timeout = setTimeout(() => {
      setIsInteracting(false);
    }, 300);
    setInteractionTimeout(timeout);
  };

  const handleCanvasMouseDown = (event: React.MouseEvent<HTMLCanvasElement>): void => {
    handleMouseDown(event);
    startInteraction();
  };

  const handleCanvasMouseUp = (): void => {
    handleMouseUp();
    endInteraction();
  };

  const handleWheel = (): void => {
    startInteraction();
    endInteraction();
  };

  useEffect(() => {
    return () => {
      if (interactionTimeout) {
        clearTimeout(interactionTimeout);
      }
    };
  }, [interactionTimeout]);

  useEffect(() => {
    if (!manager || !advancedConfig) return;
    
    if (advancedConfig.rightMargin !== undefined) {
      manager.setRightMargin(advancedConfig.rightMargin);
    }
  }, [manager, advancedConfig]);

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
      renderCurrentPriceLine();
    };

    manager.setRenderCallback(render);

    return () => {
      manager.setRenderCallback(null);
    };
  }, [manager, renderGrid, renderVolume, renderCandles, renderLineChart, renderMovingAverages, renderCurrentPriceLine, chartType]);

  return (
    <Box
      position="relative"
      width={width}
      height={height}
      overflow="hidden"
      bg={colors.background}
      userSelect="none"
    >
      <canvas
        ref={canvasRef}
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleCanvasMouseUp}
        onMouseLeave={handleCanvasMouseLeave}
        onContextMenu={handleContextMenu}
        onWheel={handleWheel}
        style={{
          width: '100%',
          height: '100%',
          cursor,
          display: 'block',
        }}
      />
      {manager && !isInteracting && (
        <AIStudyRenderer
          canvasManager={manager}
          candles={candles}
          studies={aiStudies}
          width={canvasRef.current?.width ?? 0}
          height={canvasRef.current?.height ?? 0}
          mousePosition={mousePosition}
          onStudyHover={handleAIStudyHover}
          advancedConfig={advancedConfig}
        />
      )}
      <ChartTooltip
        candle={tooltipData.candle}
        x={tooltipData.x}
        y={tooltipData.y}
        visible={tooltipData.visible}
        containerWidth={tooltipData.containerWidth ?? window.innerWidth}
        containerHeight={tooltipData.containerHeight ?? window.innerHeight}
        aiStudy={tooltipData.aiStudy}
      />
      <ChartContextMenu
        isOpen={contextMenu.isOpen}
        position={{ x: contextMenu.x, y: contextMenu.y }}
        onClose={handleCloseContextMenu}
        onDeleteStudies={handleDeleteStudies}
        onToggleStudiesVisibility={handleToggleStudiesVisibility}
        hasStudies={aiStudies.length > 0}
        studiesVisible={aiStudiesVisible}
      />
    </Box>
  );
};
