import { GlobalActionsProvider } from '@/renderer/context/GlobalActionsContext';
import { useDisclosure } from '@/renderer/hooks';
import { useBacktestDialogStore } from '@/renderer/store/backtestDialogStore';
import { usePreferencesStore } from '@/renderer/store/preferencesStore';
import { useScreenerStore } from '@/renderer/store/screenerStore';
import { useUIStore } from '@/renderer/store/uiStore';
import { perfMonitor } from '@/renderer/utils/canvas/perfMonitor';
import { exposeGlobalActionsForE2E } from '@/renderer/utils/e2eBridge';
import { Box, Flex } from '@chakra-ui/react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { AdvancedControlsConfig } from '../Chart/AdvancedControls';
import type { Timeframe } from '../Chart/TimeframeSelector';
import type { ChartType, MarketType } from '@marketmind/types';
import { AnalyticsDialog } from '../Analytics';
import { BacktestDialog } from '../Backtest';
import { ScreenerDialog } from '../Screener';
import { SettingsDialog } from '../Settings/SettingsDialog';
import { OrdersDialog } from '../Trading/OrdersDialog';
import { TradingProfilesDialog } from '../Trading/TradingProfilesDialog';
import { WalletsDialog } from '../Trading/WalletsDialog';
import { DEFAULT_SETTINGS_TAB, type SettingsTab } from '../Settings/constants';
import { ChartToolsToolbar } from './ChartToolsToolbar';
import { SymbolTabBar } from './SymbolTabBar';
import { LayoutTabBar } from './LayoutTabBar';
import { MinimizedPanelBar } from './MinimizedPanelBar';
import { ChartGrid } from './ChartGrid';
import { GridEditFloatingActions } from './GridEditFloatingActions';
import { Toolbar } from './Toolbar';

interface MainLayoutProps {
  onOpenSymbolSelector?: () => void;
  advancedConfig: AdvancedControlsConfig;
  onAdvancedConfigChange: (config: AdvancedControlsConfig) => void;
  symbol: string;
  marketType?: MarketType;
  onMarketTypeChange?: (marketType: MarketType) => void;
  timeframe: Timeframe;
  onChartTypeChange: (type: ChartType) => void;
  onSymbolChange: (symbol: string) => void;
  onTimeframeChange: (timeframe: Timeframe) => void;
  onNavigateToSymbol?: (symbol: string, marketType?: MarketType) => void;
}

const MainLayoutComponent = ({
  onOpenSymbolSelector,
  advancedConfig,
  onAdvancedConfigChange,
  symbol,
  marketType,
  onMarketTypeChange,
  timeframe,
  onChartTypeChange,
  onSymbolChange,
  onTimeframeChange,
  onNavigateToSymbol,
}: MainLayoutProps) => {
  perfMonitor.recordComponentRender('MainLayout');
  const settingsDialog = useDisclosure();
  const [settingsInitialTab, setSettingsInitialTab] = useState<SettingsTab>(DEFAULT_SETTINGS_TAB);
  const isWalletsDialogOpen = useUIStore((s) => s.isWalletsDialogOpen);
  const isTradingProfilesDialogOpen = useUIStore((s) => s.isTradingProfilesDialogOpen);

  const closeAll = useCallback(() => {
    settingsDialog.close();
    const ui = useUIStore.getState();
    ui.setOrdersDialogOpen(false);
    ui.setAnalyticsOpen(false);
    ui.setWalletsDialogOpen(false);
    ui.setTradingProfilesDialogOpen(false);
    useBacktestDialogStore.getState().closeBacktest();
    useScreenerStore.getState().setScreenerOpen(false);
    // Sidebars are gone in v1.10 — their content lives in grid panels.
    // Closing every panel programmatically isn't part of "closeAll" today
    // since users would lose their workspace; if needed in the future, the
    // hook would call layoutStore.removePanel for each non-chart panel.
    void usePreferencesStore.getState();
  }, []);

  const globalActions = useMemo(() => ({
    openSettings: (tab?: SettingsTab) => {
      setSettingsInitialTab(tab ?? DEFAULT_SETTINGS_TAB);
      settingsDialog.open();
    },
    openSymbolSelector: () => onOpenSymbolSelector?.(),
    navigateToSymbol: (symbol: string, marketType?: MarketType) => onNavigateToSymbol?.(symbol, marketType),
    closeAll,
    setTimeframe: (tf: Timeframe) => onTimeframeChange(tf),
    setChartType: (type: ChartType) => onChartTypeChange(type),
    setMarketType: (mt: MarketType) => onMarketTypeChange?.(mt),
  }), [onOpenSymbolSelector, onNavigateToSymbol, closeAll, onTimeframeChange, onChartTypeChange, onMarketTypeChange]);

  useEffect(() => {
    exposeGlobalActionsForE2E({
      openSettings: (tab) => globalActions.openSettings(tab as SettingsTab | undefined),
      openSymbolSelector: globalActions.openSymbolSelector,
      navigateToSymbol: globalActions.navigateToSymbol,
      closeAll: globalActions.closeAll,
      setTimeframe: (tf) => globalActions.setTimeframe(tf as Timeframe),
      setChartType: (t) => globalActions.setChartType(t as ChartType),
      setMarketType: (mt) => globalActions.setMarketType(mt),
    });
  }, [globalActions]);

  return (
    <GlobalActionsProvider actions={globalActions}>
      <Box width="100vw" height="100vh" overflow="hidden">
        <Toolbar
          symbol={symbol}
          marketType={marketType}
          onMarketTypeChange={onMarketTypeChange}
          timeframe={timeframe}
          onSymbolChange={onSymbolChange}
          onTimeframeChange={onTimeframeChange}
        />
        <Flex
          position="relative"
          top={0}
          left={0}
          right={0}
          height="calc(100vh - 30px)"
          marginTop="30px"
          overflow="hidden"
        >
          <ChartToolsToolbar />

          <Flex
            flex={1}
            direction="column"
            position="relative"
            overflow="hidden"
            width="100%"
          >
            <SymbolTabBar />
            <Box flex={1} overflow="hidden" position="relative">
              <ChartGrid />
              <GridEditFloatingActions />
            </Box>
            <MinimizedPanelBar />
            <LayoutTabBar />
          </Flex>
        </Flex>

        <SettingsDialog
          isOpen={settingsDialog.isOpen}
          onClose={settingsDialog.close}
          initialTab={settingsInitialTab}
          advancedConfig={advancedConfig}
          onAdvancedConfigChange={onAdvancedConfigChange}
        />
        <ScreenerDialog onSymbolClick={onNavigateToSymbol} />
        <BacktestDialog />
        <AnalyticsDialog />
        <OrdersDialog />
        <WalletsDialog
          isOpen={isWalletsDialogOpen}
          onClose={() => useUIStore.getState().setWalletsDialogOpen(false)}
        />
        <TradingProfilesDialog
          isOpen={isTradingProfilesDialogOpen}
          onClose={() => useUIStore.getState().setTradingProfilesDialogOpen(false)}
        />
      </Box>
    </GlobalActionsProvider>
  );
};

export const MainLayout = React.memo(MainLayoutComponent);
