import { Button } from '@/renderer/components/ui/button';
import {
  DialogActionTrigger,
  DialogBackdrop,
  DialogBody,
  DialogCloseTrigger,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogPositioner,
  DialogRoot,
  DialogTitle,
} from '@/renderer/components/ui/dialog';
import { Box, Portal } from '@chakra-ui/react';
import { useChartColors } from '@renderer/hooks/useChartColors';
import { useRSIWorker } from '@renderer/hooks/useRSIWorker';
import { useStochasticWorker } from '@renderer/hooks/useStochasticWorker';
import { useToast } from '@renderer/hooks/useToast';
import { useTradingShortcuts } from '@renderer/hooks/useTradingShortcuts';
import { SetupDetectionService } from '@renderer/services/setupDetection';
import { useSetupStore } from '@renderer/store';
import { useTradingStore } from '@renderer/store/tradingStore';
import { calculateMovingAverage } from '@renderer/utils/movingAverages';
import type { StochasticResult } from '@renderer/utils/stochastic';
import { CHART_CONFIG } from '@shared/constants';
import type { AIPattern, Candle, Viewport } from '@shared/types';
import type { Order } from '@shared/types/trading';
import type React from 'react';
import type { ReactElement } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AdvancedControlsConfig } from './AdvancedControls';
import { CandleTimer } from './CandleTimer';
import { ChartContextMenuManager } from './ChartContextMenuManager';
import { ChartNavigation } from './ChartNavigation';
import { ChartTooltip } from './ChartTooltip';
import { PatternRenderer } from './PatternRenderer';
import { SetupRenderer } from './SetupRenderer';
import { useCandlestickRenderer } from './useCandlestickRenderer';
import { useChartCanvas } from './useChartCanvas';
import { useCrosshairPriceLineRenderer } from './useCrosshairPriceLineRenderer';
import { useCurrentPriceLineRenderer } from './useCurrentPriceLineRenderer';
import { useGridRenderer } from './useGridRenderer';
import { useLineChartRenderer } from './useLineChartRenderer';
import { useMovingAverageRenderer, type MovingAverageConfig } from './useMovingAverageRenderer';
import { useOrderDragHandler } from './useOrderDragHandler';
import { useOrderLinesRenderer } from './useOrderLinesRenderer';
import { useRSIRenderer } from './useRSIRenderer';
import { useStochasticRenderer } from './useStochasticRenderer';
import { useVolumeRenderer } from './useVolumeRenderer';

const MOUSE_POSITION_THROTTLE_MS = 16;
const RIGHT_MOUSE_BUTTON = 2;

export interface ChartCanvasProps {
  candles: Candle[];
  symbol?: string;
  width?: string | number;
  height?: string | number;
  initialViewport?: Viewport;
  onViewportChange?: (viewport: Viewport) => void;
  showGrid?: boolean;
  showVolume?: boolean;
  showStochastic?: boolean;
  showRSI?: boolean;
  showCurrentPriceLine?: boolean;
  showCrosshair?: boolean;
  showMeasurementRuler?: boolean;
  showMeasurementArea?: boolean;
  movingAverages?: MovingAverageConfig[];
  chartType?: 'candlestick' | 'line';
  advancedConfig?: AdvancedControlsConfig;
  aiPatterns?: AIPattern[];
  onDeleteAIPatterns?: () => void;
  onDeleteAIPattern?: (patternId: number) => void;
  onToggleAIPatternsVisibility?: () => void;
  aiPatternsVisible?: boolean;
  onDeletePattern?: (patternId: number) => void;
  timeframe?: string;
}

export const ChartCanvas = ({
  candles,
  symbol,
  width = '100%',
  height = '600px',
  initialViewport,
  onViewportChange,
  showGrid = true,
  showVolume = true,
  showStochastic = false,
  showRSI = false,
  showCurrentPriceLine = true,
  showCrosshair = true,
  showMeasurementRuler = false,
  showMeasurementArea = false,
  movingAverages = [],
  chartType = 'candlestick',
  advancedConfig,
  aiPatterns = [],
  onDeleteAIPatterns,
  onDeleteAIPattern,
  onToggleAIPatternsVisibility,
  aiPatternsVisible = true,
  onDeletePattern,
  timeframe = '1h',
}: ChartCanvasProps): ReactElement => {
  const { t } = useTranslation();
  const { warning } = useToast();
  const colors = useChartColors();
  const isSimulatorActive = useTradingStore((state) => state.isSimulatorActive);
  const activeWalletId = useTradingStore((state) => state.activeWalletId);
  const orders = useTradingStore((state) => state.orders);
  const addOrder = useTradingStore((state) => state.addOrder);
  const defaultQuantity = useTradingStore((state) => state.defaultQuantity);
  const closeOrder = useTradingStore((state) => state.closeOrder);
  const updateOrder = useTradingStore((state) => state.updateOrder);

  const detectedSetups = useSetupStore((state) => state.detectedSetups);
  const addDetectedSetup = useSetupStore((state) => state.addDetectedSetup);
  const setupConfig = useSetupStore((state) => state.config);
  const [setupService] = useState(() => new SetupDetectionService(setupConfig));
  const [hoveredSetup, setHoveredSetup] = useState<ReturnType<typeof useSetupStore.getState>['detectedSetups'][0] | null>(null);

  const handleLongEntry = useCallback((price: number) => {
    const state = useTradingStore.getState();
    const activeWallet = state.wallets.find((w) => w.id === state.activeWalletId);

    if (!activeWallet) {
      warning(t('trading.ticket.noWallet'));
      return;
    }
    if (!symbol) return;

    const currentPrice = candles[candles.length - 1]?.close;
    const subType: 'limit' | 'stop' = currentPrice !== undefined && price < currentPrice ? 'limit' : 'stop';

    addOrder({
      symbol,
      type: 'long',
      subType,
      status: 'pending',
      entryPrice: price,
      quantity: defaultQuantity || 1,
      walletId: activeWallet.id,
      ...(currentPrice !== undefined && { currentPrice }),
    });
  }, [addOrder, symbol, candles, defaultQuantity, warning, t]);

  const handleShortEntry = useCallback((price: number) => {
    const state = useTradingStore.getState();
    const activeWallet = state.wallets.find((w) => w.id === state.activeWalletId);

    if (!activeWallet) {
      warning(t('trading.ticket.noWallet'));
      return;
    }
    if (!symbol) return;

    const currentPrice = candles[candles.length - 1]?.close;
    const subType: 'limit' | 'stop' = currentPrice !== undefined && price > currentPrice ? 'limit' : 'stop';

    addOrder({
      symbol,
      type: 'short',
      subType,
      status: 'pending',
      entryPrice: price,
      quantity: defaultQuantity || 1,
      walletId: activeWallet.id,
      ...(currentPrice !== undefined && { currentPrice }),
    });
  }, [addOrder, symbol, candles, defaultQuantity, warning, t]);

  const { shiftPressed, altPressed } = useTradingShortcuts({
    onLongEntry: handleLongEntry,
    onShortEntry: handleShortEntry,
    enabled: isSimulatorActive,
  });

  const [tooltipData, setTooltipData] = useState<{
    candle: Candle | null;
    x: number;
    y: number;
    visible: boolean;
    containerWidth?: number;
    containerHeight?: number;
    candleIndex?: number;
    aiPattern?: AIPattern;
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
    order?: Order;
    currentPrice?: number;
  }>({
    candle: null,
    x: 0,
    y: 0,
    visible: false,
  });
  const [mousePosition, setMousePosition] = useState<{ x: number; y: number } | null>(null);
  const [orderPreview, setOrderPreview] = useState<{ price: number; type: 'long' | 'short' } | null>(null);
  const [hoveredAIPattern, setHoveredAIPattern] = useState<AIPattern | null>(null);
  const [contextMenuPattern, setContextMenuPattern] = useState<AIPattern | null>(null);
  const [isContextMenuOpen, setIsContextMenuOpen] = useState(false);
  const [hoveredMAIndex, setHoveredMAIndex] = useState<number | undefined>(undefined);
  const [hoveredOrderId, setHoveredOrderId] = useState<string | null>(null);
  const lastHoveredOrderRef = useRef<string | null>(null);
  const lastTooltipOrderRef = useRef<string | null>(null);
  const lastMousePositionUpdateRef = useRef<number>(0);
  const [isInteracting, setIsInteracting] = useState(false);
  const interactionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [cursor, setCursor] = useState<'crosshair' | 'ns-resize' | 'grab' | 'grabbing' | 'pointer'>('crosshair');
  const [measurementArea, setMeasurementArea] = useState<{
    startX: number;
    startY: number;
    endX: number;
    endY: number;
    startIndex: number;
    endIndex: number;
  } | null>(null);
  const [isMeasuring, setIsMeasuring] = useState(false);
  const [orderToClose, setOrderToClose] = useState<string | null>(null);
  const [stochasticData, setStochasticData] = useState<StochasticResult | null>(null);
  const { calculateStochastic } = useStochasticWorker();
  const rsiWorkerData = useRSIWorker(candles, 2, showRSI);
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

  const handleSetupHover = useCallback((setup: typeof hoveredSetup) => {
    setHoveredSetup(setup);
    if (setup && mousePosition) {
      setTooltipData({
        candle: null,
        x: mousePosition.x,
        y: mousePosition.y,
        visible: true,
      });
    }
  }, [mousePosition]);

  const handleConfirmCloseOrder = useCallback((): void => {
    if (!orderToClose || !manager) return;

    if (orderToClose.startsWith('sltp-')) {
      const parts = orderToClose.split('-');
      const type = parts[1] as 'stopLoss' | 'takeProfit';
      const orderIdsString = parts.slice(2).join('-');
      const orderIds = orderIdsString.split(',').filter(id => id);

      orderIds.forEach((orderId) => {
        updateOrder(orderId, {
          [type]: undefined,
        });
      });

      setOrderToClose(null);
      return;
    }

    const currentCandles = manager.getCandles();
    if (!currentCandles.length) return;

    const currentPrice = currentCandles[currentCandles.length - 1]?.close;
    if (!currentPrice) return;

    closeOrder(orderToClose, currentPrice);
    setOrderToClose(null);
  }, [orderToClose, manager, closeOrder, updateOrder]);

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

  const { render: renderMovingAverages, getHoveredMATag } = useMovingAverageRenderer({
    manager,
    movingAverages,
    ...(advancedConfig?.rightMargin !== undefined && { rightMargin: advancedConfig.rightMargin }),
    hoveredMAIndex,
  });

  const { render: renderStochastic } = useStochasticRenderer({
    manager,
    stochasticData,
    colors,
    enabled: showStochastic,
  });

  const { render: renderRSI } = useRSIRenderer({
    manager,
    rsiData: rsiWorkerData,
    colors,
    enabled: showRSI,
  });

  const { renderLine: renderCurrentPriceLine_Line, renderLabel: renderCurrentPriceLine_Label } = useCurrentPriceLineRenderer({
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

  const { renderOrderLines, getClickedOrderId, getOrderAtPosition, getHoveredOrder, getSLTPAtPosition } = useOrderLinesRenderer(manager, isSimulatorActive, hoveredOrderId);

  const currentCandles = manager?.getCandles() ?? [];
  const currentPrice = currentCandles[currentCandles.length - 1]?.close ?? 0;

  const activeOrders = useMemo(
    () => activeWalletId ? orders.filter(o => o.walletId === activeWalletId) : [],
    [orders, activeWalletId]
  );

  const orderDragHandler = useOrderDragHandler({
    orders: activeOrders,
    updateOrder,
    priceToY: (price) => manager?.priceToY(price) ?? 0,
    yToPrice: (y) => manager?.yToPrice(y) ?? 0,
    enabled: isSimulatorActive,
    getOrderAtPosition: (x, y) => getOrderAtPosition(x, y),
    currentPrice,
  });

  const handleCanvasMouseMove = (event: React.MouseEvent<HTMLCanvasElement>): void => {
    if (!canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    if (orderDragHandler.isDragging) {
      orderDragHandler.handleMouseMove(mouseY);
      return;
    }

    if (isMeasuring && manager && measurementArea) {
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
      manager.markDirty('overlays');

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

      const now = Date.now();
      if (now - lastMousePositionUpdateRef.current > MOUSE_POSITION_THROTTLE_MS) {
        setMousePosition({ x: mouseX, y: mouseY });
        lastMousePositionUpdateRef.current = now;
      }
      return;
    }

    handleMouseMove(event);

    if (!manager) return;

    const hoveredOrderButton = getClickedOrderId(mouseX, mouseY);
    const hoveredSLTP = getSLTPAtPosition(mouseX, mouseY);
    const hoveredOrder = hoveredSLTP ? null : getHoveredOrder(mouseX, mouseY);

    const newHoveredId = hoveredOrder?.id || null;
    if (newHoveredId !== lastHoveredOrderRef.current) {
      lastHoveredOrderRef.current = newHoveredId;
      setHoveredOrderId(newHoveredId);
      manager.markDirty('overlays');
    }

    if (orderDragHandler.isDragging) {
      setCursor('ns-resize');
    } else if (hoveredOrderButton) {
      setCursor('pointer');
    } else if (hoveredSLTP) {
      setCursor('ns-resize');
    } else if (hoveredOrder) {
      setCursor('ns-resize');
    } else if (cursor !== 'crosshair') {
      setCursor('crosshair');
    }

    const now = Date.now();
    if (now - lastMousePositionUpdateRef.current > MOUSE_POSITION_THROTTLE_MS) {
      setMousePosition({ x: mouseX, y: mouseY });
      lastMousePositionUpdateRef.current = now;
    }
    manager.markDirty('overlays');

    const viewport = manager.getViewport();
    const dimensions = manager.getDimensions();
    const bounds = manager.getBounds();

    if (!dimensions || !bounds) return;

    const priceScaleLeft = dimensions.width - (advancedConfig?.paddingRight ?? CHART_CONFIG.CANVAS_PADDING_RIGHT);
    const timeScaleTop = dimensions.height - CHART_CONFIG.CANVAS_PADDING_BOTTOM;
    const chartAreaRight = dimensions.chartWidth - (advancedConfig?.rightMargin ?? CHART_CONFIG.CHART_RIGHT_MARGIN);

    if (isSimulatorActive && (shiftPressed || altPressed) && mouseY < timeScaleTop) {
      const price = manager.yToPrice(mouseY);
      setOrderPreview({
        price,
        type: shiftPressed ? 'long' : 'short',
      });
      manager.markDirty('overlays');
    } else {
      setOrderPreview(null);
      manager.markDirty('overlays');
    }

    const isOnPriceScale = mouseX >= priceScaleLeft && mouseY < timeScaleTop;

    const isOnTimeScale = mouseY >= timeScaleTop;

    const lastCandleX = manager.indexToX(candles.length - 1);
    const patternExtensionArea = lastCandleX + CHART_CONFIG.PATTERN_EXTENSION_DISTANCE;
    const isInChartArea = mouseX < chartAreaRight && mouseY < timeScaleTop;
    const isInExtendedPatternArea = mouseX >= chartAreaRight && mouseX <= patternExtensionArea && mouseY < timeScaleTop;

    const hoveredTagIndex = getHoveredMATag(mouseX, mouseY);

    if (hoveredTagIndex !== undefined) {
      setCursor('pointer');
    } else if (isOnPriceScale) {
      setCursor('ns-resize');
    } else if (isOnTimeScale) {
      setCursor('crosshair');
    } else if (isInChartArea || isInExtendedPatternArea) {
      setCursor('crosshair');
    }

    if (isOnPriceScale && hoveredTagIndex === undefined) {
      setHoveredMAIndex(undefined);
      setTooltipData({
        candle: null,
        x: 0,
        y: 0,
        visible: false,
      });
      return;
    }

    if (isOnTimeScale) {
      setHoveredMAIndex(undefined);
      setTooltipData({
        candle: null,
        x: 0,
        y: 0,
        visible: false,
      });
      return;
    }

    const hoveredOrderForTooltip = getHoveredOrder(mouseX, mouseY);
    const hoveredOrderIdForTooltip = hoveredOrderForTooltip?.id || null;

    if (hoveredOrderForTooltip && candles.length > 0) {
      if (hoveredOrderIdForTooltip !== lastTooltipOrderRef.current) {
        lastTooltipOrderRef.current = hoveredOrderIdForTooltip;
        const currentPrice = candles[candles.length - 1]?.close;
        const rect = canvasRef.current?.getBoundingClientRect();
        setTooltipData({
          candle: null,
          x: mouseX,
          y: mouseY,
          visible: true,
          containerWidth: rect?.width,
          containerHeight: rect?.height,
          order: hoveredOrderForTooltip,
          ...(currentPrice && { currentPrice }),
        });
      }
      return;
    }

    if (!hoveredOrderForTooltip && lastTooltipOrderRef.current) {
      lastTooltipOrderRef.current = null;
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

    if (hoveredTagIndex !== undefined) {
      closestMAIndex = hoveredTagIndex;
    } else {
      const effectiveWidth = dimensions.chartWidth - (advancedConfig?.rightMargin ?? CHART_CONFIG.CHART_RIGHT_MARGIN);
      const visibleRange = viewport.end - viewport.start;
      const widthPerCandle = effectiveWidth / visibleRange;
      const { candleWidth } = viewport;
      const candleCenterOffset = (widthPerCandle - candleWidth) / 2 + candleWidth / 2;

      movingAverages.forEach((ma, index) => {
        if (ma.visible === false) return;

        const maValues = calculateMovingAverage(candles, ma.period, ma.type);
        const startIndex = Math.max(0, Math.floor(viewport.start));
        const endIndex = Math.min(candles.length, Math.ceil(viewport.end));

        for (let i = startIndex; i < endIndex - 1; i++) {
          const value1 = maValues[i];
          const value2 = maValues[i + 1];

          if (value1 === null || value1 === undefined || value2 === null || value2 === undefined) continue;

          const x1 = manager.indexToX(i) + candleCenterOffset;
          const y1 = manager.priceToY(value1);
          const x2 = manager.indexToX(i + 1) + candleCenterOffset;
          const y2 = manager.priceToY(value2);

          const distance = distanceToLine(mouseX, mouseY, x1, y1, x2, y2);

          if (distance < HOVER_THRESHOLD && distance < closestMADistance) {
            closestMADistance = distance;
            closestMAIndex = index;
            closestMAValue = (value1 + value2) / 2;
          }
        }
      });
    }

    setHoveredMAIndex(closestMAIndex);
    manager.markDirty('overlays');

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
        manager.markDirty('overlays');
        return;
      }
    }

    if (hoveredAIPattern) {
      setTooltipData({
        candle: null,
        x: mouseX,
        y: mouseY,
        visible: true,
        containerWidth: rect.width,
        containerHeight: rect.height,
        aiPattern: hoveredAIPattern,
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
    setOrderPreview(null);
    setHoveredAIPattern(null);
    setHoveredOrderId(null);
    lastHoveredOrderRef.current = null;
    lastTooltipOrderRef.current = null;
    setIsMeasuring(false);
    setMeasurementArea(null);
    setTooltipData({
      candle: null,
      x: 0,
      y: 0,
      visible: false,
    });
    if (manager) {
      manager.markDirty('overlays');
    }
  };

  const handleAIPatternHover = useCallback((pattern: AIPattern | null): void => {
    if (isContextMenuOpen) return;
    setHoveredAIPattern(pattern);
  }, [isContextMenuOpen]);

  const handleContextMenuOpenChange = useCallback((open: boolean): void => {
    if (open) {
      setContextMenuPattern(hoveredAIPattern);
    } else {
      setContextMenuPattern(null);
    }
    setIsContextMenuOpen(open);
  }, [hoveredAIPattern]);

  const handleDeleteSinglePattern = (patternId: number): void => {
    if (!patternId) return;
    console.log('[ChartCanvas] handleDeleteSinglePatterncalled:', patternId, 'onDeleteAIPattern exists:', !!onDeleteAIPattern);
    onDeleteAIPattern?.(patternId);
    setContextMenuPattern(null);
    setIsContextMenuOpen(false);
  };

  const handleDeletePatterns = (): void => {
    onDeleteAIPatterns?.();
    setContextMenuPattern(null);
    setIsContextMenuOpen(false);
  };

  const handleTogglePatternsVisibility = (): void => {
    onToggleAIPatternsVisibility?.();
  };

  const startInteraction = (): void => {
    setIsInteracting(true);
    if (interactionTimeoutRef.current) {
      clearTimeout(interactionTimeoutRef.current);
      interactionTimeoutRef.current = null;
    }
  };

  const endInteraction = (): void => {
    if (interactionTimeoutRef.current) {
      clearTimeout(interactionTimeoutRef.current);
    }
    interactionTimeoutRef.current = setTimeout(() => {
      setIsInteracting(false);
      interactionTimeoutRef.current = null;
    }, 300);
  };

  const handleCanvasMouseDown = (event: React.MouseEvent<HTMLCanvasElement>): void => {
    if (!manager || !canvasRef.current) return;

    if (event.button === RIGHT_MOUSE_BUTTON) {
      return;
    }

    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    const sltpAtPosition = getSLTPAtPosition(mouseX, mouseY);

    const clickedOrderId = getClickedOrderId(mouseX, mouseY);
    if (clickedOrderId) {
      setOrderToClose(clickedOrderId);
      return;
    }

    if (sltpAtPosition) {
      if (orderDragHandler.handleSLTPMouseDown(mouseX, mouseY, sltpAtPosition)) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
    }

    if (isSimulatorActive && (shiftPressed || altPressed)) {
      event.preventDefault();
      event.stopPropagation();

      const price = manager.yToPrice(mouseY);

      if (shiftPressed) {
        handleLongEntry(price);
      } else if (altPressed) {
        handleShortEntry(price);
      }
      return;
    }

    if (!shiftPressed && !altPressed && orderDragHandler.handleMouseDown(mouseX, mouseY)) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

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
        manager.markDirty('overlays');
        return;
      }
    }

    handleMouseDown(event);
    startInteraction();
  };

  const handleCanvasMouseUp = (): void => {
    if (orderDragHandler.isDragging) {
      orderDragHandler.handleMouseUp();
      return;
    }

    if (isMeasuring) {
      setIsMeasuring(false);
      setMeasurementArea(null);
      if (manager) {
        manager.markDirty('overlays');
      }
      return;
    }

    handleMouseUp();
    endInteraction();
  };

  const handleWheel = (): void => {
    startInteraction();
    endInteraction();
  };

  const handleResetView = (): void => {
    if (manager) {
      manager.resetToInitialView();
    }
  };

  const handleNextCandle = (): void => {
    if (manager) {
      manager.panToNextCandle();
    }
  };

  useEffect(() => {
    return () => {
      if (interactionTimeoutRef.current) {
        clearTimeout(interactionTimeoutRef.current);
        interactionTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!showStochastic || candles.length === 0) {
      setStochasticData(null);
      return;
    }

    const calculate = async (): Promise<void> => {
      try {
        const result = await calculateStochastic(candles, 14, 3);
        setStochasticData(result);
      } catch (error) {
        console.error('Failed to calculate stochastic:', error);
        setStochasticData(null);
      }
    };

    calculate();
  }, [showStochastic, candles, calculateStochastic]);

  useEffect(() => {
    if (!manager || !advancedConfig) return;

    if (advancedConfig.rightMargin !== undefined) {
      manager.setRightMargin(advancedConfig.rightMargin);
    }
  }, [manager, advancedConfig]);

  useEffect(() => {
    if (!manager) return;
    const height = showStochastic ? CHART_CONFIG.STOCHASTIC_PANEL_HEIGHT : 0;
    manager.setStochasticPanelHeight(height);
  }, [manager, showStochastic]);

  useEffect(() => {
    if (!manager) return;
    const height = showRSI ? CHART_CONFIG.RSI_PANEL_HEIGHT : 0;
    manager.setRSIPanelHeight(height);
  }, [manager, showRSI]);

  useEffect(() => {
    if (candles.length < 50) return;

    setupService.updateConfig(setupConfig);
    const detectedSetups = setupService.detectSetups(candles);
    
    detectedSetups.forEach((setup) => {
      const existing = useSetupStore.getState().detectedSetups.find(s => s.id === setup.id);
      if (!existing) {
        addDetectedSetup(setup);
        
        const { isAutoTradingActive } = useSetupStore.getState();
        const { isSimulatorActive: simActive, activeWalletId: walletId, wallets } = useTradingStore.getState();
        
        if (isAutoTradingActive && simActive && walletId && symbol) {
          const wallet = wallets.find(w => w.id === walletId);
          if (!wallet) return;
          
          const riskAmount = wallet.balance * 0.02;
          const stopDistance = Math.abs(setup.entryPrice - setup.stopLoss);
          const quantity = stopDistance > 0 ? Math.floor(riskAmount / stopDistance) : 1;
          
          if (quantity <= 0 || wallet.balance < setup.entryPrice * quantity) return;
          
          const currentPrice = candles[candles.length - 1]?.close;
          const isLong = setup.direction === 'LONG';
          const subType: 'limit' | 'stop' = currentPrice !== undefined && 
            ((isLong && setup.entryPrice < currentPrice) || (!isLong && setup.entryPrice > currentPrice)) 
            ? 'limit' : 'stop';
          
          addOrder({
            symbol,
            type: isLong ? 'long' : 'short',
            subType,
            status: 'pending',
            entryPrice: setup.entryPrice,
            quantity,
            walletId,
            stopLoss: setup.stopLoss,
            takeProfit: setup.takeProfit,
            ...(currentPrice !== undefined && { currentPrice }),
          });
          
          useSetupStore.getState().executeSetup(setup.id);
        }
      }
    });
  }, [candles, setupConfig, setupService, addDetectedSetup, addOrder, symbol]);

  useEffect(() => {
    if (!shiftPressed && !altPressed) {
      setOrderPreview(null);
      return;
    }

    if (mousePosition && manager && isSimulatorActive) {
      const dimensions = manager.getDimensions();
      if (!dimensions) return;

      const timeScaleTop = dimensions.height - CHART_CONFIG.CANVAS_PADDING_BOTTOM;

      if (mousePosition.y < timeScaleTop) {
        const price = manager.yToPrice(mousePosition.y);
        setOrderPreview({
          price,
          type: shiftPressed ? 'long' : 'short',
        });
      }
    }
  }, [shiftPressed, altPressed, mousePosition, manager, isSimulatorActive]);

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
      renderStochastic();
      renderRSI();
      renderCurrentPriceLine_Line();
      renderOrderLines();

      if (orderDragHandler.isDragging && orderDragHandler.draggedOrder && orderDragHandler.previewPrice && manager) {
        const ctx = manager.getContext();
        const dimensions = manager.getDimensions();
        if (!ctx || !dimensions) return;

        const { dragType, previewPrice, draggedOrder } = orderDragHandler;
        const y = manager.priceToY(previewPrice);

        let color: string;
        let label: string;
        let isDashed = true;

        if (dragType === 'entry' && draggedOrder.status === 'pending') {
          const willExecuteImmediately =
            (draggedOrder.type === 'long' && previewPrice <= currentPrice) ||
            (draggedOrder.type === 'short' && previewPrice >= currentPrice);

          if (willExecuteImmediately) {
            color = 'rgba(59, 130, 246, 0.9)';
            label = `${draggedOrder.type === 'long' ? 'L' : 'S'} ${currentPrice.toFixed(2)} [MARKET]`;
            isDashed = false;
          } else {
            color = 'rgba(100, 116, 139, 0.7)';
            label = `${draggedOrder.type === 'long' ? 'L' : 'S'} ${previewPrice.toFixed(2)} [PENDING]`;
          }
        } else {
          const isStopLoss = dragType === 'stopLoss';
          color = isStopLoss ? 'rgba(239, 68, 68, 0.7)' : 'rgba(34, 197, 94, 0.7)';
          label = `${isStopLoss ? 'SL' : 'TP'} ${previewPrice.toFixed(2)}`;
        }

        ctx.save();
        ctx.globalAlpha = 0.8;
        ctx.strokeStyle = color;
        ctx.lineWidth = isDashed ? 1.5 : 2;
        if (isDashed) {
          ctx.setLineDash([5, 5]);
        }

        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(dimensions.chartWidth, y);
        ctx.stroke();

        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
        ctx.fillStyle = color;
        ctx.font = '11px monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';

        const labelPadding = 8;
        const textMetrics = ctx.measureText(label);
        const textWidth = textMetrics.width;
        const labelHeight = 18;
        const arrowWidth = 6;
        const labelWidth = textWidth + labelPadding * 2;

        ctx.beginPath();
        ctx.moveTo(labelWidth + arrowWidth, y);
        ctx.lineTo(labelWidth, y - labelHeight / 2);
        ctx.lineTo(0, y - labelHeight / 2);
        ctx.lineTo(0, y + labelHeight / 2);
        ctx.lineTo(labelWidth, y + labelHeight / 2);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.fillText(label, labelPadding, y);

        ctx.restore();
      }

      renderCurrentPriceLine_Label();
      renderCrosshairPriceLine();

      if (orderPreview && manager) {
        const ctx = manager.getContext();
        const dimensions = manager.getDimensions();
        if (!ctx || !dimensions) return;

        const y = manager.priceToY(orderPreview.price);
        const isLong = orderPreview.type === 'long';

        const willBeActive = false;

        const color = isLong ? colors.bullish : colors.bearish;
        const opacity = willBeActive ? 0.8 : 0.5; ctx.save();
        ctx.globalAlpha = opacity;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.setLineDash(willBeActive ? [] : [5, 5]);

        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(dimensions.chartWidth, y);
        ctx.stroke();

        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
        ctx.fillStyle = color;
        ctx.font = '11px monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';

        const statusLabel = willBeActive ? t('trading.active') : t('trading.pending');
        const directionSymbol = isLong ? '↑' : '↓';
        const label = `${directionSymbol} @ ${orderPreview.price.toFixed(2)} [${statusLabel}]`;
        const labelPadding = 8;
        const textMetrics = ctx.measureText(label);
        const textWidth = textMetrics.width;
        const labelHeight = 18;
        const arrowWidth = 6;
        const labelWidth = textWidth + labelPadding * 2;

        ctx.beginPath();
        ctx.moveTo(labelWidth + arrowWidth, y);
        ctx.lineTo(labelWidth, y - labelHeight / 2);
        ctx.lineTo(0, y - labelHeight / 2);
        ctx.lineTo(0, y + labelHeight / 2);
        ctx.lineTo(labelWidth, y + labelHeight / 2);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.fillText(label, labelPadding, y);

        ctx.restore();
      }

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
    renderGrid,
    renderVolume,
    renderCandles,
    renderLineChart,
    renderMovingAverages,
    renderStochastic,
    renderRSI,
    renderCurrentPriceLine_Line,
    renderCurrentPriceLine_Label,
    renderCrosshairPriceLine,
    renderOrderLines,
    chartType,
    mousePosition,
    measurementArea,
    isMeasuring,
    orderPreview,
    showMeasurementArea,
    showMeasurementRuler,
    colors,
    orders,
    hoveredOrderId,
    orderDragHandler,
    currentPrice,
  ]);

  return (
    <>
      <Portal>
        <DialogRoot
          open={!!orderToClose}
          onOpenChange={(e) => !e.open && setOrderToClose(null)}
          placement="center"
        >
          <DialogBackdrop />
          <DialogPositioner>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('trading.closeOrder')}</DialogTitle>
                <DialogCloseTrigger />
              </DialogHeader>
              <DialogBody>
                {orderToClose && (() => {
                  if (orderToClose.startsWith('sltp-')) {
                    const parts = orderToClose.split('-');
                    const type = parts[1];
                    const typeLabel = type === 'stopLoss' ? 'Stop Loss' : 'Take Profit';

                    return (
                      <Box>
                        {t('trading.removeSLTPConfirm', { type: typeLabel })}
                      </Box>
                    );
                  }

                  const order = orders.find((o) => o.id === orderToClose);
                  if (!order || !manager) return null;

                  const candles = manager.getCandles();
                  if (!candles.length) return null;

                  const lastCandle = candles[candles.length - 1];
                  if (!lastCandle) return null;

                  const currentPrice = lastCandle.close;
                  const isLong = order.type === 'long';
                  const priceChange = currentPrice - order.entryPrice;
                  const percentChange = isLong
                    ? (priceChange / order.entryPrice) * 100
                    : (-priceChange / order.entryPrice) * 100;
                  const isProfit = percentChange >= 0;

                  return (
                    <Box>
                      <Box mb={4}>
                        {t('trading.closeOrderConfirm', {
                          type: order.type.toUpperCase(),
                          entry: order.entryPrice.toFixed(2),
                          current: currentPrice.toFixed(2),
                        })}
                      </Box>
                      <Box
                        fontSize="lg"
                        fontWeight="bold"
                        color={isProfit ? 'green.500' : 'red.500'}
                      >
                        {percentChange >= 0 ? '+' : ''}{percentChange.toFixed(2)}%
                      </Box>
                    </Box>
                  );
                })()}
              </DialogBody>
              <DialogFooter>
                <DialogActionTrigger asChild>
                  <Button variant="outline">{t('common.cancel')}</Button>
                </DialogActionTrigger>
                <Button
                  onClick={handleConfirmCloseOrder}
                  colorPalette="red"
                >
                  {t('trading.confirmClose')}
                </Button>
              </DialogFooter>
            </DialogContent>
          </DialogPositioner>
        </DialogRoot>
      </Portal>
      <Box
        position="relative"
        width={width}
        height={height}
        overflow="hidden"
        bg={colors.background}
        userSelect="none"
      >
        <ChartContextMenuManager
          hoveredPattern={contextMenuPattern ?? hoveredAIPattern}
          onDeletePattern={handleDeleteSinglePattern}
          onDeleteDetectedPattern={onDeletePattern ?? (() => { })}
          onDeleteAllPatterns={handleDeletePatterns}
          onTogglePatternsVisibility={handleTogglePatternsVisibility}
          hasPatterns={aiPatterns.length > 0}
          patternsVisible={aiPatternsVisible}
          onOpenChange={handleContextMenuOpenChange}
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
        </ChartContextMenuManager>
        {manager && !isInteracting && (
          <PatternRenderer
            canvasManager={manager}
            candles={candles}
            patterns={aiPatterns}
            width={canvasRef.current?.width ?? 0}
            height={canvasRef.current?.height ?? 0}
            mousePosition={mousePosition}
            onPatternHover={handleAIPatternHover}
            advancedConfig={advancedConfig}
          />
        )}
        {manager && !isInteracting && (
          <SetupRenderer
            canvasManager={manager}
            candles={candles}
            setups={detectedSetups.filter((s) => s.visible)}
            width={canvasRef.current?.width ?? 0}
            height={canvasRef.current?.height ?? 0}
            mousePosition={mousePosition}
            onSetupHover={handleSetupHover}
          />
        )}
        <ChartNavigation
          onResetView={handleResetView}
          onNextCandle={handleNextCandle}
          stochasticPanelHeight={showStochastic ? CHART_CONFIG.STOCHASTIC_PANEL_HEIGHT : 0}
          rsiPanelHeight={showRSI ? CHART_CONFIG.RSI_PANEL_HEIGHT : 0}
        />
        <CandleTimer
          timeframe={timeframe}
          lastCandleTime={candles[candles.length - 1]?.timestamp}
          stochasticPanelHeight={showStochastic ? CHART_CONFIG.STOCHASTIC_PANEL_HEIGHT : 0}
          rsiPanelHeight={showRSI ? CHART_CONFIG.RSI_PANEL_HEIGHT : 0}
        />
        <ChartTooltip
          candle={tooltipData.candle}
          x={tooltipData.x}
          y={tooltipData.y}
          visible={tooltipData.visible}
          containerWidth={tooltipData.containerWidth ?? window.innerWidth}
          containerHeight={tooltipData.containerHeight ?? window.innerHeight}
          aiPattern={tooltipData.aiPattern}
          {...(tooltipData.movingAverage && { movingAverage: tooltipData.movingAverage })}
          {...(tooltipData.measurement && { measurement: tooltipData.measurement })}
          {...(tooltipData.order && { order: tooltipData.order })}
          {...(tooltipData.currentPrice && { currentPrice: tooltipData.currentPrice })}
        />
      </Box>
    </>
  );
};
