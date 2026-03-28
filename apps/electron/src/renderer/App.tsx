import { Box, ChakraProvider, Flex, Text as ChakraText, Toaster } from '@chakra-ui/react';
import { CryptoIcon, IconButton } from './components/ui';
import type { MarketType, ChartType } from '@marketmind/types';
import { CHART_CONFIG } from '@shared/constants/chartConfig';
import { useCallback, useEffect, useMemo, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { LuX } from 'react-icons/lu';
import { AutoAuth } from './components/Auth/AutoAuth';
import { PreferencesHydrator } from './components/PreferencesHydrator';
import type { AdvancedControlsConfig } from './components/Chart/AdvancedControls';

import { PinnedControlsProvider } from './components/Chart/PinnedControlsContext';
import type { Timeframe } from './components/Chart/TimeframeSelector';
import type { MovingAverageConfig } from './components/Chart/useMovingAverageRenderer';
import { ErrorBoundary } from './components/ErrorBoundary';
import { MainLayout } from './components/Layout/MainLayout';
import { UpdateNotification } from './components/Update/UpdateNotification';
import { DEFAULT_MOVING_AVERAGES, DEFAULT_TIMEFRAME } from './constants/defaults';
import { ChartProvider } from './context/ChartContext';
import { RealtimeTradingSyncProvider } from './context/RealtimeTradingSyncContext';
import { trpc } from './utils/trpc';
import { useKlinePagination } from './hooks/useKlinePagination';
import { useKlineLiveStream } from './hooks/useKlineLiveStream';
import { useBackendWallet } from './hooks/useBackendWallet';
import { useChartData } from './hooks/useChartData';

import { useOrderNotifications } from './hooks/useOrderNotifications';
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
                        <CryptoIcon symbol={symbol} size={24} />
                        <ChakraText fontWeight="bold" fontSize="sm">{toast.title}</ChakraText>
                      </Flex>
                    ) : (
                      <ChakraText fontWeight="bold" fontSize="sm" mb={1} pr={6}>
                        {toast.title}
                      </ChakraText>
                    )}
                    {toast.description && (
                      <ChakraText fontSize="xs" pl={symbol ? 8 : 0}>{toast.description}</ChakraText>
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
  const utils = trpc.useUtils();

  useEffect(() => {
    void Promise.all([
      utils.wallet.list.prefetch(),
      utils.tradingProfiles.list.prefetch(),
    ]);
  }, []);

  const [symbol, setSymbol] = useChartPref('symbol', 'BTCUSDT');
  const [marketType, setMarketType] = useChartPref<MarketType>('marketType', 'FUTURES');

  useCurrencyAutoRefresh();
  useOrderNotifications();

  const [chartType, setChartType] = useChartPref<ChartType>('chartType', 'kline');
  const [timeframe, setTimeframe] = useChartPref<Timeframe>('timeframe', DEFAULT_TIMEFRAME);
  const [isTradingOpen, setIsTradingOpen] = useUIPref('tradingSidebarOpen', true);
  const [isAutoTradingOpen, setIsAutoTradingOpen] = useUIPref('autoTradingSidebarOpen', false);
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


  const toggleTrading = useCallback(() => {
    setIsTradingOpen((prev) => !prev);
  }, [setIsTradingOpen]);

  const toggleAutoTrading = useCallback(() => {
    setIsAutoTradingOpen((prev) => !prev);
  }, [setIsAutoTradingOpen]);

  const {
    allKlines: paginatedKlines,
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

  const { displayKlines } = useKlineLiveStream({
    symbol,
    timeframe,
    marketType,
    baseKlines: marketData?.klines,
    enabled: !!marketData,
    refetchKlines,
  });

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
        isAutoTradingOpen={isAutoTradingOpen}
        onToggleTrading={toggleTrading}
        onToggleAutoTrading={toggleAutoTrading}
        symbol={symbol}
        marketType={marketType}
        onMarketTypeChange={setMarketType}
        timeframe={timeframe}
        chartType={chartType}
        onChartTypeChange={setChartType}
        movingAverages={movingAverages}
        onSymbolChange={handleSymbolChange}
        onTimeframeChange={setTimeframe}
        onMovingAveragesChange={setMovingAverages}
        onNavigateToSymbol={handleSymbolChange}
      />

      <UpdateNotification />
    </>
  );
}

export default App;
