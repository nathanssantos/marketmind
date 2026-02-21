import { Box, ChakraProvider, Flex, Text as ChakraText, IconButton, Toaster } from '@chakra-ui/react';
import type { Kline, MarketType, TimeInterval } from '@marketmind/types';
import { CHART_CONFIG } from '@shared/constants/chartConfig';
import { getKlineClose, getKlineHigh, getKlineLow, getKlineVolume } from '@shared/utils';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { LuX } from 'react-icons/lu';
import { AutoAuth } from './components/Auth/AutoAuth';
import { PreferencesHydrator } from './components/PreferencesHydrator';
import type { AdvancedControlsConfig } from './components/Chart/AdvancedControls';
import { ChartCanvas } from './components/Chart/ChartCanvas';
import { PinnedControlsProvider } from './components/Chart/PinnedControlsContext';
import type { Timeframe } from './components/Chart/TimeframeSelector';
import type { MovingAverageConfig } from './components/Chart/useMovingAverageRenderer';
import { ErrorBoundary } from './components/ErrorBoundary';
import { MainLayout } from './components/Layout/MainLayout';
import { CryptoIcon } from './components/ui/CryptoIcon';
import { ErrorMessage } from './components/ui/ErrorMessage';
import { LoadingSpinner } from './components/ui/LoadingSpinner';
import { UpdateNotification } from './components/Update/UpdateNotification';
import { DEFAULT_MOVING_AVERAGES, DEFAULT_TIMEFRAME, INTERVAL_MS_MAP, MIN_UPDATE_INTERVAL_MS } from './constants/defaults';
import { ChartProvider } from './context/ChartContext';
import { RealtimeTradingSyncProvider } from './context/RealtimeTradingSyncContext';
import { useKlineStream } from './hooks/useBackendKlines';
import { useKlinePagination } from './hooks/useKlinePagination';
import { useBackendWallet } from './hooks/useBackendWallet';
import { useChartData } from './hooks/useChartData';
import { useDebounce } from './hooks/useDebounce';
import { useOrderNotifications } from './hooks/useOrderNotifications';
import { useVisibilityChange } from './hooks/useVisibilityChange';
import { useIndicatorStore } from './store/indicatorStore';
import { useChartPref, useUIPref } from './store/preferencesStore';
import { useCurrencyAutoRefresh } from './store/currencyStore';
import { useSetupStore } from './store/setupStore';
import { system } from './theme';
import { getToasterNavigateToSymbol, setToasterNavigateToSymbol, toaster } from './utils/toaster';

function RealtimeSyncWrapper({ children }: { children: React.ReactNode }) {
  const { wallets } = useBackendWallet();
  const activeWalletId = wallets[0]?.id;

  return (
    <RealtimeTradingSyncProvider walletId={activeWalletId}>
      {children}
    </RealtimeTradingSyncProvider>
  );
}

function App(): ReactElement {
  return (
    <ErrorBoundary>
      <ChakraProvider value={system}>
        <AutoAuth>
          <PreferencesHydrator>
            <Toaster toaster={toaster}>
              {(toast) => {
                const { t } = useTranslation();
                const symbol = (toast.meta as Record<string, unknown> | undefined)?.['symbol'] as string | undefined;
                const marketType = (toast.meta as Record<string, unknown> | undefined)?.['marketType'] as MarketType | undefined;
                const navigate = getToasterNavigateToSymbol();
                const canNavigate = !!symbol && !!navigate;

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
                    {symbol ? (
                      <Flex
                        align="center"
                        gap={2}
                        mb={1}
                        pr={6}
                        cursor={canNavigate ? 'pointer' : 'default'}
                        onClick={canNavigate ? () => navigate(symbol, marketType) : undefined}
                        _hover={canNavigate ? { opacity: 0.8 } : undefined}
                      >
                        <CryptoIcon symbol={symbol} size={18} />
                        <ChakraText fontWeight="bold">{toast.title}</ChakraText>
                      </Flex>
                    ) : (
                      <ChakraText fontWeight="bold" mb={1} pr={6}>
                        {toast.title}
                      </ChakraText>
                    )}
                    {toast.description && (
                      <ChakraText fontSize="sm" pl={symbol ? 7 : 0}>{toast.description}</ChakraText>
                    )}
                  </Box>
                );
              }}
            </Toaster>
            <ChartProvider>
              <PinnedControlsProvider>
                <RealtimeSyncWrapper>
                  <AppContent />
                </RealtimeSyncWrapper>
              </PinnedControlsProvider>
            </ChartProvider>
          </PreferencesHydrator>
        </AutoAuth>
      </ChakraProvider>
    </ErrorBoundary>
  );
}

function AppContent(): ReactElement {
  const { t } = useTranslation();
  const [symbol, setSymbol] = useChartPref('symbol', 'BTCUSDT');
  const [marketType, setMarketType] = useChartPref<MarketType>('marketType', 'FUTURES');

  useCurrencyAutoRefresh();
  useOrderNotifications();

  const [chartType] = useChartPref<'kline' | 'line'>('chartType', 'kline');
  const [timeframe, setTimeframe] = useChartPref<Timeframe>('timeframe', DEFAULT_TIMEFRAME);
  const [isTradingOpen, setIsTradingOpen] = useUIPref('tradingSidebarOpen', true);
  const [movingAverages, setMovingAverages] = useChartPref<MovingAverageConfig[]>(
    'movingAverages',
    DEFAULT_MOVING_AVERAGES
  );

  const [advancedConfig, setAdvancedConfig] = useChartPref<AdvancedControlsConfig>('advancedConfig', {
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

  const showVolume = useIndicatorStore((s) => s.activeIndicators.includes('volume'));

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

  useEffect(() => {
    const updates: Partial<typeof advancedConfig> = {};
    if (advancedConfig.currentPriceLineStyle === 'dashed') updates.currentPriceLineStyle = 'solid';
    if (advancedConfig.currentPriceLineWidth !== 1) updates.currentPriceLineWidth = 1;
    if (Object.keys(updates).length > 0) setAdvancedConfig({ ...advancedConfig, ...updates });
  }, []);

  const toggleTrading = useCallback(() => {
    setIsTradingOpen((prev) => !prev);
  }, [setIsTradingOpen]);

  const {
    allKlines: paginatedKlines,
    isLoadingMore,
    hasMore,
    loadOlderKlines,
    isInitialLoading,
    error: paginationError,
    refetch: refetchKlines,
  } = useKlinePagination({
    symbol,
    interval: timeframe as any,
    marketType,
    enabled: !!symbol,
  });

  const marketData = useMemo(() => {
    if (paginatedKlines.length === 0) return null;
    return { symbol, interval: timeframe, klines: paginatedKlines };
  }, [paginatedKlines, symbol, timeframe]);

  const loading = isInitialLoading;
  const error = paginationError;

  const [liveKlines, setLiveKlines] = useState<Kline[]>([]);
  const previousPriceRef = useRef<number | null>(null);
  const pendingUpdateRef = useRef<{ kline: Kline; isFinal: boolean } | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const lastRefetchRef = useRef<number>(0);
  const lastUpdateRef = useRef<number>(0);
  const isRefetchingRef = useRef(false);

  const getIntervalMs = useCallback((tf: string): number => {
    return INTERVAL_MS_MAP[tf as TimeInterval] || 60_000;
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
    if (isRefetchingRef.current) return;

    const now = Date.now();
    const timeSinceLastUpdate = now - lastUpdateRef.current;

    if (!isFinal && timeSinceLastUpdate < MIN_UPDATE_INTERVAL_MS) {
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
        refetchKlines();
      }
    }
  }, [marketData?.klines, liveKlines, timeframe, getIntervalMs, refetchKlines]);

  const handleVisibilityRestore = useCallback(async (state: { hiddenDuration: number }) => {
    if (state.hiddenDuration < 5_000) return;
    isRefetchingRef.current = true;
    setLiveKlines([]);
    await refetchKlines();
    isRefetchingRef.current = false;
  }, [refetchKlines]);

  useVisibilityChange({
    onBecameVisible: handleVisibilityRestore,
    minHiddenDurationForRefresh: 5_000,
  });

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

  const clearDetectedSetups = useSetupStore((state) => state.clearDetectedSetups);

  const handleSymbolChange = useCallback((newSymbol: string, newMarketType?: MarketType): void => {
    clearDetectedSetups();
    setSymbol(newSymbol);
    if (newMarketType) setMarketType(newMarketType);
  }, [setSymbol, setMarketType, clearDetectedSetups]);

  useEffect(() => {
    setToasterNavigateToSymbol(handleSymbolChange);
    return () => setToasterNavigateToSymbol(null);
  }, [handleSymbolChange]);

  useChartData({
    klines: displayKlines,
    symbol,
    timeframe,
    chartType,
    showVolume,
    movingAverages,
    marketType,
  });

  return (
    <>
      <MainLayout
        onOpenSymbolSelector={() => { }}
        advancedConfig={advancedConfig}
        onAdvancedConfigChange={setAdvancedConfig}
        isTradingOpen={isTradingOpen}
        onToggleTrading={toggleTrading}
        symbol={symbol}
        marketType={marketType}
        onMarketTypeChange={setMarketType}
        timeframe={timeframe}
        movingAverages={movingAverages}
        onSymbolChange={handleSymbolChange}
        onTimeframeChange={setTimeframe}
        onMovingAveragesChange={setMovingAverages}
        onNavigateToSymbol={handleSymbolChange}
      >
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
            chartType={chartType}
            movingAverages={movingAverages}
            advancedConfig={debouncedAdvancedConfig}
            timeframe={timeframe}
            onNearLeftEdge={hasMore ? loadOlderKlines : undefined}
            isLoadingMore={isLoadingMore}
          />
        )}
      </MainLayout>

      <UpdateNotification />
    </>
  );
}

export default App;
