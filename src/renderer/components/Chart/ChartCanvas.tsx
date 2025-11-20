import { Box } from '@chakra-ui/react';
import { useChartColors } from '@renderer/hooks/useChartColors';
import { calculateMovingAverage } from '@renderer/utils/movingAverages';
import { CHART_CONFIG } from '@shared/constants';
import type { AIStudy, Candle, Viewport } from '@shared/types';
import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';
import type { AdvancedControlsConfig } from './AdvancedControls';
import { AIStudyRenderer } from './AIStudyRenderer';
import { ChartContextMenu } from './ChartContextMenu';
import { ChartTooltip } from './ChartTooltip';
import { useCandlestickRenderer } from './useCandlestickRenderer';
import { useChartCanvas } from './useChartCanvas';
import { useCrosshairPriceLineRenderer } from './useCrosshairPriceLineRenderer';
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
  showCrosshair?: boolean;
  showMeasurementRuler?: boolean;
  showMeasurementArea?: boolean;
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
  showCrosshair = true,
  showMeasurementRuler = false,
  showMeasurementArea = false,
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
    movingAverage?: {
      period: number;
      type: 'SMA' | 'EMA';
      color: string;
      value?: number;
    };
    measurement?: {
      candleCount: number;
      priceChange: number;
      percentChange: number;
      startPrice: number;
      endPrice: number;
    };
  }>({
    candle: null,
    x: 0,
    y: 0,
    visible: false,
  });
  const [mousePosition, setMousePosition] = useState<{ x: number; y: number } | null>(null);
  const [hoveredAIStudy, setHoveredAIStudy] = useState<AIStudy | null>(null);
  const [hoveredMAIndex, setHoveredMAIndex] = useState<number | undefined>(undefined);
  const [isInteracting, setIsInteracting] = useState(false);
  const [interactionTimeout, setInteractionTimeout] = useState<NodeJS.Timeout | null>(null);
  const [cursor, setCursor] = useState<'crosshair' | 'ns-resize' | 'grab' | 'grabbing'>('crosshair');
  const [measurementArea, setMeasurementArea] = useState<{
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    startIndex: number;
    endIndex: number;
  } | null>(null);
  const [isMeasuring, setIsMeasuring] = useState(false);
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
    hoveredMAIndex,
  });

  const { render: renderCurrentPriceLine } = useCurrentPriceLineRenderer({
    manager,
    colors,
    enabled: showCurrentPriceLine,
    ...(advancedConfig?.currentPriceLineWidth !== undefined && { lineWidth: advancedConfig.currentPriceLineWidth }),
    ...(advancedConfig?.currentPriceLineStyle !== undefined && { lineStyle: advancedConfig.currentPriceLineStyle }),
    ...(advancedConfig?.rightMargin !== undefined && { rightMargin: advancedConfig.rightMargin }),
  });

  const { render: renderCrosshairPriceLine } = useCrosshairPriceLineRenderer({
    manager,
    colors,
    enabled: showCrosshair,
    mouseX: mousePosition?.x ?? null,
    mouseY: mousePosition?.y ?? null,
    lineWidth: 1,
    lineStyle: 'solid',
    ...(advancedConfig?.rightMargin !== undefined && { rightMargin: advancedConfig.rightMargin }),
  });

  const handleCanvasMouseMove = (event: React.MouseEvent<HTMLCanvasElement>): void => {
    if (isMeasuring && manager && canvasRef.current && measurementArea) {
      const rect = canvasRef.current.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;
      
      const viewport = manager.getViewport();
      const dimensions = manager.getDimensions();
      if (!dimensions) return;
      
      const chartAreaRight = dimensions.chartWidth - (advancedConfig?.rightMargin ?? 72);
      const hoveredIndex = Math.floor(viewport.start + (mouseX / chartAreaRight) * (viewport.end - viewport.start));
      
      setMeasurementArea({
        ...measurementArea,
        endX: mouseX,
        endY: mouseY,
        endIndex: hoveredIndex,
      });
      
      const startIndex = Math.min(measurementArea.startIndex, hoveredIndex);
      const endIndex = Math.max(measurementArea.startIndex, hoveredIndex);
      const candleCount = Math.abs(endIndex - startIndex);
      
      const startPrice = manager.yToPrice(measurementArea.startY);
      const endPrice = manager.yToPrice(mouseY);
      const priceChange = endPrice - startPrice;
      const percentChange = (priceChange / startPrice) * 100;
      
      setTooltipData({
        candle: null,
        x: mouseX,
        y: mouseY,
        visible: true,
        containerWidth: rect.width,
        containerHeight: rect.height,
        measurement: {
          candleCount,
          priceChange,
          percentChange,
          startPrice,
          endPrice,
        },
      });
      
      setMousePosition({ x: mouseX, y: mouseY });
      return;
    }
    
    handleMouseMove(event);

    if (!manager || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    setMousePosition({ x: mouseX, y: mouseY });

    const viewport = manager.getViewport();
    const dimensions = manager.getDimensions();
    const bounds = manager.getBounds();

    if (!dimensions || !bounds) return;

    const priceScaleLeft = dimensions.width - (advancedConfig?.paddingRight ?? CHART_CONFIG.CANVAS_PADDING_RIGHT);
    const timeScaleTop = dimensions.height - CHART_CONFIG.CANVAS_PADDING_BOTTOM;
    const chartAreaRight = dimensions.chartWidth - (advancedConfig?.rightMargin ?? CHART_CONFIG.CHART_RIGHT_MARGIN);

    const isOnPriceScale = mouseX >= priceScaleLeft && mouseY < timeScaleTop;
    
    const isOnTimeScale = mouseY >= timeScaleTop;
    
    const lastCandleX = manager.indexToX(candles.length - 1);
    const studyExtensionArea = lastCandleX + CHART_CONFIG.STUDY_EXTENSION_DISTANCE;
    const isInChartArea = mouseX < chartAreaRight && mouseY < timeScaleTop;
    const isInExtendedStudyArea = mouseX >= chartAreaRight && mouseX <= studyExtensionArea && mouseY < timeScaleTop;

    if (isOnPriceScale) {
      setCursor('ns-resize');
    } else if (isOnTimeScale) {
      setCursor('crosshair');
    } else if (isInChartArea || isInExtendedStudyArea) {
      setCursor('crosshair');
    }

    if (isOnPriceScale || isOnTimeScale) {
      setHoveredMAIndex(undefined);
      setTooltipData({
        candle: null,
        x: 0,
        y: 0,
        visible: false,
      });
      return;
    }

    const distanceToLine = (px: number, py: number, x1: number, y1: number, x2: number, y2: number): number => {
      const A = px - x1;
      const B = py - y1;
      const C = x2 - x1;
      const D = y2 - y1;
      const dot = A * C + B * D;
      const lenSq = C * C + D * D;
      const param = lenSq !== 0 ? dot / lenSq : -1;

      let xx: number;
      let yy: number;

      if (param < 0) {
        xx = x1;
        yy = y1;
      } else if (param > 1) {
        xx = x2;
        yy = y2;
      } else {
        xx = x1 + param * C;
        yy = y1 + param * D;
      }

      const dx = px - xx;
      const dy = py - yy;
      return Math.sqrt(dx * dx + dy * dy);
    };

    let closestMAIndex: number | undefined = undefined;
    let closestMADistance = Infinity;
    let closestMAValue: number | undefined = undefined;
    const HOVER_THRESHOLD = 8;

    movingAverages.forEach((ma, index) => {
      if (ma.visible === false) return;
      
      const maValues = calculateMovingAverage(candles, ma.period, ma.type);
      const startIndex = Math.max(0, Math.floor(viewport.start));
      const endIndex = Math.min(candles.length, Math.ceil(viewport.end));

      for (let i = startIndex; i < endIndex - 1; i++) {
        const value1 = maValues[i];
        const value2 = maValues[i + 1];
        
        if (value1 === null || value1 === undefined || value2 === null || value2 === undefined) continue;

        const x1 = manager.indexToX(i);
        const y1 = manager.priceToY(value1);
        const x2 = manager.indexToX(i + 1);
        const y2 = manager.priceToY(value2);

        const distance = distanceToLine(mouseX, mouseY, x1, y1, x2, y2);

        if (distance < HOVER_THRESHOLD && distance < closestMADistance) {
          closestMADistance = distance;
          closestMAIndex = index;
          closestMAValue = (value1 + value2) / 2;
        }
      }
    });

    setHoveredMAIndex(closestMAIndex);

    if (closestMAIndex !== undefined) {
      const ma = movingAverages[closestMAIndex];
      if (ma) {
        setTooltipData({
          candle: null,
          x: mouseX,
          y: mouseY,
          visible: true,
          containerWidth: rect.width,
          containerHeight: rect.height,
          movingAverage: {
            period: ma.period,
            type: ma.type,
            color: ma.color,
            ...(closestMAValue !== undefined && { value: closestMAValue }),
          },
        });
        return;
      }
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

    if (!isInChartArea) {
      setTooltipData({
        candle: null,
        x: 0,
        y: 0,
        visible: false,
      });
      return;
    }

    const effectiveChartWidth = chartAreaRight;
    const hoveredIndex = Math.floor(viewport.start + (mouseX / effectiveChartWidth) * (viewport.end - viewport.start));

    if (hoveredIndex >= 0 && hoveredIndex < candles.length) {
      const candle = candles[hoveredIndex];
      if (candle) {
        const x = manager.indexToX(hoveredIndex);
        const candleWidth = viewport.candleWidth;
        
        const visibleRange = viewport.end - viewport.start;
        const widthPerCandle = chartAreaRight / visibleRange;
        const candleX = x + (widthPerCandle - candleWidth) / 2;
        
        const openY = manager.priceToY(candle.open);
        const closeY = manager.priceToY(candle.close);
        const highY = manager.priceToY(candle.high);
        const lowY = manager.priceToY(candle.low);

        const bodyLeft = candleX;
        const bodyRight = candleX + candleWidth;
        const bodyTop = Math.min(openY, closeY);
        const bodyBottom = Math.max(openY, closeY);

        const volumeHeightRatio = advancedConfig?.volumeHeightRatio ?? CHART_CONFIG.VOLUME_HEIGHT_RATIO;
        const volumeOverlayHeight = dimensions.chartHeight * volumeHeightRatio;
        const volumeBaseY = dimensions.chartHeight;
        const volumeRatio = candle.volume / bounds.maxVolume;
        const barHeight = volumeRatio * volumeOverlayHeight;
        const volumeTop = volumeBaseY - barHeight;

        const isOnCandleBody = mouseX >= bodyLeft && 
                               mouseX <= bodyRight && 
                               mouseY >= bodyTop && 
                               mouseY <= bodyBottom;

        const isOnCandleWick = mouseX >= bodyLeft && 
                               mouseX <= bodyRight && 
                               mouseY >= highY && 
                               mouseY <= lowY;

        const isOnVolumeBar = showVolume &&
                              mouseX >= bodyLeft && 
                              mouseX <= bodyRight && 
                              mouseY >= volumeTop && 
                              mouseY <= volumeBaseY;

        if (isOnCandleBody || isOnCandleWick || isOnVolumeBar) {
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
    setIsMeasuring(false);
    setMeasurementArea(null);
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

  const handleDeleteStudies = (): void => {
    onDeleteAIStudies?.();
  };

  const handleToggleStudiesVisibility = (): void => {
    onToggleAIStudiesVisibility?.();
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
    if ((showMeasurementRuler || showMeasurementArea) && manager && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;
      
      const dimensions = manager.getDimensions();
      if (!dimensions) return;
      
      const timeScaleTop = dimensions.height - 40;
      const priceScaleLeft = dimensions.width - (advancedConfig?.rightMargin ?? 72);
      
      if (mouseX < priceScaleLeft && mouseY < timeScaleTop) {
        const viewport = manager.getViewport();
        const chartAreaRight = dimensions.chartWidth - (advancedConfig?.rightMargin ?? 72);
        const hoveredIndex = Math.floor(viewport.start + (mouseX / chartAreaRight) * (viewport.end - viewport.start));
        
        setIsMeasuring(true);
        setMeasurementArea({
          startX: mouseX,
          startY: mouseY,
          endX: mouseX,
          endY: mouseY,
          startIndex: hoveredIndex,
          endIndex: hoveredIndex,
        });
        return;
      }
    }
    
    handleMouseDown(event);
    startInteraction();
  };

  const handleCanvasMouseUp = (): void => {
    if (isMeasuring) {
      setIsMeasuring(false);
      setMeasurementArea(null);
      return;
    }
    
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
      renderCrosshairPriceLine();
      
      if (measurementArea && isMeasuring) {
        const ctx = manager.getContext();
        if (!ctx) return;
        
        const { startX, startY, endX, endY } = measurementArea;
        
        const startPrice = manager.yToPrice(startY);
        const endPrice = manager.yToPrice(endY);
        const priceChange = endPrice - startPrice;
        const isPositive = priceChange >= 0;
        
        ctx.save();
        
        if (showMeasurementArea) {
          ctx.fillStyle = 'rgba(100, 116, 139, 0.1)';
          ctx.fillRect(
            Math.min(startX, endX),
            Math.min(startY, endY),
            Math.abs(endX - startX),
            Math.abs(endY - startY)
          );
          
          ctx.strokeStyle = colors.crosshair;
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 4]);
          ctx.strokeRect(
            Math.min(startX, endX),
            Math.min(startY, endY),
            Math.abs(endX - startX),
            Math.abs(endY - startY)
          );
        }
        
        if (showMeasurementRuler) {
          ctx.strokeStyle = isPositive ? colors.bullish : colors.bearish;
          ctx.lineWidth = 2;
          ctx.setLineDash([6, 3]);
          ctx.beginPath();
          ctx.moveTo(startX, startY);
          ctx.lineTo(endX, endY);
          ctx.stroke();
        }
        
        ctx.restore();
      }
    };

    manager.setRenderCallback(render);

    return () => {
      manager.setRenderCallback(null);
    };
  }, [manager, renderGrid, renderVolume, renderCandles, renderLineChart, renderMovingAverages, renderCurrentPriceLine, renderCrosshairPriceLine, chartType, measurementArea, isMeasuring, colors, showMeasurementRuler, showMeasurementArea]);

  return (
    <Box
      position="relative"
      width={width}
      height={height}
      overflow="hidden"
      bg={colors.background}
      userSelect="none"
    >
      <ChartContextMenu
        onDeleteStudies={handleDeleteStudies}
        onToggleStudiesVisibility={handleToggleStudiesVisibility}
        hasStudies={aiStudies.length > 0}
        studiesVisible={aiStudiesVisible}
      >
        <canvas
          ref={canvasRef}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onMouseLeave={handleCanvasMouseLeave}
          onWheel={handleWheel}
          style={{
            width: '100%',
            height: '100%',
            cursor,
            display: 'block',
          }}
        />
      </ChartContextMenu>
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
        {...(tooltipData.movingAverage && { movingAverage: tooltipData.movingAverage })}
        {...(tooltipData.measurement && { measurement: tooltipData.measurement })}
      />
    </Box>
  );
};
