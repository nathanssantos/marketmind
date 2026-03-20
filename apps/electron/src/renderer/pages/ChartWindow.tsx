import { Box, ChakraProvider, Flex, Text as ChakraText, Toaster } from '@chakra-ui/react';
import { ErrorMessage, IconButton, LoadingSpinner } from '../components/ui';
import type { AssetClass, MarketType } from '@marketmind/types';
import { CHART_CONFIG } from '@shared/constants/chartConfig';
import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react';
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
import { DEFAULT_MOVING_AVERAGES as SHARED_DEFAULT_MAS, DEFAULT_TIMEFRAME } from '../constants/defaults';
import { ChartProvider } from '../context/ChartContext';
import { useKlinePagination } from '../hooks/useKlinePagination';
import { useKlineLiveStream } from '../hooks/useKlineLiveStream';
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

  const [chartType, setChartType] = useChartPref<string>('chartType', 'kline');
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

  const { displayKlines } = useKlineLiveStream({
    symbol,
    timeframe,
    marketType,
    baseKlines: marketData?.klines,
    enabled: !!marketData,
    refetchKlines,
  });

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
      <Box flexShrink={0} height="30px">
        <Toolbar
          symbol={symbol}
          marketType={marketType}
          onMarketTypeChange={setMarketType}
          onSymbolChange={handleSymbolChange}
          timeframe={timeframe}
          chartType={chartType as import('@marketmind/types').ChartType}
          onChartTypeChange={setChartType}
          onTimeframeChange={setTimeframe}
          movingAverages={movingAverages}
          showNewWindowButton={false}
          showSidebarButtons={false}
          isTradingOpen={false}
          isAutoTradingOpen={false}
          onToggleTrading={() => { }}
          onToggleAutoTrading={() => { }}
        />
      </Box>

      {assetClass === 'STOCKS' && <MarketStatusBar />}

      <Flex flex="1" overflow="hidden">
        <ChartToolsToolbar
          movingAverages={movingAverages}
          onMovingAveragesChange={setMovingAverages}
        />

        <Box flex="1" position="relative" overflow="hidden">
          {symbol && <QuickTradeToolbar symbol={symbol} marketType={marketType} />}
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
              chartType={chartType as 'kline' | 'line' | 'tick' | 'volume' | 'footprint'}
              movingAverages={movingAverages}
              advancedConfig={debouncedAdvancedConfig}
              timeframe={timeframe}
              onNearLeftEdge={hasMore ? loadOlderKlines : undefined}
              isLoadingMore={isLoadingMore}
            />
          )}
        </Box>
      </Flex>
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
              <ChakraText fontWeight="bold" fontSize="sm" mb={1} pr={6}>
                {toast.title}
              </ChakraText>
              {toast.description && (
                <ChakraText fontSize="xs">{toast.description}</ChakraText>
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
