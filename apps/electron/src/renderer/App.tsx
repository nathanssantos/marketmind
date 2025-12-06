import { Box, ChakraProvider, Text as ChakraText, IconButton, Toaster } from '@chakra-ui/react';
import { CHART_CONFIG } from '@shared/constants/chartConfig';
import type { AIPattern, Kline, Viewport } from '@shared/types';
import { getKlineClose, getKlineHigh, getKlineLow, getKlineVolume, getOrderId, isOrderActive, isOrderLong, isOrderPending } from '@shared/utils';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { LuX } from 'react-icons/lu';
import { AutoAuth } from './components/Auth/AutoAuth';
import type { AdvancedControlsConfig } from './components/Chart/AdvancedControls';
import { ChartCanvas } from './components/Chart/ChartCanvas';
import { PinnedControlsProvider } from './components/Chart/PinnedControlsContext';
import type { Timeframe } from './components/Chart/TimeframeSelector';
import type { MovingAverageConfig } from './components/Chart/useMovingAverageRenderer';
import { MainLayout } from './components/Layout/MainLayout';
import { Toolbar } from './components/Layout/Toolbar';
import { NewsDialog } from './components/News/NewsDialog';
import { OnboardingDialog } from './components/Onboarding/OnboardingDialog';
import { BacktestDialog } from './components/Trading/BacktestDialog';
import { TrpcProvider } from './components/TrpcProvider';
import { ErrorMessage } from './components/ui/ErrorMessage';
import { LoadingSpinner } from './components/ui/LoadingSpinner';
import { UpdateNotification } from './components/Update/UpdateNotification';
import { ChartProvider, useChartContext } from './context/ChartContext';
import { useGlobalActions } from './context/GlobalActionsContext';
import { PatternHoverProvider } from './context/PatternHoverContext';
import { useAppSettings } from './hooks/useAppSettings';
import { useBackendKlines, useKlineStream } from './hooks/useBackendKlines';
import { useCalendar } from './hooks/useCalendar';
import { useChartData } from './hooks/useChartData';
import { useDebounce } from './hooks/useDebounce';
import { useGlobalKeyboardShortcuts } from './hooks/useGlobalKeyboardShortcuts';
import { useLocalStorage } from './hooks/useLocalStorage';
import { useNews } from './hooks/useNews';
import { usePatterns } from './hooks/usePatterns';
import { useAIStore } from './store/aiStore';
import { useTradingStore } from './store/tradingStore';
import { system } from './theme';
import { toaster } from './utils/toaster';

const DEFAULT_MOVING_AVERAGES: MovingAverageConfig[] = [
  {
    period: 9,
    type: 'EMA',
    color: '#ff9800',
    lineWidth: 2,
    visible: true,
  },
  {
    period: 20,
    type: 'EMA',
    color: '#2196f3',
    lineWidth: 2,
    visible: true,
  },
  {
    period: 50,
    type: 'EMA',
    color: '#4caf50',
    lineWidth: 2,
    visible: false,
  },
  {
    period: 100,
    type: 'EMA',
    color: '#9c27b0',
    lineWidth: 2,
    visible: false,
  },
  {
    period: 200,
    type: 'EMA',
    color: '#f44336',
    lineWidth: 2,
    visible: false,
  },
];

function App(): ReactElement {
  return (
    <TrpcProvider>
      <ChakraProvider value={system}>
        <AutoAuth>
          <Toaster toaster={toaster}>
            {(toast) => {
              const { t } = useTranslation();
              return (
                <Box
                  key={toast.id}
                  p={4}
                  bg={
                    toast.type === 'error'
                      ? 'red.500'
                      : toast.type === 'success'
                        ? 'green.500'
                        : toast.type === 'warning'
                          ? 'orange.500'
                          : 'blue.500'
                  }
                  color="white"
                  borderRadius="md"
                  boxShadow="lg"
                  maxW="400px"
                  position="relative"
                >
                  <IconButton
                    aria-label={t('common.close')}
                    size="xs"
                    position="absolute"
                    top={2}
                    right={2}
                    onClick={() => toaster.dismiss(toast.id)}
                    variant="ghost"
                    color="white"
                    _hover={{ bg: 'whiteAlpha.200' }}
                  >
                    <LuX />
                  </IconButton>
                  <ChakraText fontWeight="bold" mb={1} pr={6}>
                    {toast.title}
                  </ChakraText>
                  {toast.description && (
                    <ChakraText fontSize="sm">{toast.description}</ChakraText>
                  )}
                </Box>
              );
            }}
          </Toaster>
          <PatternHoverProvider>
            <ChartProvider>
              <PinnedControlsProvider>
                <AppContent />
              </PinnedControlsProvider>
            </ChartProvider>
          </PatternHoverProvider>
        </AutoAuth>
      </ChakraProvider>
    </TrpcProvider>
  );
}

function AppContent(): ReactElement {
  const { t } = useTranslation();
  const [symbol, setSymbol] = useLocalStorage('marketmind:symbol', 'BTCUSDT');
  const [viewport, setViewport] = useState<Viewport | undefined>(undefined);

  const activeConversationId = useAIStore(state => state.activeConversationId);
  const { detectedPatterns } = useChartContext();

  const {
    patterns,
    patternsVisible,
    deletePattern,
    deleteAllPatterns,
    togglePatternsVisibility,
    processAIResponse,
  } = usePatterns({ symbol, conversationId: activeConversationId });

  // TEMPORARY: Disabled to debug infinite loop
  // usePatternDetectionWorker();
  // useAutoPatternDetection(viewport);
  // const { detectPatterns } = useManualPatternDetection(addPatterns);
  // useSimulatorLayout();
  // usePriceUpdates();
  // useOrderNotifications();

  const [showVolume, setShowVolume] = useLocalStorage('marketmind:showVolume', true);
  const [showGrid, setShowGrid] = useLocalStorage('marketmind:showGrid', true);
  const [showCurrentPriceLine, setShowCurrentPriceLine] = useLocalStorage('marketmind:showCurrentPriceLine', true);
  const [showCrosshair, setShowCrosshair] = useLocalStorage('marketmind:showCrosshair', true);
  const [showMeasurementRuler, setShowMeasurementRuler] = useLocalStorage('marketmind:showMeasurementRuler', false);
  const [showMeasurementArea, setShowMeasurementArea] = useLocalStorage('marketmind:showMeasurementArea', false);
  const [showStochastic, setShowStochastic] = useLocalStorage('marketmind:showStochastic', false);
  const [showRSI, setShowRSI] = useLocalStorage('marketmind:showRSI', false);
  const [chartType, setChartType] = useLocalStorage<'kline' | 'line'>('marketmind:chartType', 'kline');
  const [timeframe, setTimeframe] = useLocalStorage<Timeframe>('marketmind:timeframe', '1d');
  const [showOnboarding, setShowOnboarding] = useLocalStorage('marketmind:showOnboarding', true);
  const [isChatOpen, setIsChatOpen] = useLocalStorage('chat-sidebar-open', true);
  const [isTradingOpen, setIsTradingOpen] = useLocalStorage('trading-sidebar-open', false);
  const [isNewsOpen, setIsNewsOpen] = useLocalStorage('news-sidebar-open', false);
  const [isBacktestOpen, setIsBacktestOpen] = useState(false);
  const [movingAverages, setMovingAverages] = useLocalStorage<MovingAverageConfig[]>(
    'marketmind:movingAverages',
    DEFAULT_MOVING_AVERAGES
  );

  const { settings: appSettings } = useAppSettings();

  const [advancedConfig, setAdvancedConfig] = useLocalStorage<AdvancedControlsConfig>('marketmind:advancedConfig', {
    rightMargin: CHART_CONFIG.CHART_RIGHT_MARGIN,
    volumeHeightRatio: CHART_CONFIG.VOLUME_HEIGHT_RATIO,
    klineSpacing: CHART_CONFIG.KLINE_SPACING,
    klineWickWidth: CHART_CONFIG.KLINE_WICK_WIDTH,
    gridLineWidth: CHART_CONFIG.GRID_LINE_WIDTH,
    currentPriceLineWidth: CHART_CONFIG.CURRENT_PRICE_LINE_WIDTH,
    currentPriceLineStyle: CHART_CONFIG.CURRENT_PRICE_LINE_STYLE,
    paddingTop: CHART_CONFIG.CANVAS_PADDING_TOP,
    paddingBottom: CHART_CONFIG.CANVAS_PADDING_BOTTOM,
    paddingLeft: CHART_CONFIG.CANVAS_PADDING_LEFT,
    paddingRight: CHART_CONFIG.CANVAS_PADDING_RIGHT,
  });

  const syncWithElectron = useTradingStore((state) => state.syncWithElectron);
  const syncAIStore = useAIStore((state) => state.syncWithElectron);

  useEffect(() => {
    void syncWithElectron();
    void syncAIStore();
  }, []);

  const restoreActiveConversation = useAIStore((state) => state.restoreActiveConversation);
  const setActiveConversationBySymbol = useAIStore((state) => state.setActiveConversationBySymbol);
  const getActiveConversation = useAIStore((state) => state.getActiveConversation);

  const isSimulatorActive = useTradingStore((state) => state.isSimulatorActive);
  const toggleSimulator = useTradingStore((state) => state.toggleSimulator);

  const toggleChat = useCallback(() => {
    setIsChatOpen((prev) => !prev);
  }, [setIsChatOpen]);

  const toggleTrading = useCallback(() => {
    setIsTradingOpen((prev) => !prev);
  }, [setIsTradingOpen]);

  const toggleBacktest = useCallback(() => {
    setIsBacktestOpen((prev) => !prev);
  }, []);

  const toggleNews = useCallback(() => {
    setIsNewsOpen((prev) => !prev);
  }, []);

  const viewportRef = useRef<Viewport | undefined>(undefined);

  useEffect(() => {
    viewportRef.current = viewport;
  }, [viewport]);

  // TEMPORARY: Disabled to debug infinite loop
  // const handleDetectPatterns = useCallback((): void => {
  //   if (viewportRef.current) {
  //     void detectPatterns(viewportRef.current);
  //   }
  // }, [detectPatterns]);

  useEffect(() => {
    restoreActiveConversation();
  }, []);

  useEffect(() => {
    const activeConv = getActiveConversation();
    if (activeConv?.symbol !== symbol) {
      setActiveConversationBySymbol(symbol);
    }
  }, [symbol]);

  const { useKlineList } = useBackendKlines();
  const backendKlinesQuery = useKlineList({
    symbol,
    interval: timeframe as any,
    limit: 500,
  });

  useEffect(() => {
    console.log('[App] Backend klines query state:', {
      isLoading: backendKlinesQuery.isLoading,
      dataLength: backendKlinesQuery.data?.length ?? 0,
      error: backendKlinesQuery.error?.message,
      symbol,
      timeframe,
    });
  }, [backendKlinesQuery.isLoading, backendKlinesQuery.data, backendKlinesQuery.error, symbol, timeframe]);

  const marketData = useMemo(() => {
    if (!backendKlinesQuery.data || backendKlinesQuery.data.length === 0) {
      console.log('[App] No market data:', {
        hasData: !!backendKlinesQuery.data,
        length: backendKlinesQuery.data?.length
      });
      return null;
    }

    console.log('[App] Processing market data:', backendKlinesQuery.data.length, 'klines');

    const getIntervalMs = (interval: string): number => {
      const units: Record<string, number> = {
        s: 1000,
        m: 60 * 1000,
        h: 60 * 60 * 1000,
        d: 24 * 60 * 60 * 1000,
        w: 7 * 24 * 60 * 60 * 1000,
        M: 30 * 24 * 60 * 60 * 1000,
      };
      const match = interval.match(/(\d+)([smhdwM])/);
      if (!match?.[1] || !match[2]) return 60 * 60 * 1000;
      const value = Number.parseInt(match[1], 10);
      const unit = match[2];
      return value * (units[unit] ?? 60 * 60 * 1000) - 1;
    };

    const parseOpenTime = (time: unknown): number => {
      if (typeof time === 'string') return new Date(time).getTime();
      if (time instanceof Date) return time.getTime();
      return Number(time);
    };

    const klines: Kline[] = backendKlinesQuery.data.map((k, index, arr) => {
      const openTime = parseOpenTime(k.openTime);

      let closeTime: number;
      if (index < arr.length - 1) {
        const nextKline = arr[index + 1];
        if (nextKline) {
          closeTime = parseOpenTime(nextKline.openTime) - 1;
        } else {
          closeTime = openTime + getIntervalMs(timeframe);
        }
      } else {
        closeTime = openTime + getIntervalMs(timeframe);
      }

      if (index === 0) {
        console.log('[App] First kline from backend:', {
          takerBuyBaseVolume: k.takerBuyBaseVolume,
          volume: k.volume,
          quoteVolume: k.quoteVolume,
          trades: k.trades,
        });
      }

      return {
        openTime,
        closeTime,
        open: k.open,
        high: k.high,
        low: k.low,
        close: k.close,
        volume: k.volume,
        quoteVolume: k.quoteVolume || '0',
        trades: k.trades || 0,
        takerBuyBaseVolume: k.takerBuyBaseVolume || '0',
        takerBuyQuoteVolume: k.takerBuyQuoteVolume || '0',
      };
    });

    return {
      symbol,
      interval: timeframe,
      klines,
    };
  }, [backendKlinesQuery.data, symbol, timeframe]);

  const loading = backendKlinesQuery.isLoading;
  const error = backendKlinesQuery.error ? new Error(backendKlinesQuery.error.message) : null;

  const [liveKlines, setLiveKlines] = useState<Kline[]>([]);
  const previousPriceRef = useRef<number | null>(null);
  const appLoadTimeRef = useRef(Date.now());
  const pendingUpdateRef = useRef<{ kline: Kline; isFinal: boolean } | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const lastOrderUpdateRef = useRef<number>(0);

  useEffect(() => {
    setLiveKlines([]);
    previousPriceRef.current = null;
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    pendingUpdateRef.current = null;
  }, [symbol, timeframe]);

  const handleRealtimeUpdate = useCallback((kline: Kline, isFinal: boolean) => {
    pendingUpdateRef.current = { kline, isFinal };

    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
    }

    rafIdRef.current = requestAnimationFrame(() => {
      const update = pendingUpdateRef.current;
      if (!update) return;

      const { kline: latestKline, isFinal: finalFlag } = update;
      const currentPrice = getKlineClose(latestKline);
      const previousPrice = previousPriceRef.current;

      const now = Date.now();
      const shouldUpdateOrders = now - lastOrderUpdateRef.current > 500;

      if (previousPrice !== null && previousPrice !== currentPrice && shouldUpdateOrders) {
        const state = useTradingStore.getState();
        if (state.isSimulatorActive) {
          const hasPendingOrders = state.orders.some(o => isOrderPending(o) && o.symbol === symbol);
          if (hasPendingOrders) {
            state.fillPendingOrders(symbol, currentPrice, previousPrice, appLoadTimeRef.current);
          }

          const activeOrders = state.orders.filter(o => isOrderActive(o) && o.symbol === symbol);
          activeOrders.forEach(order => {
            const isLong = isOrderLong(order);

            state.updateOrder(getOrderId(order), { currentPrice });

            if (order.stopLoss) {
              const stopHit = isLong
                ? getKlineLow(latestKline) <= order.stopLoss
                : getKlineHigh(latestKline) >= order.stopLoss;

              if (stopHit) {
                const orderId = getOrderId(order);
                console.log(`[OCO] Stop Loss hit for order ${orderId.slice(0, 8)}... at ${order.stopLoss} (${isLong ? 'LONG' : 'SHORT'})`);
                state.closeOrder(orderId, order.stopLoss);
                return;
              }
            }

            if (order.takeProfit) {
              const targetHit = isLong
                ? getKlineHigh(latestKline) >= order.takeProfit
                : getKlineLow(latestKline) <= order.takeProfit;

              if (targetHit) {
                const orderId = getOrderId(order);
                console.log(`[OCO] Take Profit hit for order ${orderId.slice(0, 8)}... at ${order.takeProfit} (${isLong ? 'LONG' : 'SHORT'})`);
                state.closeOrder(orderId, order.takeProfit);
                return;
              }
            }
          });
        }
        lastOrderUpdateRef.current = now;
      }

      previousPriceRef.current = currentPrice;

      setLiveKlines(prev => {
        if (prev.length === 0) return [latestKline];

        const lastKline = prev[prev.length - 1];
        if (!lastKline) return [latestKline];

        if (latestKline.openTime === lastKline.openTime) {
          if (getKlineClose(latestKline) === getKlineClose(lastKline) &&
            getKlineHigh(latestKline) === getKlineHigh(lastKline) &&
            getKlineLow(latestKline) === getKlineLow(lastKline) &&
            getKlineVolume(latestKline) === getKlineVolume(lastKline)) return prev;
          return [...prev.slice(0, -1), latestKline];
        }

        if (latestKline.openTime > lastKline.openTime) {
          previousPriceRef.current = null;
          if (finalFlag) return [...prev, latestKline];
          return [...prev, latestKline];
        }

        return prev;
      });

      rafIdRef.current = null;
      pendingUpdateRef.current = null;
    });
  }, [symbol]);

  const handleKlineStreamUpdate = useCallback((backendKline: any) => {
    console.log('[App] WebSocket kline update:', {
      close: backendKline.close,
      volume: backendKline.volume,
      isClosed: backendKline.isClosed,
    });

    const kline: Kline = {
      openTime: backendKline.openTime,
      closeTime: backendKline.closeTime,
      open: backendKline.open,
      high: backendKline.high,
      low: backendKline.low,
      close: backendKline.close,
      volume: backendKline.volume,
      quoteVolume: backendKline.quoteVolume || '0',
      trades: backendKline.trades || 0,
      takerBuyBaseVolume: backendKline.takerBuyBaseVolume || '0',
      takerBuyQuoteVolume: backendKline.takerBuyQuoteVolume || '0',
    };
    handleRealtimeUpdate(kline, backendKline.isClosed);
  }, [handleRealtimeUpdate]);

  useKlineStream(
    symbol,
    timeframe as any,
    handleKlineStreamUpdate,
    !!marketData
  );

  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, []);

  const displayKlines = useMemo(() => {
    if (!marketData?.klines) return [];
    if (liveKlines.length === 0) return marketData.klines;

    const baseKlines = marketData.klines;
    const lastBaseKline = baseKlines[baseKlines.length - 1];
    const firstLiveKline = liveKlines[0];

    if (lastBaseKline && firstLiveKline && firstLiveKline.openTime === lastBaseKline.openTime) {
      return [...baseKlines.slice(0, -1), ...liveKlines];
    }

    return [...baseKlines, ...liveKlines];
  }, [marketData?.klines, liveKlines]);

  const debouncedAdvancedConfig = useDebounce(advancedConfig, 300);

  const extractSymbolCode = (fullSymbol: string): string => {
    if (fullSymbol.endsWith('USDT')) {
      return fullSymbol.replace('USDT', '');
    }
    if (fullSymbol.endsWith('USD')) {
      return fullSymbol.replace('USD', '');
    }
    return fullSymbol;
  };

  // TEMPORARY: Disabled to debug infinite loop
  // const setResponseProcessor = useAIStore(state => state.setResponseProcessor);
  // const enableAIPatterns = useAIStore(state => state.enableAIPatterns);
  const processAIResponseRef = useRef(processAIResponse);

  useEffect(() => {
    processAIResponseRef.current = processAIResponse;
  }, [processAIResponse]);

  const handleDeletePattern = useCallback((patternId: number): void => {
    void deletePattern(patternId);
  }, []);

  // TEMPORARY: Disabled to debug infinite loop
  // useEffect(() => {
  //   if (enableAIPatterns && processAIResponseRef.current) {
  //     const stableProcessor = async (response: string) => {
  //       if (processAIResponseRef.current) {
  //         return processAIResponseRef.current(response);
  //       }
  //       return response;
  //     };
  //     setResponseProcessor(stableProcessor);
  //   } else {
  //     setResponseProcessor(null);
  //   }
  //   return () => setResponseProcessor(null);
  // }, [enableAIPatterns]);

  const currentSymbolCode = extractSymbolCode(symbol);
  const isCrypto = symbol.endsWith('USDT') || symbol.endsWith('USD');
  const shouldIncludeBTC = isCrypto && currentSymbolCode !== 'BTC';

  const newsSymbols = shouldIncludeBTC
    ? ['BTC', currentSymbolCode]
    : [currentSymbolCode];

  const { articles: newsArticles } = useNews({
    symbols: newsSymbols,
    limit: shouldIncludeBTC ? 15 : 10,
    enabled: appSettings.newsCorrelateWithAI,
    refetchInterval: appSettings.newsRefreshInterval,
  });

  const { events: calendarEvents } = useCalendar();

  const relevantEvents = appSettings.calendarCorrelateWithAI
    ? calendarEvents.filter(event => {
      if (!event.symbols || event.symbols.length === 0) return true;
      return event.symbols.some(s =>
        newsSymbols.some(ns => ns.toLowerCase() === s.toLowerCase())
      );
    })
    : [];

  useChartData({
    klines: displayKlines,
    symbol,
    timeframe,
    chartType,
    showVolume,
    movingAverages,
    news: newsArticles,
    events: relevantEvents,
  });

  const isAutoTradingActive = useAIStore((state) => state.isAutoTradingActive);

  // TEMPORARY: Disabled to debug infinite loop
  // const aiTrading = useAITrading({
  //   symbol,
  //   timeframe,
  //   chartType,
  //   klines: displayKlines,
  //   getCurrentPrice,
  // });

  // const { startTrading, stopTrading } = aiTrading;
  const startTrading = async () => { };
  const stopTrading = async () => { };

  useEffect(() => {
    console.log('[App] isAutoTradingActive changed:', isAutoTradingActive);

    if (isAutoTradingActive) {
      console.log('[App] Calling startTrading()...');
      void startTrading();
    } else {
      console.log('[App] Calling stopTrading()...');
      void stopTrading();
    }

  }, [isAutoTradingActive]);

  return (
    <>
      <Toolbar
        symbol={symbol}
        timeframe={timeframe}
        chartType={chartType}
        showVolume={showVolume}
        showGrid={showGrid}
        showCurrentPriceLine={showCurrentPriceLine}
        showCrosshair={showCrosshair}
        showMeasurementRuler={showMeasurementRuler}
        showMeasurementArea={showMeasurementArea}
        showStochastic={showStochastic}
        showRSI={showRSI}
        movingAverages={movingAverages}
        isSimulatorActive={isSimulatorActive}
        isTradingOpen={isTradingOpen}
        isChatOpen={isChatOpen}
        isNewsOpen={isNewsOpen}
        isBacktestOpen={isBacktestOpen}
        onSymbolChange={setSymbol}
        onTimeframeChange={setTimeframe}
        onChartTypeChange={setChartType}
        onShowVolumeChange={setShowVolume}
        onShowGridChange={setShowGrid}
        onShowCurrentPriceLineChange={setShowCurrentPriceLine}
        onShowCrosshairChange={setShowCrosshair}
        onShowMeasurementRulerChange={setShowMeasurementRuler}
        onShowMeasurementAreaChange={setShowMeasurementArea}
        onShowStochasticChange={setShowStochastic}
        onShowRSIChange={setShowRSI}
        onMovingAveragesChange={setMovingAverages}
        onToggleSimulator={toggleSimulator}
        onToggleBacktest={toggleBacktest}
        onToggleTrading={toggleTrading}
        onToggleChat={toggleChat}
        onToggleNews={toggleNews}
        onDetectPatterns={() => { }}
      />      <MainLayout
        onOpenSymbolSelector={() => { }}
        advancedConfig={advancedConfig}
        onAdvancedConfigChange={setAdvancedConfig}
        isChatOpen={isChatOpen}
        onToggleChat={toggleChat}
        isTradingOpen={isTradingOpen}
        onToggleTrading={toggleTrading}
      >
        <AppContentWithKeyboardShortcuts
          showVolume={showVolume}
          setShowVolume={setShowVolume}
          showGrid={showGrid}
          setShowGrid={setShowGrid}
          chartType={chartType}
          setChartType={setChartType}
          movingAverages={movingAverages}
          setMovingAverages={setMovingAverages}
          advancedConfig={advancedConfig}
          setAdvancedConfig={setAdvancedConfig}
        />

        {loading && (
          <LoadingSpinner message={t('app.loadingMarketData')} />
        )}

        {error && (
          <ErrorMessage
            title={t('app.failedToLoadMarketData')}
            message={error.message}
            onRetry={() => window.location.reload()}
          />
        )}

        {marketData && (
          <ChartCanvas
            klines={displayKlines}
            symbol={symbol}
            width="100%"
            height="100%"
            showVolume={showVolume}
            showGrid={showGrid}
            showCurrentPriceLine={showCurrentPriceLine}
            showCrosshair={showCrosshair}
            showMeasurementRuler={showMeasurementRuler}
            showMeasurementArea={showMeasurementArea}
            showStochastic={showStochastic}
            showRSI={showRSI}
            chartType={chartType}
            movingAverages={movingAverages}
            advancedConfig={debouncedAdvancedConfig}
            aiPatterns={[...(patterns as unknown as AIPattern[]), ...detectedPatterns]}
            onDeleteAIPatterns={deleteAllPatterns}
            onDeleteAIPattern={handleDeletePattern}
            onToggleAIPatternsVisibility={togglePatternsVisibility}
            aiPatternsVisible={patternsVisible}
            onDeletePattern={handleDeletePattern}
            onViewportChange={setViewport}
            timeframe={timeframe}
          />
        )}
      </MainLayout>

      <NewsDialog
        open={isNewsOpen}
        onClose={toggleNews}
        symbols={[extractSymbolCode(symbol)]}
      />

      <BacktestDialog
        isOpen={isBacktestOpen}
        onClose={toggleBacktest}
      />

      <UpdateNotification />

      <OnboardingDialog
        isOpen={showOnboarding}
        onClose={() => setShowOnboarding(false)}
      />
    </>
  );
}

interface KeyboardShortcutsWrapperProps {
  showVolume: boolean;
  setShowVolume: (value: boolean | ((prev: boolean) => boolean)) => void;
  showGrid: boolean;
  setShowGrid: (value: boolean | ((prev: boolean) => boolean)) => void;
  chartType: 'kline' | 'line';
  setChartType: (value: 'kline' | 'line' | ((prev: 'kline' | 'line') => 'kline' | 'line')) => void;
  movingAverages: MovingAverageConfig[];
  setMovingAverages: (value: MovingAverageConfig[] | ((prev: MovingAverageConfig[]) => MovingAverageConfig[])) => void;
  advancedConfig: AdvancedControlsConfig;
  setAdvancedConfig: (value: AdvancedControlsConfig | ((prev: AdvancedControlsConfig) => AdvancedControlsConfig)) => void;
}

function AppContentWithKeyboardShortcuts({
  setShowVolume,
  setShowGrid,
  setChartType,
  setMovingAverages,
  setAdvancedConfig,
}: KeyboardShortcutsWrapperProps) {
  const globalActions = useGlobalActions();

  useGlobalKeyboardShortcuts({
    onToggleVolume: () => setShowVolume(prev => !prev),
    onToggleGrid: () => setShowGrid(prev => !prev),
    onToggleChartType: () => setChartType(prev => prev === 'kline' ? 'line' : 'kline'),
    onToggleMA: (index) => {
      setMovingAverages(prev => {
        if (index < 0 || index >= prev.length) return prev;
        const newMAs = [...prev];
        const current = newMAs[index];
        if (current) {
          newMAs[index] = { ...current, visible: !current.visible };
        }
        return newMAs;
      });
    },
    onZoomIn: () => {
      setAdvancedConfig(prev => ({
        ...prev,
        klineSpacing: Math.min(prev.klineSpacing + 1, 30),
      }));
    },
    onZoomOut: () => {
      setAdvancedConfig(prev => ({
        ...prev,
        klineSpacing: Math.max(prev.klineSpacing - 1, 2),
      }));
    },
    onResetZoom: () => {
      setAdvancedConfig(prev => ({
        ...prev,
        klineSpacing: CHART_CONFIG.KLINE_SPACING,
      }));
    },
    onPanLeft: () => { },
    onPanRight: () => { },
    onOpenSettings: globalActions.openSettings,
    onFocusChatInput: globalActions.focusChatInput,
    onShowShortcuts: globalActions.showKeyboardShortcuts,
    onOpenSymbolSelector: () => { },
  });

  return null;
}

export default App;
