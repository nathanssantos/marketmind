import { Box, ChakraProvider, Text as ChakraText, IconButton, Toaster } from '@chakra-ui/react';
import type { AIPattern, Kline, MarketType, Viewport } from '@marketmind/types';
import { CHART_CONFIG } from '@shared/constants/chartConfig';
import { getKlineClose, getKlineHigh, getKlineLow, getKlineVolume } from '@shared/utils';
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { LuX } from 'react-icons/lu';
import { AutoAuth } from './components/Auth/AutoAuth';
import { ErrorBoundary } from './components/ErrorBoundary';
import type { AdvancedControlsConfig } from './components/Chart/AdvancedControls';
import { ChartCanvas } from './components/Chart/ChartCanvas';
import { PinnedControlsProvider } from './components/Chart/PinnedControlsContext';
import type { Timeframe } from './components/Chart/TimeframeSelector';
import type { MovingAverageConfig } from './components/Chart/useMovingAverageRenderer';
import { MainLayout } from './components/Layout/MainLayout';
import { TrpcProvider } from './components/TrpcProvider';

const NewsDialog = lazy(() => import('./components/News/NewsDialog').then(m => ({ default: m.NewsDialog })));
const BacktestDialog = lazy(() => import('./components/Trading/BacktestDialog').then(m => ({ default: m.BacktestDialog })));
import { ErrorMessage } from './components/ui/ErrorMessage';
import { LoadingSpinner } from './components/ui/LoadingSpinner';
import { UpdateNotification } from './components/Update/UpdateNotification';
import { ChartProvider, useChartContext } from './context/ChartContext';
import { useGlobalActions } from './context/GlobalActionsContext';
import { PatternHoverProvider } from './context/PatternHoverContext';
import { RealtimeTradingSyncProvider } from './context/RealtimeTradingSyncContext';
import { useBackendWallet } from './hooks/useBackendWallet';
import { useAppSettings } from './hooks/useAppSettings';
import { useBackendKlines, useKlineStream } from './hooks/useBackendKlines';
import { useCalendar } from './hooks/useCalendar';
import { useChartData } from './hooks/useChartData';
import { useDebounce } from './hooks/useDebounce';
import { useExecutionNotifications } from './hooks/useExecutionNotifications';
import { useGlobalKeyboardShortcuts } from './hooks/useGlobalKeyboardShortcuts';
import { useLocalStorage } from './hooks/useLocalStorage';
import { useNews } from './hooks/useNews';
import { useOrderNotifications } from './hooks/useOrderNotifications';
import { usePatterns } from './hooks/usePatterns';
import { useAIStore } from './store/aiStore';
import { system } from './theme';
import { toaster } from './utils/toaster';

function RealtimeSyncWrapper({ children }: { children: React.ReactNode }) {
  const { wallets } = useBackendWallet();
  const activeWalletId = wallets[0]?.id;

  return (
    <RealtimeTradingSyncProvider walletId={activeWalletId}>
      {children}
    </RealtimeTradingSyncProvider>
  );
}

const DEFAULT_MOVING_AVERAGES: MovingAverageConfig[] = [
  {
    period: 9,
    type: 'EMA',
    color: '#ff9800',
    lineWidth: 2,
    visible: true,
  },
  {
    period: 21,
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
    period: 70,
    type: 'EMA',
    color: '#00bcd4',
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
    <ErrorBoundary>
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
                <RealtimeSyncWrapper>
                  <AppContent />
                </RealtimeSyncWrapper>
              </PinnedControlsProvider>
            </ChartProvider>
          </PatternHoverProvider>
          </AutoAuth>
        </ChakraProvider>
      </TrpcProvider>
    </ErrorBoundary>
  );
}

function AppContent(): ReactElement {
  const { t } = useTranslation();
  const [symbol, setSymbol] = useLocalStorage('marketmind:symbol', 'BTCUSDT');
  const [marketType, setMarketType] = useLocalStorage<MarketType>('marketmind:marketType', 'SPOT');
  const [viewport, setViewport] = useState<Viewport | undefined>(undefined);

  useOrderNotifications();
  useExecutionNotifications();

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


  const [showVolume, setShowVolume] = useLocalStorage('marketmind:showVolume', true);
  const [showGrid, setShowGrid] = useLocalStorage('marketmind:showGrid', true);
  const [showCurrentPriceLine, setShowCurrentPriceLine] = useLocalStorage('marketmind:showCurrentPriceLine', true);
  const [showCrosshair, setShowCrosshair] = useLocalStorage('marketmind:showCrosshair', true);
  const [showMeasurementRuler, setShowMeasurementRuler] = useLocalStorage('marketmind:showMeasurementRuler', false);
  const [showMeasurementArea, setShowMeasurementArea] = useLocalStorage('marketmind:showMeasurementArea', false);
  const [showStochastic, setShowStochastic] = useLocalStorage('marketmind:showStochastic', false);
  const [showRSI, setShowRSI] = useLocalStorage('marketmind:showRSI', false);
  const [showBollingerBands, setShowBollingerBands] = useLocalStorage('marketmind:showBollingerBands', false);
  const [showATR, setShowATR] = useLocalStorage('marketmind:showATR', false);
  const [showVWAP, setShowVWAP] = useLocalStorage('marketmind:showVWAP', false);
  const [chartType, setChartType] = useLocalStorage<'kline' | 'line'>('marketmind:chartType', 'kline');
  const [timeframe, setTimeframe] = useLocalStorage<Timeframe>('marketmind:timeframe', '1d');
  const [isChatOpen, setIsChatOpen] = useLocalStorage('chat-sidebar-open', false);
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

  const syncAIStore = useAIStore((state) => state.syncWithElectron);

  useEffect(() => {
    void syncAIStore();
  }, []);

  useEffect(() => {
    const migrateMovingAverages = () => {
      const hasOldConfig = movingAverages.some(ma => ma.period === 20) ||
        movingAverages.length !== 6 ||
        !movingAverages.some(ma => ma.period === 70) ||
        !movingAverages.some(ma => ma.period === 200);

      if (hasOldConfig) {
        setMovingAverages(DEFAULT_MOVING_AVERAGES);
      }
    };

    migrateMovingAverages();
  }, []);

  const restoreActiveConversation = useAIStore((state) => state.restoreActiveConversation);
  const setActiveConversationBySymbol = useAIStore((state) => state.setActiveConversationBySymbol);
  const getActiveConversation = useAIStore((state) => state.getActiveConversation);

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
    marketType,
  });



  const marketData = useMemo(() => {
    if (!backendKlinesQuery.data || backendKlinesQuery.data.length === 0) {
      return null;
    }

    const parseTimestamp = (time: unknown): number => {
      if (typeof time === 'string') return new Date(time).getTime();
      if (time instanceof Date) return time.getTime();
      return Number(time);
    };

    const klines: Kline[] = backendKlinesQuery.data.map((k) => ({
      openTime: parseTimestamp(k.openTime),
      closeTime: parseTimestamp(k.closeTime),
      open: k.open,
      high: k.high,
      low: k.low,
      close: k.close,
      volume: k.volume,
      quoteVolume: k.quoteVolume || '0',
      trades: k.trades || 0,
      takerBuyBaseVolume: k.takerBuyBaseVolume || '0',
      takerBuyQuoteVolume: k.takerBuyQuoteVolume || '0',
    }));

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
  const pendingUpdateRef = useRef<{ kline: Kline; isFinal: boolean } | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const lastRefetchRef = useRef<number>(0);
  const lastUpdateRef = useRef<number>(0);
  const MIN_UPDATE_INTERVAL = 100;

  const getIntervalMs = useCallback((tf: string): number => {
    const intervals: Record<string, number> = {
      '1s': 1000,
      '1m': 60 * 1000,
      '3m': 3 * 60 * 1000,
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '30m': 30 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '2h': 2 * 60 * 60 * 1000,
      '4h': 4 * 60 * 60 * 1000,
      '6h': 6 * 60 * 60 * 1000,
      '8h': 8 * 60 * 60 * 1000,
      '12h': 12 * 60 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000,
      '3d': 3 * 24 * 60 * 60 * 1000,
      '1w': 7 * 24 * 60 * 60 * 1000,
      '1M': 30 * 24 * 60 * 60 * 1000,
    };
    return intervals[tf] || 60 * 1000;
  }, []);

  useEffect(() => {
    setLiveKlines([]);
    previousPriceRef.current = null;
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    pendingUpdateRef.current = null;
    lastRefetchRef.current = 0;
  }, [symbol, timeframe, marketType]);

  const handleRealtimeUpdate = useCallback((kline: Kline, isFinal: boolean) => {
    const now = Date.now();
    const timeSinceLastUpdate = now - lastUpdateRef.current;

    if (!isFinal && timeSinceLastUpdate < MIN_UPDATE_INTERVAL) {
      pendingUpdateRef.current = { kline, isFinal };
      return;
    }

    pendingUpdateRef.current = { kline, isFinal };

    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
    }

    rafIdRef.current = requestAnimationFrame(() => {
      const update = pendingUpdateRef.current;
      if (!update) return;

      const { kline: latestKline, isFinal: finalFlag } = update;
      const currentPrice = getKlineClose(latestKline);

      previousPriceRef.current = currentPrice;
      lastUpdateRef.current = Date.now();

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
  }, []);

  const handleKlineStreamUpdate = useCallback((backendKline: any) => {
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
    !!marketData,
    marketType
  );

  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!marketData?.klines || liveKlines.length === 0) return;

    const lastBaseKline = marketData.klines[marketData.klines.length - 1];
    const firstLiveKline = liveKlines[0];

    if (!lastBaseKline || !firstLiveKline) return;

    const intervalMs = getIntervalMs(timeframe);
    const gap = firstLiveKline.openTime - lastBaseKline.openTime;
    const gapCandles = Math.floor(gap / intervalMs);

    if (gapCandles > 1) {
      const now = Date.now();
      const minRefetchInterval = 30000;

      if (now - lastRefetchRef.current > minRefetchInterval) {
        console.log(`[App] Detected gap of ${gapCandles} candles, refetching klines...`);
        lastRefetchRef.current = now;
        setLiveKlines([]);
        backendKlinesQuery.refetch();
      }
    }
  }, [marketData?.klines, liveKlines, timeframe, getIntervalMs, backendKlinesQuery]);

  const displayKlines = useMemo(() => {
    if (!marketData?.klines) return [];
    if (liveKlines.length === 0) return marketData.klines;

    const baseKlines = marketData.klines;
    const lastBaseKline = baseKlines[baseKlines.length - 1];
    const firstLiveKline = liveKlines[0];

    if (!lastBaseKline || !firstLiveKline) {
      return [...baseKlines, ...liveKlines];
    }

    if (firstLiveKline.openTime === lastBaseKline.openTime) {
      return [...baseKlines.slice(0, -1), ...liveKlines];
    }

    if (firstLiveKline.openTime > lastBaseKline.openTime) {
      const filteredLiveKlines = liveKlines.filter(k => k.openTime > lastBaseKline.openTime);
      return [...baseKlines, ...filteredLiveKlines];
    }

    const overlapIndex = baseKlines.findIndex(k => k.openTime >= firstLiveKline.openTime);
    if (overlapIndex > 0) {
      return [...baseKlines.slice(0, overlapIndex), ...liveKlines];
    }

    return liveKlines;
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

  const processAIResponseRef = useRef(processAIResponse);

  useEffect(() => {
    processAIResponseRef.current = processAIResponse;
  }, [processAIResponse]);

  const handleDeletePattern = useCallback((patternId: number): void => {
    void deletePattern(patternId);
  }, []);

  const handleSymbolChange = useCallback((newSymbol: string, newMarketType?: MarketType): void => {
    setSymbol(newSymbol);
    if (newMarketType) setMarketType(newMarketType);
  }, [setSymbol, setMarketType]);

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
    marketType,
    news: newsArticles,
    events: relevantEvents,
  });

  const isAutoTradingActive = useAIStore((state) => state.isAutoTradingActive);


  const startTrading = async () => { };
  const stopTrading = async () => { };

  useEffect(() => {
    if (isAutoTradingActive) {
      void startTrading();
    } else {
      void stopTrading();
    }
  }, [isAutoTradingActive]);

  return (
    <>
      <MainLayout
        onOpenSymbolSelector={() => { }}
        advancedConfig={advancedConfig}
        onAdvancedConfigChange={setAdvancedConfig}
        isChatOpen={isChatOpen}
        onToggleChat={toggleChat}
        isTradingOpen={isTradingOpen}
        onToggleTrading={toggleTrading}
        symbol={symbol}
        marketType={marketType}
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
        showBollingerBands={showBollingerBands}
        showATR={showATR}
        showVWAP={showVWAP}
        movingAverages={movingAverages}
        isNewsOpen={isNewsOpen}
        isBacktestOpen={isBacktestOpen}
        onSymbolChange={handleSymbolChange}
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
        onShowBollingerBandsChange={setShowBollingerBands}
        onShowATRChange={setShowATR}
        onShowVWAPChange={setShowVWAP}
        onMovingAveragesChange={setMovingAverages}
        onToggleNews={toggleNews}
        onToggleBacktest={toggleBacktest}
        onDetectPatterns={() => { }}
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
            marketType={marketType}
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
            showBollingerBands={showBollingerBands}
            showATR={showATR}
            showVWAP={showVWAP}
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

      <Suspense fallback={null}>
        {isNewsOpen && (
          <NewsDialog
            open={isNewsOpen}
            onClose={toggleNews}
            symbols={[extractSymbolCode(symbol)]}
          />
        )}
      </Suspense>

      <Suspense fallback={null}>
        {isBacktestOpen && (
          <BacktestDialog
            isOpen={isBacktestOpen}
            onClose={toggleBacktest}
          />
        )}
      </Suspense>

      <UpdateNotification />
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
