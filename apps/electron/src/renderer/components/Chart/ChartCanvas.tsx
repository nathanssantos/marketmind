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
import { calculateFibonacciProjection, calculateMovingAverage, type StochasticResult } from '@marketmind/indicators';
import type { Kline, MarketType, Order, Viewport } from '@marketmind/types';
import { useBackendAutoTrading } from '@renderer/hooks/useBackendAutoTrading';
import { useBackendTradingMutations } from '@renderer/hooks/useBackendTradingMutations';
import { useBackendWallet } from '@renderer/hooks/useBackendWallet';
import { useChartColors } from '@renderer/hooks/useChartColors';
import { useLocalStorage } from '@renderer/hooks/useLocalStorage';
import { useADXWorker } from '@renderer/hooks/useADXWorker';
import { useAOWorker } from '@renderer/hooks/useAOWorker';
import { useAroonWorker } from '@renderer/hooks/useAroonWorker';
import { useCCIWorker } from '@renderer/hooks/useCCIWorker';
import { useCMFWorker } from '@renderer/hooks/useCMFWorker';
import { useDonchianWorker } from '@renderer/hooks/useDonchianWorker';
import { useElderRayWorker } from '@renderer/hooks/useElderRayWorker';
import { useIchimokuWorker } from '@renderer/hooks/useIchimokuWorker';
import { useKeltnerWorker } from '@renderer/hooks/useKeltnerWorker';
import { useKlingerWorker } from '@renderer/hooks/useKlingerWorker';
import { useMACDWorker } from '@renderer/hooks/useMACDWorker';
import { useMFIWorker } from '@renderer/hooks/useMFIWorker';
import { useOBVWorker } from '@renderer/hooks/useOBVWorker';
import { useParabolicSARWorker } from '@renderer/hooks/useParabolicSARWorker';
import { useROCWorker } from '@renderer/hooks/useROCWorker';
import { useRSIWorker } from '@renderer/hooks/useRSIWorker';
import { useStochasticWorker } from '@renderer/hooks/useStochasticWorker';
import { useStochRSIWorker } from '@renderer/hooks/useStochRSIWorker';
import { useSupertrendWorker } from '@renderer/hooks/useSupertrendWorker';
import { useVortexWorker } from '@renderer/hooks/useVortexWorker';
import { useWilliamsRWorker } from '@renderer/hooks/useWilliamsRWorker';
import { useTSIWorker } from '@renderer/hooks/useTSIWorker';
import { usePPOWorker } from '@renderer/hooks/usePPOWorker';
import { useCMOWorker } from '@renderer/hooks/useCMOWorker';
import { useUltimateOscWorker } from '@renderer/hooks/useUltimateOscWorker';
import { useDEMAWorker } from '@renderer/hooks/useDEMAWorker';
import { useTEMAWorker } from '@renderer/hooks/useTEMAWorker';
import { useWMAWorker } from '@renderer/hooks/useWMAWorker';
import { useHMAWorker } from '@renderer/hooks/useHMAWorker';
import { usePivotPointsWorker } from '@renderer/hooks/usePivotPointsWorker';
import { useFibonacciWorker } from '@renderer/hooks/useFibonacciWorker';
import { useFVGWorker } from '@renderer/hooks/useFVGWorker';
import { useLiquidityLevelsWorker } from '@renderer/hooks/useLiquidityLevelsWorker';
import { useToast } from '@renderer/hooks/useToast';
import { useTradingShortcuts } from '@renderer/hooks/useTradingShortcuts';
import { useIndicatorStore, useSetupStore } from '@renderer/store';
import { useShallow } from 'zustand/shallow';
import { usePriceStore } from '@renderer/store/priceStore';
import { useStrategyVisualizationStore } from '@renderer/store/strategyVisualizationStore';
import { trpc } from '@renderer/utils/trpc';
import { CHART_CONFIG } from '@shared/constants';
import { getKlineClose, getKlineHigh, getKlineLow, getKlineOpen, getKlineVolume, isOrderLong, isOrderPending } from '@shared/utils';
import type React from 'react';
import type { ReactElement } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AdvancedControlsConfig } from './AdvancedControls';
import { ChartNavigation } from './ChartNavigation';
import { ChartTooltip } from './ChartTooltip';
import { KlineTimer } from './KlineTimer';
import { useATRRenderer } from './useATRRenderer';
import { useBollingerBandsRenderer } from './useBollingerBandsRenderer';
import { useChartCanvas } from './useChartCanvas';
import { useCrosshairPriceLineRenderer } from './useCrosshairPriceLineRenderer';
import { useCurrentPriceLineRenderer } from './useCurrentPriceLineRenderer';
import { useGridRenderer } from './useGridRenderer';
import { useKlineRenderer } from './useKlineRenderer';
import { useLineChartRenderer } from './useLineChartRenderer';
import { useMovingAverageRenderer, type MovingAverageConfig } from './useMovingAverageRenderer';
import { useOrderDragHandler } from './useOrderDragHandler';
import { useOrderLinesRenderer, type BackendExecution } from './useOrderLinesRenderer';
import { useRSIRenderer } from './useRSIRenderer';
import { useStochasticRenderer } from './useStochasticRenderer';
import { useVolumeRenderer } from './useVolumeRenderer';
import { useVWAPRenderer } from './useVWAPRenderer';
import { useWatermarkRenderer } from './useWatermarkRenderer';
import { useADXRenderer } from './useADXRenderer';
import { useAORenderer } from './useAORenderer';
import { useAroonRenderer } from './useAroonRenderer';
import { useCCIRenderer } from './useCCIRenderer';
import { useCMFRenderer } from './useCMFRenderer';
import { useDonchianRenderer } from './useDonchianRenderer';
import { useElderRayRenderer } from './useElderRayRenderer';
import { useIchimokuRenderer } from './useIchimokuRenderer';
import { useKeltnerRenderer } from './useKeltnerRenderer';
import { useKlingerRenderer } from './useKlingerRenderer';
import { useMACDRenderer } from './useMACDRenderer';
import { useMFIRenderer } from './useMFIRenderer';
import { useOBVRenderer } from './useOBVRenderer';
import { useParabolicSARRenderer } from './useParabolicSARRenderer';
import { useROCRenderer } from './useROCRenderer';
import { useStochRSIRenderer } from './useStochRSIRenderer';
import { useSupertrendRenderer } from './useSupertrendRenderer';
import { useVortexRenderer } from './useVortexRenderer';
import { useWilliamsRRenderer } from './useWilliamsRRenderer';
import { useTSIRenderer } from './useTSIRenderer';
import { usePPORenderer } from './usePPORenderer';
import { useCMORenderer } from './useCMORenderer';
import { useUltimateOscRenderer } from './useUltimateOscRenderer';
import { useDEMARenderer } from './useDEMARenderer';
import { useTEMARenderer } from './useTEMARenderer';
import { useWMARenderer } from './useWMARenderer';
import { useHMARenderer } from './useHMARenderer';
import { usePivotPointsRenderer } from './usePivotPointsRenderer';
import { useFibonacciRenderer } from './useFibonacciRenderer';
import { useFibonacciProjectionRenderer } from './useFibonacciProjectionRenderer';
import { useFVGRenderer } from './useFVGRenderer';
import { useLiquidityLevelsRenderer } from './useLiquidityLevelsRenderer';

const RIGHT_MOUSE_BUTTON = 2;

export interface ChartCanvasProps {
  klines: Kline[];
  symbol?: string;
  marketType?: MarketType;
  width?: string | number;
  height?: string | number;
  initialViewport?: Viewport;
  onViewportChange?: (viewport: Viewport) => void;
  showGrid?: boolean;
  showVolume?: boolean;
  showStochastic?: boolean;
  showRSI?: boolean;
  showBollingerBands?: boolean;
  showATR?: boolean;
  showVWAP?: boolean;
  showCurrentPriceLine?: boolean;
  showCrosshair?: boolean;
  showProfitLossAreas?: boolean;
  showFibonacciProjection?: boolean;
  showMeasurementRuler?: boolean;
  showMeasurementArea?: boolean;
  showTooltip?: boolean;
  movingAverages?: MovingAverageConfig[];
  chartType?: 'kline' | 'line';
  advancedConfig?: AdvancedControlsConfig;
  onToggleSetupsVisibility?: () => void;
  setupsVisible?: boolean;
  timeframe?: string;
}

export const ChartCanvas = ({
  klines,
  symbol,
  marketType,
  width = '100%',
  height = '600px',
  initialViewport,
  onViewportChange,
  showGrid = true,
  showVolume = true,
  showStochastic = false,
  showRSI = false,
  showBollingerBands = false,
  showATR = false,
  showVWAP = false,
  showCurrentPriceLine = true,
  showCrosshair = true,
  showProfitLossAreas = true,
  showFibonacciProjection = false,
  showMeasurementRuler = false,
  showMeasurementArea = false,
  showTooltip = true,
  movingAverages = [],
  chartType = 'kline',
  advancedConfig,
  onToggleSetupsVisibility: _onToggleSetupsVisibility,
  setupsVisible: _setupsVisible = true,
  timeframe = '1h',
}: ChartCanvasProps): ReactElement => {
  const { t } = useTranslation();
  const { warning } = useToast();
  const colors = useChartColors();

  const { wallets } = useBackendWallet();
  const backendWalletId = wallets[0]?.id;
  const {
    createOrder: addBackendOrder,
    closeExecution,
    updateExecutionSLTP,
  } = useBackendTradingMutations();

  const hasTradingEnabled = !!backendWalletId;

  const [quantityBySymbol] = useLocalStorage<Record<string, number>>('marketmind:quantityBySymbol', {});
  const getQuantityForSymbol = (sym: string) => quantityBySymbol[sym] ?? 1;

  const detectedSetups = useSetupStore((state) => state.detectedSetups);

  const highlightedCandlesRef = useRef(useStrategyVisualizationStore.getState().highlightedCandles);
  useEffect(() => {
    const unsubscribe = useStrategyVisualizationStore.subscribe((state) => {
      highlightedCandlesRef.current = state.highlightedCandles;
    });
    return () => unsubscribe();
  }, []);

  const { watcherStatus } = useBackendAutoTrading(backendWalletId ?? '');
  const isAutoTradingActive = watcherStatus?.active ?? false;

  const { data: backendExecutions } = trpc.autoTrading.getActiveExecutions.useQuery(
    { walletId: backendWalletId ?? '', limit: 50 },
    {
      enabled: !!backendWalletId && !!symbol,
      refetchInterval: 10000,
    }
  );

  const filteredBackendExecutions = useMemo((): BackendExecution[] => {
    if (!backendExecutions || !symbol) return [];
    const currentMarketType = marketType || 'SPOT';
    return backendExecutions
      .filter(exec => exec.symbol === symbol && (exec.marketType || 'SPOT') === currentMarketType)
      .map(exec => ({
        id: exec.id,
        symbol: exec.symbol,
        side: exec.side,
        entryPrice: exec.entryPrice,
        quantity: exec.quantity,
        stopLoss: exec.stopLoss,
        takeProfit: exec.takeProfit,
        status: exec.status,
        setupType: exec.setupType,
        marketType: exec.marketType,
        openedAt: exec.openedAt,
        triggerKlineOpenTime: exec.triggerKlineOpenTime,
        fibonacciProjection: exec.fibonacciProjection ? JSON.parse(exec.fibonacciProjection) : null,
      }));
  }, [backendExecutions, symbol, marketType]);
  const hoveredSetup = null as ReturnType<typeof useSetupStore.getState>['detectedSetups'][0] | null;

  const handleLongEntry = useCallback((price: number) => {
    if (!backendWalletId) {
      warning(t('trading.ticket.noWallet'));
      return;
    }
    if (!symbol) return;

    addBackendOrder({
      walletId: backendWalletId,
      symbol,
      side: 'BUY',
      type: 'LIMIT',
      price: price.toString(),
      quantity: (getQuantityForSymbol(symbol) ?? 1).toString(),
    });
  }, [addBackendOrder, symbol, getQuantityForSymbol, warning, t, backendWalletId]);

  const handleShortEntry = useCallback((price: number) => {
    if (!backendWalletId) {
      warning(t('trading.ticket.noWallet'));
      return;
    }
    if (!symbol) return;

    addBackendOrder({
      walletId: backendWalletId,
      symbol,
      side: 'SELL',
      type: 'LIMIT',
      price: price.toString(),
      quantity: (getQuantityForSymbol(symbol) ?? 1).toString(),
    });
  }, [addBackendOrder, symbol, getQuantityForSymbol, warning, t, backendWalletId]);

  const { shiftPressed, altPressed } = useTradingShortcuts({
    onLongEntry: handleLongEntry,
    onShortEntry: handleShortEntry,
    enabled: hasTradingEnabled && !isAutoTradingActive,
  });

  const [tooltipData, setTooltipData] = useState<{
    kline: Kline | null;
    x: number;
    y: number;
    visible: boolean;
    containerWidth?: number;
    containerHeight?: number;
    klineIndex?: number;
    movingAverage?: {
      period: number;
      type: 'SMA' | 'EMA';
      color: string;
      value?: number;
    };
    measurement?: {
      klineCount: number;
      priceChange: number;
      percentChange: number;
      startPrice: number;
      endPrice: number;
    };
    order?: Order;
    currentPrice?: number;
    setup?: typeof hoveredSetup;
  }>({
    kline: null,
    x: 0,
    y: 0,
    visible: false,
  });
  const mousePositionRef = useRef<{ x: number; y: number } | null>(null);
  const orderPreviewRef = useRef<{ price: number; type: 'long' | 'short' } | null>(null);
  const hoveredMAIndexRef = useRef<number | undefined>(undefined);
  const hoveredOrderIdRef = useRef<string | null>(null);
  const lastHoveredOrderRef = useRef<string | null>(null);
  const lastTooltipOrderRef = useRef<string | null>(null);
  const interactionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const cursorRef = useRef<'crosshair' | 'ns-resize' | 'grab' | 'grabbing' | 'pointer'>('crosshair');
  const mouseMoveRafRef = useRef<number | null>(null);
  const pendingMouseEventRef = useRef<{ x: number; y: number; rect: DOMRect } | null>(null);
  const tooltipEnabledRef = useRef(true);
  const tooltipDebounceRef = useRef<NodeJS.Timeout | null>(null);

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
  const rsiWorkerData = useRSIWorker(klines, 2, showRSI);

  const activeIndicators = useIndicatorStore(useShallow((s) => s.activeIndicators));
  const isIndicatorActive = useCallback((id: string): boolean => activeIndicators.includes(id as never), [activeIndicators]);

  const parabolicSarData = useParabolicSARWorker(klines, isIndicatorActive('parabolicSar'));
  const keltnerData = useKeltnerWorker(klines, isIndicatorActive('keltner'));
  const donchianData = useDonchianWorker(klines, isIndicatorActive('donchian'));
  const obvData = useOBVWorker(klines, isIndicatorActive('obv'));
  const cmfData = useCMFWorker(klines, isIndicatorActive('cmf'));
  const stochRsiData = useStochRSIWorker(klines, isIndicatorActive('stochRsi'));
  const macdData = useMACDWorker(klines, isIndicatorActive('macd'));
  const adxData = useADXWorker(klines, isIndicatorActive('adx'));
  const williamsRData = useWilliamsRWorker(klines, isIndicatorActive('williamsR'));
  const cciData = useCCIWorker(klines, isIndicatorActive('cci'));
  const supertrendData = useSupertrendWorker(klines, isIndicatorActive('supertrend'));
  const ichimokuData = useIchimokuWorker(klines, isIndicatorActive('ichimoku'));
  const klingerData = useKlingerWorker(klines, isIndicatorActive('klinger'));
  const elderRayData = useElderRayWorker(klines, isIndicatorActive('elderRay'));
  const aroonData = useAroonWorker(klines, isIndicatorActive('aroon'));
  const vortexData = useVortexWorker(klines, isIndicatorActive('vortex'));
  const mfiData = useMFIWorker(klines, isIndicatorActive('mfi'));
  const rocData = useROCWorker(klines, isIndicatorActive('roc'));
  const aoData = useAOWorker(klines, isIndicatorActive('ao'));
  const tsiData = useTSIWorker(klines, isIndicatorActive('tsi'));
  const ppoData = usePPOWorker(klines, isIndicatorActive('ppo'));
  const cmoData = useCMOWorker(klines, isIndicatorActive('cmo'));
  const ultimateOscData = useUltimateOscWorker(klines, isIndicatorActive('ultimateOsc'));
  const demaData = useDEMAWorker(klines, isIndicatorActive('dema'));
  const temaData = useTEMAWorker(klines, isIndicatorActive('tema'));
  const wmaData = useWMAWorker(klines, isIndicatorActive('wma'));
  const hmaData = useHMAWorker(klines, isIndicatorActive('hma'));
  const pivotPointsData = usePivotPointsWorker(klines, isIndicatorActive('pivotPoints'));
  const fibonacciData = useFibonacciWorker(klines, isIndicatorActive('fibonacci'));
  const fvgData = useFVGWorker(klines, isIndicatorActive('fvg'));
  const liquidityLevelsData = useLiquidityLevelsWorker(klines, isIndicatorActive('liquidityLevels'));

  const {
    canvasRef,
    manager,
    isPanning,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleMouseLeave,
  } = useChartCanvas({
    klines,
    ...(initialViewport !== undefined && { initialViewport }),
    ...(onViewportChange !== undefined && { onViewportChange }),
  });

  useEffect(() => {
    if (isPanning) {
      tooltipEnabledRef.current = false;
      if (tooltipDebounceRef.current) clearTimeout(tooltipDebounceRef.current);
      setTooltipData({ kline: null, x: 0, y: 0, visible: false });
    } else {
      tooltipDebounceRef.current = setTimeout(() => {
        tooltipEnabledRef.current = true;
      }, 150);
    }
    return () => {
      if (tooltipDebounceRef.current) clearTimeout(tooltipDebounceRef.current);
    };
  }, [isPanning]);

  const updateCursor = useCallback((newCursor: typeof cursorRef.current) => {
    if (cursorRef.current !== newCursor) {
      cursorRef.current = newCursor;
      if (canvasRef.current) canvasRef.current.style.cursor = newCursor;
    }
  }, [canvasRef]);

  const handleConfirmCloseOrder = useCallback(async (): Promise<void> => {
    if (!orderToClose || !manager) return;

    const exec = filteredBackendExecutions.find((e) => e.id === orderToClose);
    if (exec) {
      const klines = manager.getKlines();
      const lastKline = klines[klines.length - 1];
      const exitPrice = lastKline ? getKlineClose(lastKline).toString() : '0';
      await closeExecution(exec.id, exitPrice);
    }

    setOrderToClose(null);
  }, [orderToClose, manager, filteredBackendExecutions, closeExecution]);

  const { render: renderGrid } = useGridRenderer({
    manager,
    colors,
    enabled: showGrid,
    timeframe,
    ...(advancedConfig?.gridLineWidth !== undefined && { gridLineWidth: advancedConfig.gridLineWidth }),
    ...(advancedConfig?.paddingRight !== undefined && { paddingRight: advancedConfig.paddingRight }),
    ...(advancedConfig?.rightMargin !== undefined && { rightMargin: advancedConfig.rightMargin }),
  });

  const { render: renderKlines } = useKlineRenderer({
    manager,
    colors,
    enabled: chartType === 'kline',
    ...(advancedConfig?.rightMargin !== undefined && { rightMargin: advancedConfig.rightMargin }),
    ...(advancedConfig?.klineWickWidth !== undefined && { klineWickWidth: advancedConfig.klineWickWidth }),
    ...(tooltipData.klineIndex !== undefined && { hoveredKlineIndex: tooltipData.klineIndex }),
    highlightedCandlesRef,
  });

  const { render: renderLineChart } = useLineChartRenderer({
    manager,
    colors,
    enabled: chartType === 'line',
    ...(advancedConfig?.rightMargin !== undefined && { rightMargin: advancedConfig.rightMargin }),
  });

  const maValuesCache = useMemo(() => {
    const cache = new Map<string, (number | null)[]>();
    for (const ma of movingAverages) {
      if (ma.visible === false) continue;
      const key = `${ma.type}-${ma.period}`;
      cache.set(key, calculateMovingAverage(klines, ma.period, ma.type));
    }
    return cache;
  }, [klines, movingAverages]);

  const { render: renderVolume } = useVolumeRenderer({
    manager,
    colors,
    enabled: showVolume,
    ...(advancedConfig?.rightMargin !== undefined && { rightMargin: advancedConfig.rightMargin }),
    ...(advancedConfig?.volumeHeightRatio !== undefined && { volumeHeightRatio: advancedConfig.volumeHeightRatio }),
    ...(tooltipData.klineIndex !== undefined && { hoveredKlineIndex: tooltipData.klineIndex }),
    timeframe,
    showVolumeMA: true,
  });

  const { render: renderMovingAverages, getHoveredMATag } = useMovingAverageRenderer({
    manager,
    movingAverages,
    ...(advancedConfig?.rightMargin !== undefined && { rightMargin: advancedConfig.rightMargin }),
    hoveredMAIndexRef,
    maValuesCache,
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

  const { render: renderBollingerBands } = useBollingerBandsRenderer({
    manager,
    colors,
    enabled: showBollingerBands,
  });

  const { render: renderATR } = useATRRenderer({
    manager,
    colors,
    enabled: showATR,
  });

  const { render: renderVWAP } = useVWAPRenderer({
    manager,
    enabled: showVWAP,
  });

  const { render: renderParabolicSAR } = useParabolicSARRenderer({
    manager,
    parabolicSarData,
    colors,
    enabled: isIndicatorActive('parabolicSar'),
  });

  const { render: renderKeltner } = useKeltnerRenderer({
    manager,
    keltnerData,
    colors,
    enabled: isIndicatorActive('keltner'),
  });

  const { render: renderDonchian } = useDonchianRenderer({
    manager,
    donchianData,
    colors,
    enabled: isIndicatorActive('donchian'),
  });

  const { render: renderOBV } = useOBVRenderer({
    manager,
    obvData,
    colors,
    enabled: isIndicatorActive('obv'),
  });

  const { render: renderCMF } = useCMFRenderer({
    manager,
    cmfData,
    colors,
    enabled: isIndicatorActive('cmf'),
  });

  const { render: renderStochRSI } = useStochRSIRenderer({
    manager,
    stochRsiData,
    colors,
    enabled: isIndicatorActive('stochRsi'),
  });

  const { render: renderMACD } = useMACDRenderer({
    manager,
    macdData,
    colors,
    enabled: isIndicatorActive('macd'),
  });

  const { render: renderADX } = useADXRenderer({
    manager,
    adxData,
    colors,
    enabled: isIndicatorActive('adx'),
  });

  const { render: renderWilliamsR } = useWilliamsRRenderer({
    manager,
    williamsRData,
    colors,
    enabled: isIndicatorActive('williamsR'),
  });

  const { render: renderCCI } = useCCIRenderer({
    manager,
    cciData,
    colors,
    enabled: isIndicatorActive('cci'),
  });

  const { render: renderSupertrend } = useSupertrendRenderer({
    manager,
    supertrendData,
    colors,
    enabled: isIndicatorActive('supertrend'),
  });

  const { render: renderIchimoku } = useIchimokuRenderer({
    manager,
    ichimokuData,
    colors,
    enabled: isIndicatorActive('ichimoku'),
  });

  const { render: renderKlinger } = useKlingerRenderer({
    manager,
    klingerData,
    colors,
    enabled: isIndicatorActive('klinger'),
  });

  const { render: renderElderRay } = useElderRayRenderer({
    manager,
    elderRayData,
    colors,
    enabled: isIndicatorActive('elderRay'),
  });

  const { render: renderAroon } = useAroonRenderer({
    manager,
    aroonData,
    colors,
    enabled: isIndicatorActive('aroon'),
  });

  const { render: renderVortex } = useVortexRenderer({
    manager,
    vortexData,
    colors,
    enabled: isIndicatorActive('vortex'),
  });

  const { render: renderMFI } = useMFIRenderer({
    manager,
    mfiData,
    colors,
    enabled: isIndicatorActive('mfi'),
  });

  const { render: renderROC } = useROCRenderer({
    manager,
    rocData,
    colors,
    enabled: isIndicatorActive('roc'),
  });

  const { render: renderAO } = useAORenderer({
    manager,
    aoData,
    colors,
    enabled: isIndicatorActive('ao'),
  });

  const { render: renderTSI } = useTSIRenderer({
    manager,
    tsiData,
    colors,
    enabled: isIndicatorActive('tsi'),
  });

  const { render: renderPPO } = usePPORenderer({
    manager,
    ppoData,
    colors,
    enabled: isIndicatorActive('ppo'),
  });

  const { render: renderCMO } = useCMORenderer({
    manager,
    cmoData,
    colors,
    enabled: isIndicatorActive('cmo'),
  });

  const { render: renderUltimateOsc } = useUltimateOscRenderer({
    manager,
    ultimateOscData,
    colors,
    enabled: isIndicatorActive('ultimateOsc'),
  });

  const { render: renderDEMA } = useDEMARenderer({
    manager,
    demaData,
    colors,
    enabled: isIndicatorActive('dema'),
  });

  const { render: renderTEMA } = useTEMARenderer({
    manager,
    temaData,
    colors,
    enabled: isIndicatorActive('tema'),
  });

  const { render: renderWMA } = useWMARenderer({
    manager,
    wmaData,
    colors,
    enabled: isIndicatorActive('wma'),
  });

  const { render: renderHMA } = useHMARenderer({
    manager,
    hmaData,
    colors,
    enabled: isIndicatorActive('hma'),
  });

  const { render: renderPivotPoints } = usePivotPointsRenderer({
    manager,
    pivotData: pivotPointsData,
    colors,
    enabled: isIndicatorActive('pivotPoints'),
  });

  const { render: renderFibonacci } = useFibonacciRenderer({
    manager,
    fibonacciData,
    colors,
    enabled: isIndicatorActive('fibonacci'),
  });

  const { render: renderFVG } = useFVGRenderer({
    manager,
    fvgData,
    colors,
    enabled: isIndicatorActive('fvg'),
  });

  const { render: renderLiquidityLevels } = useLiquidityLevelsRenderer({
    manager,
    liquidityData: liquidityLevelsData,
    colors,
    enabled: isIndicatorActive('liquidityLevels'),
  });

  const fibonacciProjectionData = useMemo(() => {
    const activePosition = filteredBackendExecutions.find(
      exec => (exec.status === 'open' || exec.status === 'pending')
    );

    if (activePosition) {
      if (activePosition.fibonacciProjection) {
        return activePosition.fibonacciProjection;
      }

      if (manager) {
        const klines = manager.getKlines();
        if (klines.length > 0) {
          const triggerTime = activePosition.triggerKlineOpenTime;
          let entryIndex = -1;

          if (triggerTime) {
            const triggerTimestamp = typeof triggerTime === 'number' ? triggerTime : new Date(triggerTime).getTime();
            entryIndex = klines.findIndex(k => k.openTime === triggerTimestamp);
          }

          if (entryIndex !== -1) {
            const direction = activePosition.side as 'LONG' | 'SHORT';
            const projection = calculateFibonacciProjection(klines, entryIndex, 100, direction);

            if (projection) {
              return {
                swingLow: projection.swingLow,
                swingHigh: projection.swingHigh,
                levels: projection.levels,
                primaryLevel: 2,
                range: projection.range,
              };
            }
          }
        }
      }
    }

    const visibleSetup = detectedSetups.find(s => s.visible && s.fibonacciProjection);
    return visibleSetup?.fibonacciProjection ?? null;
  }, [filteredBackendExecutions, detectedSetups, manager]);

  const { render: renderFibonacciProjection } = useFibonacciProjectionRenderer({
    manager,
    projectionData: fibonacciProjectionData,
    colors,
    enabled: showFibonacciProjection,
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
    mousePositionRef,
    lineWidth: 1,
    lineStyle: 'solid',
    ...(advancedConfig?.rightMargin !== undefined && { rightMargin: advancedConfig.rightMargin }),
  });

  const { renderOrderLines, getClickedOrderId, getOrderAtPosition, getHoveredOrder, getSLTPAtPosition } = useOrderLinesRenderer(manager, hasTradingEnabled, hoveredOrderIdRef, filteredBackendExecutions, detectedSetups.filter(s => s.visible), showProfitLossAreas);

  const { render: renderWatermark } = useWatermarkRenderer({
    manager,
    colors,
    symbol,
    timeframe,
    marketType,
    enabled: true,
  });

  const currentKlines = manager?.getKlines() ?? [];
  const lastKline = currentKlines[currentKlines.length - 1];
  const currentPrice = lastKline ? getKlineClose(lastKline) : 0;
  const currentPriceRef = useRef(currentPrice);
  currentPriceRef.current = currentPrice;

  const updatePrice = usePriceStore((s) => s.updatePrice);
  useEffect(() => {
    if (symbol && currentPrice > 0 && !isPanning) {
      updatePrice(symbol, currentPrice, 'chart');
    }
  }, [symbol, currentPrice, updatePrice, isPanning]);

  const draggableOrders = useMemo((): Order[] => {
    return filteredBackendExecutions
      .filter(exec => exec.status === 'open' || exec.status === 'pending')
      .map(exec => ({
        id: exec.id,
        symbol: exec.symbol,
        orderId: 0,
        orderListId: -1,
        clientOrderId: exec.id,
        price: exec.entryPrice,
        origQty: exec.quantity,
        executedQty: exec.status === 'pending' ? '0' : exec.quantity,
        cummulativeQuoteQty: '0',
        status: exec.status === 'pending' ? 'NEW' as const : 'FILLED' as const,
        timeInForce: 'GTC' as const,
        type: exec.status === 'pending' ? 'LIMIT' as const : 'MARKET' as const,
        side: exec.side === 'LONG' ? 'BUY' : 'SELL',
        time: Date.now(),
        updateTime: Date.now(),
        isWorking: true,
        origQuoteOrderQty: '0',
        entryPrice: parseFloat(exec.entryPrice),
        quantity: parseFloat(exec.quantity),
        orderDirection: exec.side === 'LONG' ? 'long' : 'short',
        stopLoss: exec.stopLoss ? parseFloat(exec.stopLoss) : undefined,
        takeProfit: exec.takeProfit ? parseFloat(exec.takeProfit) : undefined,
        isAutoTrade: true,
        walletId: backendWalletId ?? '',
        setupType: exec.setupType ?? undefined,
        isPendingLimitOrder: exec.status === 'pending',
      } as Order));
  }, [filteredBackendExecutions, backendWalletId]);

  const handleUpdateOrder = useCallback((id: string, updates: Partial<Order>) => {
    if (!id) return;

    const updatePayload: { stopLoss?: number; takeProfit?: number } = {};

    if (updates.stopLoss !== undefined) {
      updatePayload.stopLoss = updates.stopLoss;
    }
    if (updates.takeProfit !== undefined) {
      updatePayload.takeProfit = updates.takeProfit;
    }

    if (Object.keys(updatePayload).length > 0) {
      updateExecutionSLTP(id, updatePayload).catch((error) => {
        console.error('Failed to update SL/TP:', error);
      });
    }
  }, [updateExecutionSLTP]);

  const orderDragHandler = useOrderDragHandler({
    orders: draggableOrders,
    updateOrder: handleUpdateOrder,
    priceToY: (price) => manager?.priceToY(price) ?? 0,
    yToPrice: (y) => manager?.yToPrice(y) ?? 0,
    enabled: hasTradingEnabled && draggableOrders.length > 0,
    getOrderAtPosition: (x, y) => getOrderAtPosition(x, y),
  });

  const processMouseMoveTooltip = useCallback((mouseX: number, mouseY: number, rect: DOMRect): void => {
    if (!manager || !tooltipEnabledRef.current) return;

    const viewport = manager.getViewport();
    const dimensions = manager.getDimensions();
    const bounds = manager.getBounds();

    if (!dimensions || !bounds) return;

    const priceScaleLeft = dimensions.width - (advancedConfig?.paddingRight ?? CHART_CONFIG.CANVAS_PADDING_RIGHT);
    const timeScaleTop = dimensions.height - CHART_CONFIG.CANVAS_PADDING_BOTTOM;
    const chartAreaRight = dimensions.chartWidth - (advancedConfig?.rightMargin ?? CHART_CONFIG.CHART_RIGHT_MARGIN);

    const isOnPriceScale = mouseX >= priceScaleLeft && mouseY < timeScaleTop;
    const isOnTimeScale = mouseY >= timeScaleTop;
    const isInChartArea = mouseX < chartAreaRight && mouseY < timeScaleTop;

    const hoveredTagIndex = getHoveredMATag(mouseX, mouseY);

    if (isOnPriceScale && hoveredTagIndex === undefined) {
      hoveredMAIndexRef.current = undefined;
      setTooltipData({ kline: null, x: 0, y: 0, visible: false });
      return;
    }

    if (isOnTimeScale) {
      hoveredMAIndexRef.current = undefined;
      setTooltipData({ kline: null, x: 0, y: 0, visible: false });
      return;
    }

    const hoveredOrderForTooltip = getHoveredOrder(mouseX, mouseY);
    const hoveredOrderIdForTooltip = hoveredOrderForTooltip?.id || null;

    if (hoveredOrderForTooltip && klines.length > 0) {
      if (hoveredOrderIdForTooltip !== lastTooltipOrderRef.current) {
        lastTooltipOrderRef.current = hoveredOrderIdForTooltip;
        const lastKline = klines[klines.length - 1];
        const currentPriceVal = lastKline ? getKlineClose(lastKline) : undefined;
        setTooltipData({
          kline: null, x: mouseX, y: mouseY, visible: true,
          containerWidth: rect?.width, containerHeight: rect?.height,
          order: hoveredOrderForTooltip,
          ...(currentPriceVal && { currentPrice: currentPriceVal }),
        });
      }
      return;
    }

    if (!hoveredOrderForTooltip && lastTooltipOrderRef.current) {
      lastTooltipOrderRef.current = null;
      setTooltipData({ kline: null, x: 0, y: 0, visible: false });
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
      let xx: number, yy: number;
      if (param < 0) { xx = x1; yy = y1; }
      else if (param > 1) { xx = x2; yy = y2; }
      else { xx = x1 + param * C; yy = y1 + param * D; }
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
    } else if (movingAverages.length > 0) {
      const effectiveWidth = dimensions.chartWidth - (advancedConfig?.rightMargin ?? CHART_CONFIG.CHART_RIGHT_MARGIN);
      const visibleRange = viewport.end - viewport.start;
      const widthPerKline = effectiveWidth / visibleRange;
      const { klineWidth } = viewport;
      const klineCenterOffset = (widthPerKline - klineWidth) / 2 + klineWidth / 2;

      for (let maIdx = 0; maIdx < movingAverages.length; maIdx++) {
        const ma = movingAverages[maIdx];
        if (!ma || ma.visible === false) continue;
        const cacheKey = `${ma.type}-${ma.period}`;
        const maValues = maValuesCache.get(cacheKey);
        if (!maValues) continue;

        const startIdx = Math.max(0, Math.floor(viewport.start));
        const endIdx = Math.min(klines.length, Math.ceil(viewport.end));

        for (let i = startIdx; i < endIdx - 1; i++) {
          const value1 = maValues[i];
          const value2 = maValues[i + 1];
          if (value1 === null || value1 === undefined || value2 === null || value2 === undefined) continue;

          const x1 = manager.indexToX(i) + klineCenterOffset;
          const y1 = manager.priceToY(value1);
          const x2 = manager.indexToX(i + 1) + klineCenterOffset;
          const y2 = manager.priceToY(value2);
          const distance = distanceToLine(mouseX, mouseY, x1, y1, x2, y2);

          if (distance < HOVER_THRESHOLD && distance < closestMADistance) {
            closestMADistance = distance;
            closestMAIndex = maIdx;
            closestMAValue = (value1 + value2) / 2;
          }
        }
        if (closestMADistance < HOVER_THRESHOLD * 0.5) break;
      }
    }

    hoveredMAIndexRef.current = closestMAIndex;

    if (closestMAIndex !== undefined) {
      const ma = movingAverages[closestMAIndex];
      if (ma) {
        setTooltipData({
          kline: null, x: mouseX, y: mouseY, visible: true,
          containerWidth: rect.width, containerHeight: rect.height,
          movingAverage: { period: ma.period, type: ma.type, color: ma.color, ...(closestMAValue !== undefined && { value: closestMAValue }) },
        });
        return;
      }
    }

    if (!isInChartArea) {
      setTooltipData({ kline: null, x: 0, y: 0, visible: false });
      return;
    }

    const effectiveChartWidth = chartAreaRight;
    const hoveredIndex = Math.floor(viewport.start + (mouseX / effectiveChartWidth) * (viewport.end - viewport.start));

    if (hoveredIndex >= 0 && hoveredIndex < klines.length) {
      const kline = klines[hoveredIndex];
      if (kline) {
        const x = manager.indexToX(hoveredIndex);
        const klineWidth = viewport.klineWidth;
        const visibleRange = viewport.end - viewport.start;
        const widthPerKline = chartAreaRight / visibleRange;
        const klineX = x + (widthPerKline - klineWidth) / 2;

        const openY = manager.priceToY(getKlineOpen(kline));
        const closeY = manager.priceToY(getKlineClose(kline));
        const highY = manager.priceToY(getKlineHigh(kline));
        const lowY = manager.priceToY(getKlineLow(kline));

        const bodyLeft = klineX;
        const bodyRight = klineX + klineWidth;
        const bodyTop = Math.min(openY, closeY);
        const bodyBottom = Math.max(openY, closeY);

        const volumeHeightRatio = advancedConfig?.volumeHeightRatio ?? CHART_CONFIG.VOLUME_HEIGHT_RATIO;
        const volumeOverlayHeight = dimensions.chartHeight * volumeHeightRatio;
        const volumeBaseY = dimensions.chartHeight;
        const volumeRatio = getKlineVolume(kline) / bounds.maxVolume;
        const barHeight = volumeRatio * volumeOverlayHeight;
        const volumeTop = volumeBaseY - barHeight;

        const isOnKlineBody = mouseX >= bodyLeft && mouseX <= bodyRight && mouseY >= bodyTop && mouseY <= bodyBottom;
        const isOnKlineWick = mouseX >= bodyLeft && mouseX <= bodyRight && mouseY >= highY && mouseY <= lowY;
        const isOnVolumeBar = showVolume && mouseX >= bodyLeft && mouseX <= bodyRight && mouseY >= volumeTop && mouseY <= volumeBaseY;

        if (isOnKlineBody || isOnKlineWick || isOnVolumeBar) {
          setTooltipData({
            kline, x: mouseX, y: mouseY, visible: true,
            containerWidth: rect.width, containerHeight: rect.height, klineIndex: hoveredIndex,
          });
          return;
        }
      }
    }

    setTooltipData({ kline: null, x: 0, y: 0, visible: false });
  }, [manager, klines, movingAverages, maValuesCache, advancedConfig, showVolume, getHoveredMATag, getHoveredOrder]);

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
      const klineCount = Math.abs(endIndex - startIndex);

      const startPrice = manager.yToPrice(measurementArea.startY);
      const endPrice = manager.yToPrice(mouseY);
      const priceChange = endPrice - startPrice;
      const percentChange = (priceChange / startPrice) * 100;

      setTooltipData({
        kline: null, x: mouseX, y: mouseY, visible: true,
        containerWidth: rect.width, containerHeight: rect.height,
        measurement: { klineCount, priceChange, percentChange, startPrice, endPrice },
      });

      mousePositionRef.current = { x: mouseX, y: mouseY };
      return;
    }

    handleMouseMove(event);

    if (isPanning) {
      mousePositionRef.current = { x: mouseX, y: mouseY };
      return;
    }

    if (!manager) return;

    const hoveredOrderButton = getClickedOrderId(mouseX, mouseY);
    const hoveredSLTP = getSLTPAtPosition(mouseX, mouseY);
    const hoveredOrder = hoveredSLTP ? null : getHoveredOrder(mouseX, mouseY);

    const newHoveredId = hoveredOrder?.id || null;
    if (newHoveredId !== lastHoveredOrderRef.current) {
      lastHoveredOrderRef.current = newHoveredId;
      hoveredOrderIdRef.current = newHoveredId;
      manager.markDirty('overlays');
    }

    if (orderDragHandler.isDragging) {
      updateCursor('ns-resize');
    } else if (hoveredOrderButton) {
      updateCursor('pointer');
    } else if (hoveredSLTP) {
      updateCursor('ns-resize');
    } else if (hoveredOrder) {
      updateCursor('ns-resize');
    } else if (cursorRef.current !== 'crosshair') {
      updateCursor('crosshair');
    }

    mousePositionRef.current = { x: mouseX, y: mouseY };
    manager.markDirty('overlays');

    const dimensions = manager.getDimensions();
    if (!dimensions) return;

    const priceScaleLeft = dimensions.width - (advancedConfig?.paddingRight ?? CHART_CONFIG.CANVAS_PADDING_RIGHT);
    const timeScaleTop = dimensions.height - CHART_CONFIG.CANVAS_PADDING_BOTTOM;
    const chartAreaRight = dimensions.chartWidth - (advancedConfig?.rightMargin ?? CHART_CONFIG.CHART_RIGHT_MARGIN);
    const lastKlineX = manager.indexToX(klines.length - 1);
    const patternExtensionArea = lastKlineX + CHART_CONFIG.PATTERN_EXTENSION_DISTANCE;
    const isInChartArea = mouseX < chartAreaRight && mouseY < timeScaleTop;
    const isInExtendedPatternArea = mouseX >= chartAreaRight && mouseX <= patternExtensionArea && mouseY < timeScaleTop;
    const isOnPriceScale = mouseX >= priceScaleLeft && mouseY < timeScaleTop;
    const isOnTimeScale = mouseY >= timeScaleTop;

    const hoveredTagIndex = getHoveredMATag(mouseX, mouseY);

    if (hoveredTagIndex !== undefined) updateCursor('pointer');
    else if (isOnPriceScale) updateCursor('ns-resize');
    else if (isOnTimeScale) updateCursor('crosshair');
    else if (isInChartArea || isInExtendedPatternArea) updateCursor('crosshair');

    if (hasTradingEnabled && !isAutoTradingActive && (shiftPressed || altPressed) && mouseY < timeScaleTop) {
      const price = manager.yToPrice(mouseY);
      orderPreviewRef.current = { price, type: shiftPressed ? 'long' : 'short' };
      manager.markDirty('overlays');
    } else if (orderPreviewRef.current !== null) {
      orderPreviewRef.current = null;
      manager.markDirty('overlays');
    }

    pendingMouseEventRef.current = { x: mouseX, y: mouseY, rect };
    if (mouseMoveRafRef.current === null) {
      mouseMoveRafRef.current = requestAnimationFrame(() => {
        mouseMoveRafRef.current = null;
        const pending = pendingMouseEventRef.current;
        if (pending) {
          processMouseMoveTooltip(pending.x, pending.y, pending.rect);
        }
      });
    }
  };

  const handleCanvasMouseLeave = (): void => {
    handleMouseLeave();
    mousePositionRef.current = null;
    orderPreviewRef.current = null;
    hoveredOrderIdRef.current = null;
    lastHoveredOrderRef.current = null;
    lastTooltipOrderRef.current = null;
    setIsMeasuring(false);
    setMeasurementArea(null);
    setTooltipData({
      kline: null,
      x: 0,
      y: 0,
      visible: false,
    });
    if (manager) {
      manager.markDirty('overlays');
    }
  };

  const startInteraction = (): void => {
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

    if (hasTradingEnabled && !isAutoTradingActive && (shiftPressed || altPressed)) {
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

  const handleNextKline = (): void => {
    if (manager) {
      manager.panToNextKline();
    }
  };

  useEffect(() => {
    return () => {
      if (interactionTimeoutRef.current) {
        clearTimeout(interactionTimeoutRef.current);
        interactionTimeoutRef.current = null;
      }
      if (mouseMoveRafRef.current !== null) {
        cancelAnimationFrame(mouseMoveRafRef.current);
        mouseMoveRafRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!showStochastic || klines.length === 0) {
      setStochasticData(null);
      return;
    }

    const calculate = async (): Promise<void> => {
      try {
        const result = await calculateStochastic(klines, 14, 3, 3);
        setStochasticData(result);
      } catch (error) {
        console.error('Failed to calculate stochastic:', error);
        setStochasticData(null);
      }
    };

    calculate();
  }, [showStochastic, klines, calculateStochastic]);

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
    if (!manager) return;
    const panelIndicators = [
      'obv', 'cmf', 'stochRsi', 'macd', 'adx', 'williamsR', 'cci',
      'klinger', 'elderRay', 'aroon', 'vortex', 'mfi', 'roc', 'ao',
      'tsi', 'ppo', 'cmo', 'ultimateOsc'
    ] as const;
    for (const indicator of panelIndicators) {
      const height = isIndicatorActive(indicator) ? CHART_CONFIG.RSI_PANEL_HEIGHT : 0;
      manager.setPanelHeight(indicator, height);
    }
  }, [manager, activeIndicators]);

  useEffect(() => {
    if (!shiftPressed && !altPressed) {
      orderPreviewRef.current = null;
      if (manager) manager.markDirty('overlays');
      return;
    }

    if (isAutoTradingActive) {
      orderPreviewRef.current = null;
      if (manager) manager.markDirty('overlays');
      return;
    }

    const mousePos = mousePositionRef.current;
    if (mousePos && manager && hasTradingEnabled) {
      const dimensions = manager.getDimensions();
      if (!dimensions) return;

      const timeScaleTop = dimensions.height - CHART_CONFIG.CANVAS_PADDING_BOTTOM;

      if (mousePos.y < timeScaleTop) {
        const price = manager.yToPrice(mousePos.y);
        orderPreviewRef.current = {
          price,
          type: shiftPressed ? 'long' : 'short',
        };
        manager.markDirty('overlays');
      }
    }
  }, [shiftPressed, altPressed, manager, hasTradingEnabled, isAutoTradingActive]);

  useEffect(() => {
    if (!manager) return;

    const render = (): void => {
      manager.clear();
      renderWatermark();
      renderGrid();
      renderVolume();
      if (chartType === 'kline') {
        renderKlines();
      } else {
        renderLineChart();
      }
      renderMovingAverages();
      renderStochastic();
      renderRSI();
      renderBollingerBands();
      renderATR();
      renderVWAP();
      renderParabolicSAR();
      renderKeltner();
      renderDonchian();
      renderSupertrend();
      renderIchimoku();
      renderDEMA();
      renderTEMA();
      renderWMA();
      renderHMA();
      renderPivotPoints();
      renderFibonacci();
      renderFibonacciProjection();
      renderFVG();
      renderLiquidityLevels();
      renderOBV();
      renderCMF();
      renderStochRSI();
      renderMACD();
      renderADX();
      renderWilliamsR();
      renderCCI();
      renderKlinger();
      renderElderRay();
      renderAroon();
      renderVortex();
      renderMFI();
      renderROC();
      renderAO();
      renderTSI();
      renderPPO();
      renderCMO();
      renderUltimateOsc();
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

        if (dragType === 'entry' && isOrderPending(draggedOrder)) {
          const isLong = isOrderLong(draggedOrder);
          const currentPriceValue = currentPriceRef.current;
          const willExecuteImmediately =
            (isLong && previewPrice <= currentPriceValue) ||
            (!isLong && previewPrice >= currentPriceValue);

          if (willExecuteImmediately) {
            color = 'rgba(59, 130, 246, 0.9)';
            label = `${isLong ? 'L' : 'S'} ${currentPriceValue.toFixed(2)} [MARKET]`;
            isDashed = false;
          } else {
            color = 'rgba(100, 116, 139, 0.7)';
            label = `${isLong ? 'L' : 'S'} ${previewPrice.toFixed(2)} [PENDING]`;
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

      const orderPreviewValue = orderPreviewRef.current;
      if (orderPreviewValue && manager && !isAutoTradingActive) {
        const ctx = manager.getContext();
        const dimensions = manager.getDimensions();
        if (!ctx || !dimensions) return;

        const y = manager.priceToY(orderPreviewValue.price);
        const isLong = orderPreviewValue.type === 'long';

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
        const label = `${directionSymbol} @ ${orderPreviewValue.price.toFixed(2)} [${statusLabel}]`;
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
    renderWatermark,
    renderGrid,
    renderVolume,
    renderKlines,
    renderLineChart,
    renderMovingAverages,
    renderStochastic,
    renderRSI,
    renderBollingerBands,
    renderATR,
    renderVWAP,
    renderParabolicSAR,
    renderKeltner,
    renderDonchian,
    renderSupertrend,
    renderIchimoku,
    renderOBV,
    renderCMF,
    renderStochRSI,
    renderMACD,
    renderADX,
    renderWilliamsR,
    renderCCI,
    renderKlinger,
    renderElderRay,
    renderAroon,
    renderVortex,
    renderMFI,
    renderROC,
    renderAO,
    renderTSI,
    renderPPO,
    renderCMO,
    renderUltimateOsc,
    renderDEMA,
    renderTEMA,
    renderWMA,
    renderHMA,
    renderPivotPoints,
    renderFibonacci,
    renderFVG,
    renderLiquidityLevels,
    renderCurrentPriceLine_Line,
    renderCurrentPriceLine_Label,
    renderCrosshairPriceLine,
    renderOrderLines,
    chartType,
    measurementArea,
    isMeasuring,
    showMeasurementArea,
    showMeasurementRuler,
    colors,
    filteredBackendExecutions,
    orderDragHandler,
    isAutoTradingActive,
    t,
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

                  const exec = filteredBackendExecutions.find((e) => e.id === orderToClose);
                  if (!exec || !manager) return null;

                  const klines = manager.getKlines();
                  if (!klines.length) return null;

                  const lastKline = klines[klines.length - 1];
                  if (!lastKline) return null;

                  const currentPriceVal = getKlineClose(lastKline);
                  const isLong = exec.side === 'LONG';
                  const entryPrice = parseFloat(exec.entryPrice);
                  const priceChange = currentPriceVal - entryPrice;
                  const percentChange = isLong
                    ? (priceChange / entryPrice) * 100
                    : (-priceChange / entryPrice) * 100;
                  const isProfit = percentChange >= 0;

                  return (
                    <Box>
                      <Box mb={4}>
                        {t('trading.closeOrderConfirm', {
                          type: exec.side,
                          entry: entryPrice.toFixed(2),
                          current: currentPriceVal.toFixed(2),
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
            cursor: 'crosshair',
            display: 'block',
          }}
        />
        <ChartNavigation
          onResetView={handleResetView}
          onNextKline={handleNextKline}
          totalPanelHeight={manager?.getTotalPanelHeight() ?? 0}
        />
        <KlineTimer
          timeframe={timeframe}
          lastKlineTime={klines[klines.length - 1]?.openTime}
          totalPanelHeight={manager?.getTotalPanelHeight() ?? 0}
        />
        {showTooltip && (
          <ChartTooltip
            kline={tooltipData.kline}
            x={tooltipData.x}
            y={tooltipData.y}
            visible={tooltipData.visible}
            containerWidth={tooltipData.containerWidth ?? window.innerWidth}
            containerHeight={tooltipData.containerHeight ?? window.innerHeight}
            {...(tooltipData.movingAverage && { movingAverage: tooltipData.movingAverage })}
            {...(tooltipData.measurement && { measurement: tooltipData.measurement })}
            {...(tooltipData.order && { order: tooltipData.order })}
            {...(tooltipData.currentPrice && { currentPrice: tooltipData.currentPrice })}
            {...(tooltipData.setup && { setup: tooltipData.setup })}
          />
        )}
      </Box>
    </>
  );
};
