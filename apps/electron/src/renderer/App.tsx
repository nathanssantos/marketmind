import type { ChartType, MarketType } from '@marketmind/types';
import { CHART_CONFIG } from '@shared/constants/chartConfig';
import { useEffect, useMemo, type ReactElement } from 'react';
import { KeyboardShortcutDispatcher } from './components/KeyboardShortcutDispatcher';
import { KeyboardShortcutHelpDialog } from './components/Help/KeyboardShortcutHelpDialog';
import { PreferencesHydrator } from './components/PreferencesHydrator';
import { useGlobalKeyboardShortcuts } from './hooks/useGlobalKeyboardShortcuts';
import type { AdvancedControlsConfig } from './components/Chart/AdvancedControls';

import { PinnedControlsProvider } from './components/Chart/PinnedControlsContext';
import type { Timeframe } from './components/Chart/TimeframeSelector';
import { ErrorBoundary } from './components/ErrorBoundary';
import { MainLayout } from './components/Layout/MainLayout';
import { UpdateNotification } from './components/Update/UpdateNotification';
import { DEFAULT_TIMEFRAME } from './constants/defaults';
import { ChartProvider } from './context/ChartContext';
import { RealtimeTradingSyncProvider } from './context/RealtimeTradingSyncContext';
import { trpc } from './utils/trpc';
import { useKlinePagination } from './hooks/useKlinePagination';
import { useKlineLiveStream } from './hooks/useKlineLiveStream';
import { useBackendWallet } from './hooks/useBackendWallet';
import { useChartData } from './hooks/useChartData';
import { useLayoutSync } from './hooks/useLayoutSync';

import { useOrderNotifications } from './hooks/useOrderNotifications';
import { useSetupToasts } from './hooks/useSetupToasts';
import { useAutoActivateDefaultIndicators } from './hooks/useAutoActivateDefaultIndicators';
import { useAutoActivateDefaultPatterns } from './hooks/useAutoActivateDefaultPatterns';
import { useIndicatorStore } from './store/indicatorStore';
import { useShallow } from 'zustand/shallow';
import { useChartPref } from './store/preferencesStore';
import { useCurrencyAutoRefresh } from './store/currencyStore';
import { setToasterNavigateToSymbol } from './utils/toaster';
import { ToastShelf } from './components/Toast/ToastShelf';

function RealtimeSyncWrapper({ children }: { children: React.ReactNode }) {
  const { wallets } = useBackendWallet();
  const activeWalletId = wallets[0]?.id;
  // Pass every wallet id so the provider can subscribe to each wallet's
  // socket room — closing a trade on a non-focused wallet still patches
  // its balance row in wallet.list without a manual sync.
  const allWalletIds = useMemo(() => wallets.map((w) => w.id), [wallets]);

  return (
    <RealtimeTradingSyncProvider walletId={activeWalletId} allWalletIds={allWalletIds}>
      {children}
    </RealtimeTradingSyncProvider>
  );
}

function App(): ReactElement {
  return (
    <ErrorBoundary>
      <PreferencesHydrator>
        <ToastShelf />
        <KeyboardShortcutDispatcher />
        <KeyboardShortcutHelpDialog />
        <GlobalShortcuts />
        <ChartProvider>
          <PinnedControlsProvider>
            <RealtimeSyncWrapper>
              <AppContent />
            </RealtimeSyncWrapper>
          </PinnedControlsProvider>
        </ChartProvider>
      </PreferencesHydrator>
    </ErrorBoundary>
  );
}

function GlobalShortcuts(): null {
  useGlobalKeyboardShortcuts();
  return null;
}

function AppContent(): ReactElement {
  const utils = trpc.useUtils();

  useEffect(() => {
    void Promise.all([
      utils.wallet.list.prefetch(),
      utils.tradingProfiles.list.prefetch(),
    ]);
  }, []);

  const [symbol] = useChartPref('symbol', 'BTCUSDT');
  const [marketType] = useChartPref<MarketType>('marketType', 'FUTURES');

  useCurrencyAutoRefresh();
  useOrderNotifications();
  useSetupToasts();
  useAutoActivateDefaultIndicators();
  useAutoActivateDefaultPatterns();

  const [chartType] = useChartPref<ChartType>('chartType', 'kline');
  const [timeframe] = useChartPref<Timeframe>('timeframe', DEFAULT_TIMEFRAME);
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

  const indicatorInstances = useIndicatorStore(useShallow((s) => s.instances));
  const showVolume = useMemo(
    () => indicatorInstances.some((i) => i.visible && i.catalogType === 'volume'),
    [indicatorInstances],
  );


  const {
    allKlines: paginatedKlines,
    refetch: refetchKlines,
  } = useKlinePagination({
    symbol,
    interval: timeframe,
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

  const {
    effectiveSymbol,
    effectiveMarketType,
    effectiveTimeframe,
    handleSymbolChange,
    handleTimeframeChange,
    handleChartTypeChange,
    handleMarketTypeChange,
  } = useLayoutSync();

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
    marketType,
  });

  return (
    <>
      <MainLayout
        advancedConfig={advancedConfig}
        onAdvancedConfigChange={setAdvancedConfig}
        symbol={effectiveSymbol}
        marketType={effectiveMarketType}
        onMarketTypeChange={handleMarketTypeChange}
        timeframe={effectiveTimeframe}
        onChartTypeChange={handleChartTypeChange}
        onSymbolChange={handleSymbolChange}
        onTimeframeChange={handleTimeframeChange}
        onNavigateToSymbol={handleSymbolChange}
      />

      <UpdateNotification />
    </>
  );
}

export default App;
