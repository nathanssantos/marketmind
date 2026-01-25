import { Box, ChakraProvider, Text as ChakraText, IconButton, Toaster } from '@chakra-ui/react';
import type { Kline, MarketType } from '@marketmind/types';
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
import { Toolbar } from '../components/Layout/Toolbar';
import { ErrorMessage } from '../components/ui/ErrorMessage';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { DEFAULT_MOVING_AVERAGES as SHARED_DEFAULT_MAS, REQUIRED_KLINES } from '../constants/defaults';
import { ChartProvider } from '../context/ChartContext';
import { useBackendKlines, useKlineStream } from '../hooks/useBackendKlines';
import { useDebounce } from '../hooks/useDebounce';
import { useLocalStorage } from '../hooks/useLocalStorage';
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
  const [symbol, setSymbol] = useLocalStorage('marketmind:chartwindow:symbol', routeSymbol || initialSymbol || 'BTCUSDT');
  const [marketType, setMarketType] = useLocalStorage<MarketType>('marketmind:chartwindow:marketType', 'FUTURES');

  useCurrencyAutoRefresh();

  const [showVolume, setShowVolume] = useLocalStorage('marketmind:showVolume', true);
  const [showGrid, setShowGrid] = useLocalStorage('marketmind:showGrid', true);
  const [showCurrentPriceLine, setShowCurrentPriceLine] = useLocalStorage('marketmind:showCurrentPriceLine', true);
  const [showCrosshair, setShowCrosshair] = useLocalStorage('marketmind:showCrosshair', true);
  const [showProfitLossAreas, setShowProfitLossAreas] = useLocalStorage('marketmind:showProfitLossAreas', true);
  const [showFibonacciProjection, setShowFibonacciProjection] = useLocalStorage('marketmind:showFibonacciProjection', false);
  const [showMeasurementRuler, setShowMeasurementRuler] = useLocalStorage('marketmind:showMeasurementRuler', false);
  const [showMeasurementArea, setShowMeasurementArea] = useLocalStorage('marketmind:showMeasurementArea', false);
  const [showTooltip, setShowTooltip] = useLocalStorage('marketmind:showTooltip', false);
  const [showStochastic, setShowStochastic] = useLocalStorage('marketmind:showStochastic', false);
  const [showRSI, setShowRSI] = useLocalStorage('marketmind:showRSI', false);
  const [showBollingerBands, setShowBollingerBands] = useLocalStorage('marketmind:showBollingerBands', false);
  const [showATR, setShowATR] = useLocalStorage('marketmind:showATR', false);
  const [showVWAP, setShowVWAP] = useLocalStorage('marketmind:showVWAP', false);
  const [showEventRow, setShowEventRow] = useLocalStorage('marketmind:showEventRow', true);
  const [chartType] = useLocalStorage<'kline' | 'line'>('marketmind:chartType', 'kline');
  const [timeframe, setTimeframe] = useLocalStorage<Timeframe>('marketmind:timeframe', (routeTimeframe as Timeframe) || '4h');
  const [movingAverages, setMovingAverages] = useLocalStorage<MovingAverageConfig[]>(
    'marketmind:movingAverages',
    DEFAULT_MOVING_AVERAGES
  );

  const [advancedConfig] = useLocalStorage<AdvancedControlsConfig>('marketmind:advancedConfig', {
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

  const { useKlineList } = useBackendKlines();
  const backendKlinesQuery = useKlineList({
    symbol,
    interval: timeframe as any,
    marketType,
    limit: REQUIRED_KLINES,
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
    if (routeSymbol && routeSymbol !== symbol) {
      setSymbol(routeSymbol);
    } else if (initialSymbol && initialSymbol !== symbol) {
      setSymbol(initialSymbol);
    }
  }, [routeSymbol, initialSymbol]);

  useEffect(() => {
    if (routeTimeframe && routeTimeframe !== timeframe) {
      setTimeframe(routeTimeframe as Timeframe);
    }
  }, [routeTimeframe]);

  useEffect(() => {
    const newPath = `/chart/${encodeURIComponent(symbol)}/${timeframe}`;
    const currentPath = window.location.hash.slice(1);
    if (currentPath !== newPath) {
      navigate(newPath, { replace: true });
    }
  }, [symbol, timeframe, navigate]);

  const clearDetectedSetups = useSetupStore((state) => state.clearDetectedSetups);

  const handleSymbolChange = useCallback((newSymbol: string, newMarketType?: MarketType): void => {
    clearDetectedSetups();
    setSymbol(newSymbol);
    if (newMarketType) setMarketType(newMarketType);
  }, [setSymbol, setMarketType, clearDetectedSetups]);

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
          isBacktestOpen={false}
          onToggleTrading={() => { }}
          onToggleBacktest={() => { }}
        />
      </Box>

      <Box flex="1" position="relative" overflow="hidden">
        <ChartToolsToolbar
          showGrid={showGrid}
          showCurrentPriceLine={showCurrentPriceLine}
          showCrosshair={showCrosshair}
          showProfitLossAreas={showProfitLossAreas}
          showFibonacciProjection={showFibonacciProjection}
          showMeasurementRuler={showMeasurementRuler}
          showMeasurementArea={showMeasurementArea}
          showTooltip={showTooltip}
          showVolume={showVolume}
          showStochastic={showStochastic}
          showRSI={showRSI}
          showBollingerBands={showBollingerBands}
          showATR={showATR}
          showVWAP={showVWAP}
          showEventRow={showEventRow}
          movingAverages={movingAverages}
          onShowGridChange={setShowGrid}
          onShowCurrentPriceLineChange={setShowCurrentPriceLine}
          onShowCrosshairChange={setShowCrosshair}
          onShowProfitLossAreasChange={setShowProfitLossAreas}
          onShowFibonacciProjectionChange={setShowFibonacciProjection}
          onShowMeasurementRulerChange={setShowMeasurementRuler}
          onShowMeasurementAreaChange={setShowMeasurementArea}
          onShowTooltipChange={setShowTooltip}
          onShowVolumeChange={setShowVolume}
          onShowStochasticChange={setShowStochastic}
          onShowRSIChange={setShowRSI}
          onShowBollingerBandsChange={setShowBollingerBands}
          onShowATRChange={setShowATR}
          onShowVWAPChange={setShowVWAP}
          onShowEventRowChange={setShowEventRow}
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
            chartType={chartType}
            movingAverages={movingAverages}
            advancedConfig={debouncedAdvancedConfig}
            timeframe={timeframe}
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
