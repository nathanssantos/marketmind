import { Box, ChakraProvider, Text as ChakraText, IconButton, Toaster } from '@chakra-ui/react';
import { CHART_CONFIG } from '@shared/constants/chartConfig';
import type { Candle } from '@shared/types';
import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { LuX } from 'react-icons/lu';
import type { AdvancedControlsConfig } from './components/Chart/AdvancedControls';
import { ChartCanvas } from './components/Chart/ChartCanvas';
import { PinnedControlsProvider } from './components/Chart/PinnedControlsContext';
import type { Timeframe } from './components/Chart/TimeframeSelector';
import type { MovingAverageConfig } from './components/Chart/useMovingAverageRenderer';
import { MainLayout } from './components/Layout/MainLayout';
import { Toolbar } from './components/Layout/Toolbar';
import { OnboardingDialog } from './components/Onboarding/OnboardingDialog';
import { ErrorMessage } from './components/ui/ErrorMessage';
import { LoadingSpinner } from './components/ui/LoadingSpinner';
import { UpdateNotification } from './components/Update/UpdateNotification';
import { AIStudyHoverProvider } from './context/AIStudyHoverContext';
import { ChartProvider } from './context/ChartContext';
import { useGlobalActions } from './context/GlobalActionsContext';
import { useAIStudies } from './hooks/useAIStudies';
import { useChartData } from './hooks/useChartData';
import { useDebounce } from './hooks/useDebounce';
import { useGlobalKeyboardShortcuts } from './hooks/useGlobalKeyboardShortcuts';
import { useLocalStorage } from './hooks/useLocalStorage';
import { useMarketData } from './hooks/useMarketData';
import { useNews } from './hooks/useNews';
import { useRealtimeCandle } from './hooks/useRealtimeCandle';
import { useSimulatorLayout } from './hooks/useSimulatorLayout';
import { MarketDataService } from './services/market/MarketDataService';
import { BinanceProvider } from './services/market/providers/BinanceProvider';
import { CoinGeckoProvider } from './services/market/providers/CoinGeckoProvider';
import { useAIStore } from './store/aiStore';
import { useTradingStore } from './store/tradingStore';
import { system } from './theme';
import { runMigrations } from './utils/migration';
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
    <ChakraProvider value={system}>
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
      <AIStudyHoverProvider>
        <ChartProvider>
          <PinnedControlsProvider>
            <AppContent />
          </PinnedControlsProvider>
        </ChartProvider>
      </AIStudyHoverProvider>
    </ChakraProvider>
  );
}

function AppContent(): ReactElement {
  const { t } = useTranslation();
  
  useSimulatorLayout();

  const [symbol, setSymbol] = useLocalStorage('marketmind:symbol', 'BTCUSDT');
  const [showVolume, setShowVolume] = useLocalStorage('marketmind:showVolume', true);
  const [showGrid, setShowGrid] = useLocalStorage('marketmind:showGrid', true);
  const [showCurrentPriceLine, setShowCurrentPriceLine] = useLocalStorage('marketmind:showCurrentPriceLine', true);
  const [showCrosshair, setShowCrosshair] = useLocalStorage('marketmind:showCrosshair', true);
  const [showMeasurementRuler, setShowMeasurementRuler] = useLocalStorage('marketmind:showMeasurementRuler', false);
  const [showMeasurementArea, setShowMeasurementArea] = useLocalStorage('marketmind:showMeasurementArea', false);
  const [chartType, setChartType] = useLocalStorage<'candlestick' | 'line'>('marketmind:chartType', 'candlestick');
  const [timeframe, setTimeframe] = useLocalStorage<Timeframe>('marketmind:timeframe', '1d');
  const [showOnboarding, setShowOnboarding] = useLocalStorage('marketmind:showOnboarding', true);
  const [isChatOpen, setIsChatOpen] = useLocalStorage('chat-sidebar-open', true);
  const [movingAverages, setMovingAverages] = useLocalStorage<MovingAverageConfig[]>(
    'marketmind:movingAverages',
    DEFAULT_MOVING_AVERAGES
  );
  const [advancedConfig, setAdvancedConfig] = useLocalStorage<AdvancedControlsConfig>('marketmind:advancedConfig', {
    rightMargin: CHART_CONFIG.CHART_RIGHT_MARGIN,
    volumeHeightRatio: CHART_CONFIG.VOLUME_HEIGHT_RATIO,
    candleSpacing: CHART_CONFIG.CANDLE_SPACING,
    candleWickWidth: CHART_CONFIG.CANDLE_WICK_WIDTH,
    gridLineWidth: CHART_CONFIG.GRID_LINE_WIDTH,
    currentPriceLineWidth: CHART_CONFIG.CURRENT_PRICE_LINE_WIDTH,
    currentPriceLineStyle: CHART_CONFIG.CURRENT_PRICE_LINE_STYLE,
    paddingTop: CHART_CONFIG.CANVAS_PADDING_TOP,
    paddingBottom: CHART_CONFIG.CANVAS_PADDING_BOTTOM,
    paddingLeft: CHART_CONFIG.CANVAS_PADDING_LEFT,
    paddingRight: CHART_CONFIG.CANVAS_PADDING_RIGHT,
  });

  useEffect(() => {
    runMigrations().catch((error) => {
      console.error('Migration failed:', error);
    });
  }, []);

  const restoreActiveConversation = useAIStore((state) => state.restoreActiveConversation);
  const setActiveConversationBySymbol = useAIStore((state) => state.setActiveConversationBySymbol);
  const getActiveConversation = useAIStore((state) => state.getActiveConversation);

  const isSimulatorActive = useTradingStore((state) => state.isSimulatorActive);
  const toggleSimulator = useTradingStore((state) => state.toggleSimulator);

  const toggleChat = useCallback(() => {
    setIsChatOpen((prev) => !prev);
  }, [setIsChatOpen]);

  useEffect(() => {
    restoreActiveConversation();
  }, [restoreActiveConversation]);

  useEffect(() => {
    const activeConv = getActiveConversation();
    if (!activeConv || activeConv.symbol !== symbol) {
      setActiveConversationBySymbol(symbol);
    }
  }, [symbol, setActiveConversationBySymbol, getActiveConversation]);

  const marketService = useMemo(() => {
    const binance = new BinanceProvider();
    const coingecko = new CoinGeckoProvider();

    return new MarketDataService({
      primaryProvider: binance,
      fallbackProviders: [coingecko],
      enableCache: true,
      cacheDuration: 60 * 1000,
    });
  }, []);

  const { data: marketData, loading, error } = useMarketData(marketService, {
    symbol,
    interval: timeframe,
    limit: 500,
    enabled: true,
  });

  const [liveCandles, setLiveCandles] = useState<Candle[]>([]);

  const handleRealtimeUpdate = useCallback((candle: Candle, isFinal: boolean) => {
    setLiveCandles(prev => {
      if (prev.length === 0) return [candle];

      const lastCandle = prev[prev.length - 1];

      if (lastCandle && candle.timestamp === lastCandle.timestamp) {
        return [...prev.slice(0, -1), candle];
      }

      if (isFinal) {
        return [...prev, candle];
      }

      return [...prev.slice(0, -1), candle];
    });
  }, []);

  useRealtimeCandle(marketService, {
    symbol,
    interval: timeframe,
    enabled: !!marketData,
    onUpdate: handleRealtimeUpdate,
  });

  const displayCandles = useMemo(() => {
    if (!marketData?.candles) return [];
    if (liveCandles.length === 0) return marketData.candles;

    const baseCandles = [...marketData.candles];
    const lastBaseCandle = baseCandles[baseCandles.length - 1];
    const firstLiveCandle = liveCandles[0];

    if (lastBaseCandle && firstLiveCandle && firstLiveCandle.timestamp === lastBaseCandle.timestamp) {
      return [...baseCandles.slice(0, -1), ...liveCandles];
    }

    return [...baseCandles, ...liveCandles];
  }, [marketData, liveCandles]);

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

  const updateConversationStudyDataId = useAIStore(state => state.updateConversationStudyDataId);
  const activeConversationId = useAIStore(state => state.activeConversationId);

  const {
    studies: aiStudies,
    studiesVisible,
    studyDataId,
    deleteStudies,
    toggleStudiesVisibility,
    processAIResponse
  } = useAIStudies({ symbol, conversationId: activeConversationId });
  const setResponseProcessor = useAIStore(state => state.setResponseProcessor);
  const enableAIStudies = useAIStore(state => state.enableAIStudies);

  useEffect(() => {
    if (enableAIStudies) {
      setResponseProcessor(processAIResponse);
    } else {
      setResponseProcessor(null);
    }
    return () => setResponseProcessor(null);
  }, [processAIResponse, setResponseProcessor, enableAIStudies]);

  useEffect(() => {
    if (activeConversationId && studyDataId) {
      updateConversationStudyDataId(activeConversationId, studyDataId);
    }
  }, [activeConversationId, studyDataId, updateConversationStudyDataId]);

  const { articles: newsArticles } = useNews({
    symbols: [extractSymbolCode(symbol)],
    limit: 10,
    enabled: false,
    refetchInterval: 5 * 60 * 1000,
  });

  useChartData({
    candles: displayCandles,
    symbol,
    timeframe,
    chartType,
    showVolume,
    movingAverages,
    news: newsArticles,
  });

  return (
    <>
      <Toolbar
        marketService={marketService}
        symbol={symbol}
        timeframe={timeframe}
        chartType={chartType}
        showVolume={showVolume}
        showGrid={showGrid}
        showCurrentPriceLine={showCurrentPriceLine}
        showCrosshair={showCrosshair}
        showMeasurementRuler={showMeasurementRuler}
        showMeasurementArea={showMeasurementArea}
        movingAverages={movingAverages}
        isSimulatorActive={isSimulatorActive}
        isChatOpen={isChatOpen}
        onSymbolChange={setSymbol}
        onTimeframeChange={setTimeframe}
        onChartTypeChange={setChartType}
        onShowVolumeChange={setShowVolume}
        onShowGridChange={setShowGrid}
        onShowCurrentPriceLineChange={setShowCurrentPriceLine}
        onShowCrosshairChange={setShowCrosshair}
        onShowMeasurementRulerChange={setShowMeasurementRuler}
        onShowMeasurementAreaChange={setShowMeasurementArea}
        onMovingAveragesChange={setMovingAverages}
        onToggleSimulator={toggleSimulator}
        onToggleChat={toggleChat}
      />

      <MainLayout
        onOpenSymbolSelector={() => { }}
        advancedConfig={advancedConfig}
        onAdvancedConfigChange={setAdvancedConfig}
        isChatOpen={isChatOpen}
        onToggleChat={toggleChat}
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
            candles={displayCandles}
            width="100%"
            height="100%"
            showVolume={showVolume}
            showGrid={showGrid}
            showCurrentPriceLine={showCurrentPriceLine}
            showCrosshair={showCrosshair}
            showMeasurementRuler={showMeasurementRuler}
            showMeasurementArea={showMeasurementArea}
            chartType={chartType}
            movingAverages={movingAverages}
            advancedConfig={debouncedAdvancedConfig}
            aiStudies={aiStudies}
            onDeleteAIStudies={deleteStudies}
            onToggleAIStudiesVisibility={toggleStudiesVisibility}
            aiStudiesVisible={studiesVisible}
            timeframe={timeframe}
          />
        )}
      </MainLayout>

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
  chartType: 'candlestick' | 'line';
  setChartType: (value: 'candlestick' | 'line' | ((prev: 'candlestick' | 'line') => 'candlestick' | 'line')) => void;
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
    onToggleChartType: () => setChartType(prev => prev === 'candlestick' ? 'line' : 'candlestick'),
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
        candleSpacing: Math.min(prev.candleSpacing + 1, 30),
      }));
    },
    onZoomOut: () => {
      setAdvancedConfig(prev => ({
        ...prev,
        candleSpacing: Math.max(prev.candleSpacing - 1, 2),
      }));
    },
    onResetZoom: () => {
      setAdvancedConfig(prev => ({
        ...prev,
        candleSpacing: CHART_CONFIG.CANDLE_SPACING,
      }));
    },
    onPanLeft: () => { },
    onPanRight: () => { },
    onOpenSettings: globalActions.openSettings,
    onToggleChatSidebar: globalActions.toggleChatSidebar,
    onFocusChatInput: globalActions.focusChatInput,
    onShowShortcuts: globalActions.showKeyboardShortcuts,
    onOpenSymbolSelector: () => { },
  });

  return null;
}

export default App;
