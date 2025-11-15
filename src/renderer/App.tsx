import { Box, ChakraProvider, Stack } from '@chakra-ui/react';
import { CHART_CONFIG } from '@shared/constants/chartConfig';
import type { Candle } from '@shared/types';
import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react';
import { AdvancedControls, type AdvancedControlsConfig } from './components/Chart/AdvancedControls';
import { ChartCanvas } from './components/Chart/ChartCanvas';
import { ChartControls } from './components/Chart/ChartControls';
import { PinnedControlsProvider } from './components/Chart/PinnedControlsContext';
import type { Timeframe } from './components/Chart/TimeframeSelector';
import type { MovingAverageConfig } from './components/Chart/useMovingAverageRenderer';
import { MainLayout } from './components/Layout/MainLayout';
import { OnboardingDialog } from './components/Onboarding/OnboardingDialog';
import { SymbolSelector } from './components/SymbolSelector';
import { ErrorMessage } from './components/ui/ErrorMessage';
import { LoadingSpinner } from './components/ui/LoadingSpinner';
import { UpdateNotification } from './components/Update/UpdateNotification';
import { ChartProvider } from './context/ChartContext';
import { useChartData } from './hooks/useChartData';
import { useDebounce } from './hooks/useDebounce';
import { useLocalStorage } from './hooks/useLocalStorage';
import { useMarketData } from './hooks/useMarketData';
import { useNews } from './hooks/useNews';
import { useRealtimeCandle } from './hooks/useRealtimeCandle';
import { MarketDataService } from './services/market/MarketDataService';
import { BinanceProvider } from './services/market/providers/BinanceProvider';
import { CoinGeckoProvider } from './services/market/providers/CoinGeckoProvider';
import { system } from './theme';
import { runMigrations } from './utils/migration';

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
    type: 'SMA',
    color: '#2196f3',
    lineWidth: 2,
    visible: true,
  },
  {
    period: 50,
    type: 'SMA',
    color: '#4caf50',
    lineWidth: 2,
    visible: false,
  },
  {
    period: 100,
    type: 'SMA',
    color: '#9c27b0',
    lineWidth: 2,
    visible: false,
  },
  {
    period: 200,
    type: 'SMA',
    color: '#f44336',
    lineWidth: 2,
    visible: false,
  },
];

function App(): ReactElement {
  return (
    <ChakraProvider value={system}>
      <ChartProvider>
        <PinnedControlsProvider>
          <AppContent />
        </PinnedControlsProvider>
      </ChartProvider>
    </ChakraProvider>
  );
}

function AppContent(): ReactElement {
  const [symbol, setSymbol] = useLocalStorage('marketmind:symbol', 'BTCUSDT');
  const [showVolume, setShowVolume] = useLocalStorage('marketmind:showVolume', true);
  const [showGrid, setShowGrid] = useLocalStorage('marketmind:showGrid', true);
  const [chartType, setChartType] = useLocalStorage<'candlestick' | 'line'>('marketmind:chartType', 'candlestick');
  const [timeframe, setTimeframe] = useLocalStorage<Timeframe>('marketmind:timeframe', '1d');
  const [showOnboarding, setShowOnboarding] = useLocalStorage('marketmind:showOnboarding', true);
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

  // News integration disabled until API keys are configured
  const { articles: newsArticles } = useNews({
    symbols: [extractSymbolCode(symbol)],
    limit: 10,
    enabled: false, // Enable this when you add API keys to .env
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
      <MainLayout>
        <Box position="absolute" top={4} right={4} zIndex={10}>
        <SymbolSelector
          marketService={marketService}
          value={symbol}
          onChange={setSymbol}
        />
      </Box>

          {/* Controls Container - Top Left */}
          <Stack 
            position="absolute" 
            top={4} 
            left={4} 
            gap={4} 
            zIndex={10}
            userSelect="none"
          >
            <ChartControls
              showVolume={showVolume}
              showGrid={showGrid}
              chartType={chartType}
              movingAverages={movingAverages}
              advancedConfig={advancedConfig}
              timeframe={timeframe}
              onShowVolumeChange={setShowVolume}
              onShowGridChange={setShowGrid}
              onChartTypeChange={setChartType}
              onMovingAveragesChange={setMovingAverages}
              onAdvancedConfigChange={setAdvancedConfig}
              onTimeframeChange={setTimeframe}
            />
            <AdvancedControls
              config={advancedConfig}
              onConfigChange={setAdvancedConfig}
            />
          </Stack>
          
          {loading && (
            <LoadingSpinner message="Loading market data..." />
          )}

          {error && (
            <ErrorMessage 
              title="Failed to Load Market Data"
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
              chartType={chartType}
              movingAverages={movingAverages}
              advancedConfig={debouncedAdvancedConfig}
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

export default App;
