import { Box, ChakraProvider, Text as ChakraText, IconButton, Toaster } from '@chakra-ui/react';
import type { AssetClass, Kline, MarketType } from '@marketmind/types';
import { CHART_CONFIG } from '@shared/constants/chartConfig';
import { getKlineClose, getKlineHigh, getKlineLow, getKlineVolume } from '@shared/utils';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { LuX } from 'react-icons/lu';
import { useNavigate, useParams } from 'react-router-dom';
import type { AdvancedControlsConfig } from '../components/Chart/AdvancedControls';
import { ChartCanvas } from '../components/Chart/ChartCanvas';
import { PinnedControlsProvider } from '../components/Chart/PinnedControlsContext';
import type { Timeframe } from '../components/Chart/TimeframeSelector';
import type { MovingAverageConfig } from '../components/Chart/useMovingAverageRenderer';
import { ChartToolsToolbar } from '../components/Layout/ChartToolsToolbar';
import { QuickTradeToolbar } from '../components/Layout/QuickTradeToolbar';
import { Toolbar } from '../components/Layout/Toolbar';
import { MarketStatusBar } from '../components/MarketStatusBar';
import { ErrorMessage } from '../components/ui/ErrorMessage';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { DEFAULT_MOVING_AVERAGES as SHARED_DEFAULT_MAS, DEFAULT_TIMEFRAME } from '../constants/defaults';
import { ChartProvider } from '../context/ChartContext';
import { useKlineStream } from '../hooks/useBackendKlines';
import { useKlinePagination } from '../hooks/useKlinePagination';
import { useDebounce } from '../hooks/useDebounce';
import { useChartPref } from '../store/preferencesStore';
import { useCurrencyAutoRefresh } from '../store/currencyStore';
import { useSetupStore } from '../store/setupStore';
import { system } from '../theme';
import { toaster } from '../utils/toaster';

const DEFAULT_MOVING_AVERAGES: MovingAverageConfig[] = SHARED_DEFAULT_MAS;

interface ChartWindowContentProps {
  initialSymbol?: string;
}

function ChartWindowContent({ initialSymbol }: ChartWindowContentProps): ReactElement {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { symbol: routeSymbol, timeframe: routeTimeframe } = useParams<{ symbol?: string; timeframe?: string }>();
  const [symbol, setSymbol] = useState(routeSymbol || initialSymbol || 'BTCUSDT');
  const [marketType, setMarketType] = useState<MarketType>('FUTURES');
  const [assetClass, setAssetClass] = useState<AssetClass>('CRYPTO');

  useCurrencyAutoRefresh();

  const [chartType] = useChartPref<'kline' | 'line'>('chartType', 'kline');
  const [movingAverages, setMovingAverages] = useChartPref<MovingAverageConfig[]>(
    'movingAverages',
    DEFAULT_MOVING_AVERAGES
  );

  const [advancedConfig] = useChartPref<AdvancedControlsConfig>('advancedConfig', {
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

  const [timeframe, setTimeframe] = useState<Timeframe>((routeTimeframe as Timeframe) || DEFAULT_TIMEFRAME);

  const {
    allKlines: paginatedKlines,
    isLoadingMore,
    hasMore,
    loadOlderKlines,
    isInitialLoading,
    error: paginationError,
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

  const [liveKlines, setLiveKlines] = useState<Kline[]>([]);
  const previousPriceRef = useRef<number | null>(null);
  const pendingUpdateRef = useRef<{ kline: Kline; isFinal: boolean } | null>(null);
  const rafIdRef = useRef<number | null>(null);

  useEffect(() => {
    setLiveKlines([]);
    previousPriceRef.current = null;
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    pendingUpdateRef.current = null;
  }, [symbol, timeframe, marketType]);

  useEffect(() => {
    if (!marketData?.klines?.length) return;
    const lastBaseKline = marketData.klines[marketData.klines.length - 1];
    if (!lastBaseKline) return;

    setLiveKlines(prev => {
      if (prev.length === 0) return prev;
      const filtered = prev.filter(k => k.openTime >= lastBaseKline.openTime);
      if (filtered.length === prev.length) return prev;
      return filtered;
    });
  }, [marketData?.klines]);

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

  const displayKlines = useMemo(() => {
    if (!marketData?.klines) return [];
    if (liveKlines.length === 0) return marketData.klines;

    const baseKlines = marketData.klines;
    const lastBaseKline = baseKlines[baseKlines.length - 1];

    if (!lastBaseKline) return marketData.klines;

    const lastBaseOpenTime = lastBaseKline.openTime;
    const filteredLiveKlines = liveKlines.filter(k => k.openTime >= lastBaseOpenTime);

    if (filteredLiveKlines.length === 0) return marketData.klines;

    const firstFilteredKline = filteredLiveKlines[0];
    if (!firstFilteredKline) return marketData.klines;

    if (firstFilteredKline.openTime === lastBaseOpenTime) {
      return [...baseKlines.slice(0, -1), ...filteredLiveKlines];
    }

    return [...baseKlines, ...filteredLiveKlines];
  }, [marketData?.klines, liveKlines]);

  const debouncedAdvancedConfig = useDebounce(advancedConfig, 300);

  useEffect(() => {
    const newPath = `/chart/${encodeURIComponent(symbol)}/${timeframe}`;
    const currentPath = window.location.hash.slice(1);
    if (currentPath !== newPath) {
      navigate(newPath, { replace: true });
    }
  }, [symbol, timeframe, navigate]);

  const clearDetectedSetups = useSetupStore((state) => state.clearDetectedSetups);

  const handleSymbolChange = useCallback((newSymbol: string, newMarketType?: MarketType, newAssetClass?: AssetClass): void => {
    clearDetectedSetups();
    setSymbol(newSymbol);
    if (newMarketType) setMarketType(newMarketType);
    if (newAssetClass) setAssetClass(newAssetClass);
  }, [setSymbol, setMarketType, setAssetClass, clearDetectedSetups]);

  return (
    <Box
      display="flex"
      flexDirection="column"
      height="100vh"
      width="100vw"
      overflow="hidden"
      bg="var(--chakra-colors-chakra-body-bg)"
    >
      <Box flexShrink={0} height="41px">
        <Toolbar
          symbol={symbol}
          marketType={marketType}
          onMarketTypeChange={setMarketType}
          onSymbolChange={handleSymbolChange}
          timeframe={timeframe}
          onTimeframeChange={setTimeframe}
          movingAverages={movingAverages}
          showNewWindowButton={false}
          showSidebarButtons={false}
          isTradingOpen={false}
          onToggleTrading={() => { }}
        />
      </Box>

      {assetClass === 'STOCKS' && <MarketStatusBar />}

      <Box flex="1" position="relative" overflow="hidden">
        {symbol && <QuickTradeToolbar symbol={symbol} marketType={marketType} />}
        <ChartToolsToolbar
          movingAverages={movingAverages}
          onMovingAveragesChange={setMovingAverages}
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
            chartType={chartType}
            movingAverages={movingAverages}
            advancedConfig={debouncedAdvancedConfig}
            timeframe={timeframe}
            onNearLeftEdge={hasMore ? loadOlderKlines : undefined}
            isLoadingMore={isLoadingMore}
          />
        )}
      </Box>
    </Box>
  );
}

interface ChartWindowProps {
  initialSymbol?: string;
}

export function ChartWindow({ initialSymbol }: ChartWindowProps): ReactElement {
  const { t } = useTranslation();

  return (
    <ChakraProvider value={system}>
      <Toaster toaster={toaster}>
        {toast => {
          if (!toast.title && !toast.description) return null;

          return (
            <Box
              bg={
                toast.type === 'success'
                  ? 'green.500'
                  : toast.type === 'error'
                    ? 'red.500'
                    : toast.type === 'info'
                      ? 'blue.500'
                      : 'orange.500'
              }
              color="white"
              p={4}
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
          <ChartWindowContent initialSymbol={initialSymbol} />
        </PinnedControlsProvider>
      </ChartProvider>
    </ChakraProvider>
  );
}
