import { Box, ChakraProvider, Text as ChakraText, IconButton, Toaster } from '@chakra-ui/react';
import type { Kline, MarketType, TimeInterval } from '@marketmind/types';
import { CHART_CONFIG } from '@shared/constants/chartConfig';
import { getKlineClose, getKlineHigh, getKlineLow, getKlineVolume } from '@shared/utils';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { LuX } from 'react-icons/lu';
import { AutoAuth } from './components/Auth/AutoAuth';
import type { AdvancedControlsConfig } from './components/Chart/AdvancedControls';
import { ChartCanvas } from './components/Chart/ChartCanvas';
import { PinnedControlsProvider } from './components/Chart/PinnedControlsContext';
import type { Timeframe } from './components/Chart/TimeframeSelector';
import type { MovingAverageConfig } from './components/Chart/useMovingAverageRenderer';
import { ErrorBoundary } from './components/ErrorBoundary';
import { MainLayout } from './components/Layout/MainLayout';
import { ErrorMessage } from './components/ui/ErrorMessage';
import { LoadingSpinner } from './components/ui/LoadingSpinner';
import { UpdateNotification } from './components/Update/UpdateNotification';
import { DEFAULT_MOVING_AVERAGES, INTERVAL_MS_MAP, MIN_UPDATE_INTERVAL_MS, REQUIRED_KLINES } from './constants/defaults';
import { ChartProvider } from './context/ChartContext';
import { RealtimeTradingSyncProvider } from './context/RealtimeTradingSyncContext';
import { useBackendKlines, useKlineStream } from './hooks/useBackendKlines';
import { useBackendWallet } from './hooks/useBackendWallet';
import { useChartData } from './hooks/useChartData';
import { useDebounce } from './hooks/useDebounce';
import { useLocalStorage } from './hooks/useLocalStorage';
import { useOrderNotifications } from './hooks/useOrderNotifications';
import { useVisibilityChange } from './hooks/useVisibilityChange';
import { useCurrencyAutoRefresh } from './store/currencyStore';
import { useSetupStore } from './store/setupStore';
import { useUIStore } from './store/uiStore';
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

function App(): ReactElement {
  return (
    <ErrorBoundary>
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
          <ChartProvider>
            <PinnedControlsProvider>
              <RealtimeSyncWrapper>
                <AppContent />
              </RealtimeSyncWrapper>
            </PinnedControlsProvider>
          </ChartProvider>
        </AutoAuth>
      </ChakraProvider>
    </ErrorBoundary>
  );
}

function AppContent(): ReactElement {
  const { t } = useTranslation();
  const [symbol, setSymbol] = useLocalStorage('marketmind:symbol', 'BTCUSDT');
  const [marketType, setMarketType] = useLocalStorage<MarketType>('marketmind:marketType', 'FUTURES');

  useCurrencyAutoRefresh();
  useOrderNotifications();

  const [showVolume, setShowVolume] = useLocalStorage('marketmind:showVolume', true);
  const [showGrid, setShowGrid] = useLocalStorage('marketmind:showGrid', true);
  const [showCurrentPriceLine, setShowCurrentPriceLine] = useLocalStorage('marketmind:showCurrentPriceLine', true);
  const [showCrosshair, setShowCrosshair] = useLocalStorage('marketmind:showCrosshair', true);
  const [showProfitLossAreas, setShowProfitLossAreas] = useLocalStorage('marketmind:showProfitLossAreas', true);
  const [showFibonacciProjection, setShowFibonacciProjection] = useLocalStorage(
    'marketmind:showFibonacciProjection',
    false
  );
  const [showMeasurementRuler, setShowMeasurementRuler] = useLocalStorage('marketmind:showMeasurementRuler', false);
  const [showMeasurementArea, setShowMeasurementArea] = useLocalStorage('marketmind:showMeasurementArea', false);
  const [showTooltip, setShowTooltip] = useLocalStorage('marketmind:showTooltip', false);
  const [showStochastic, setShowStochastic] = useLocalStorage('marketmind:showStochastic', true);
  const [showRSI, setShowRSI] = useLocalStorage('marketmind:showRSI', false);
  const [showBollingerBands, setShowBollingerBands] = useLocalStorage('marketmind:showBollingerBands', false);
  const [showATR, setShowATR] = useLocalStorage('marketmind:showATR', false);
  const [showVWAP, setShowVWAP] = useLocalStorage('marketmind:showVWAP', false);
  const { showEventRow, setShowEventRow } = useUIStore();
  const [chartType] = useLocalStorage<'kline' | 'line'>('marketmind:chartType', 'kline');
  const [timeframe, setTimeframe] = useLocalStorage<Timeframe>('marketmind:timeframe', '12h');
  const [isTradingOpen, setIsTradingOpen] = useLocalStorage('trading-sidebar-open', true);
  const [movingAverages, setMovingAverages] = useLocalStorage<MovingAverageConfig[]>(
    'marketmind:movingAverages',
    DEFAULT_MOVING_AVERAGES
  );

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

  const { useKlineList } = useBackendKlines();
  const backendKlinesQuery = useKlineList({
    symbol,
    interval: timeframe as any,
    limit: REQUIRED_KLINES,
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
        backendKlinesQuery.refetch();
      }
    }
  }, [marketData?.klines, liveKlines, timeframe, getIntervalMs, backendKlinesQuery]);

  const handleVisibilityRestore = useCallback((state: { hiddenDuration: number }) => {
    if (state.hiddenDuration > 30_000) {
      setLiveKlines([]);
      backendKlinesQuery.refetch();
    }
  }, [backendKlinesQuery]);

  useVisibilityChange({
    onBecameVisible: handleVisibilityRestore,
    minHiddenDurationForRefresh: 30_000,
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
        showVolume={showVolume}
        showGrid={showGrid}
        showCurrentPriceLine={showCurrentPriceLine}
        showCrosshair={showCrosshair}
        showProfitLossAreas={showProfitLossAreas}
        showFibonacciProjection={showFibonacciProjection}
        showMeasurementRuler={showMeasurementRuler}
        showMeasurementArea={showMeasurementArea}
        showTooltip={showTooltip}
        showStochastic={showStochastic}
        showRSI={showRSI}
        showBollingerBands={showBollingerBands}
        showATR={showATR}
        showVWAP={showVWAP}
        showEventRow={showEventRow}
        movingAverages={movingAverages}
        onSymbolChange={handleSymbolChange}
        onTimeframeChange={setTimeframe}
        onShowVolumeChange={setShowVolume}
        onShowGridChange={setShowGrid}
        onShowCurrentPriceLineChange={setShowCurrentPriceLine}
        onShowCrosshairChange={setShowCrosshair}
        onShowProfitLossAreasChange={setShowProfitLossAreas}
        onShowFibonacciProjectionChange={setShowFibonacciProjection}
        onShowMeasurementRulerChange={setShowMeasurementRuler}
        onShowMeasurementAreaChange={setShowMeasurementArea}
        onShowTooltipChange={setShowTooltip}
        onShowStochasticChange={setShowStochastic}
        onShowRSIChange={setShowRSI}
        onShowBollingerBandsChange={setShowBollingerBands}
        onShowATRChange={setShowATR}
        onShowVWAPChange={setShowVWAP}
        onShowEventRowChange={setShowEventRow}
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
            showVolume={showVolume}
            showGrid={showGrid}
            showCurrentPriceLine={showCurrentPriceLine}
            showCrosshair={showCrosshair}
            showProfitLossAreas={showProfitLossAreas}
            showFibonacciProjection={showFibonacciProjection}
            showMeasurementRuler={showMeasurementRuler}
            showMeasurementArea={showMeasurementArea}
            showTooltip={showTooltip}
            showStochastic={showStochastic}
            showRSI={showRSI}
            showBollingerBands={showBollingerBands}
            showATR={showATR}
            showVWAP={showVWAP}
            showEventRow={showEventRow}
            chartType={chartType}
            movingAverages={movingAverages}
            advancedConfig={debouncedAdvancedConfig}
            timeframe={timeframe}
          />
        )}
      </MainLayout>

      <UpdateNotification />
    </>
  );
}

export default App;
