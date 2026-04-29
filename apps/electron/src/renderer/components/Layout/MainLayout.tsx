import { GlobalActionsProvider } from '@/renderer/context/GlobalActionsContext';
import { useBacktestModalStore } from '@/renderer/store/backtestModalStore';
import { usePreferencesStore, useUIPref } from '@/renderer/store/preferencesStore';
import { useScreenerStore } from '@/renderer/store/screenerStore';
import { useUIStore } from '@/renderer/store/uiStore';
import { perfMonitor } from '@/renderer/utils/canvas/perfMonitor';
import { exposeGlobalActionsForE2E } from '@/renderer/utils/e2eBridge';
import { Box, Flex } from '@chakra-ui/react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { AdvancedControlsConfig } from '../Chart/AdvancedControls';
import type { Timeframe } from '../Chart/TimeframeSelector';
import type { ChartType, MarketType } from '@marketmind/types';
import { MarketSidebar } from '../MarketSidebar';
import { AnalyticsModal } from '../Analytics';
import { BacktestModal } from '../Backtest';
import { ScreenerModal } from '../Screener';
import { SettingsDialog } from '../Settings/SettingsDialog';
import { DEFAULT_SETTINGS_TAB, type SettingsTab } from '../Settings/constants';
import { TradingSidebar } from '../Trading/TradingSidebar';
import { AutoTradingSidebar } from '../AutoTrading/AutoTradingSidebar';
import { OrderFlowSidebar } from '../OrderFlow';
import { ChartToolsToolbar } from './ChartToolsToolbar';
import { QuickTradeToolbar, type QuickTradeMode } from './QuickTradeToolbar';
import { SymbolTabBar } from './SymbolTabBar';
import { LayoutTabBar } from './LayoutTabBar';
import { MinimizedPanelBar } from './MinimizedPanelBar';
import { ChartGrid } from './ChartGrid';
import { Toolbar } from './Toolbar';

interface MainLayoutProps {
  onOpenSymbolSelector?: () => void;
  advancedConfig: AdvancedControlsConfig;
  onAdvancedConfigChange: (config: AdvancedControlsConfig) => void;
  isTradingOpen: boolean;
  isAutoTradingOpen: boolean;
  onToggleTrading: () => void;
  onToggleAutoTrading: () => void;
  symbol: string;
  marketType?: MarketType;
  onMarketTypeChange?: (marketType: MarketType) => void;
  timeframe: Timeframe;
  onChartTypeChange: (type: ChartType) => void;
  onSymbolChange: (symbol: string) => void;
  onTimeframeChange: (timeframe: Timeframe) => void;
  onNavigateToSymbol?: (symbol: string, marketType?: MarketType) => void;
}

const MIN_TRADING_WIDTH = 300;
const DEFAULT_TRADING_WIDTH = MIN_TRADING_WIDTH;

const MIN_MARKET_WIDTH = 300;
const DEFAULT_MARKET_WIDTH = MIN_MARKET_WIDTH;

const MAX_SIDEBAR_RATIO = 0.75;

const MainLayoutComponent = ({
  onOpenSymbolSelector,
  advancedConfig,
  onAdvancedConfigChange,
  isTradingOpen,
  isAutoTradingOpen,
  onToggleTrading,
  onToggleAutoTrading,
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
  const [quickTradeMode, setQuickTradeMode] = useUIPref<QuickTradeMode>('quickTradeMode', 'sidebar');
  const [tradingWidth, setTradingWidth] = useUIPref('tradingSidebarWidth', DEFAULT_TRADING_WIDTH);
  const [autoTradingWidth, setAutoTradingWidth] = useUIPref('autoTradingSidebarWidth', DEFAULT_TRADING_WIDTH);
  const [marketWidth, setMarketWidth] = useUIPref('marketSidebarWidth', DEFAULT_MARKET_WIDTH);
  const [orderFlowWidth, setOrderFlowWidth] = useUIPref('orderFlowSidebarWidth', DEFAULT_MARKET_WIDTH);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<SettingsTab>(DEFAULT_SETTINGS_TAB);
  const resizingRef = useRef<'trading' | 'autoTrading' | 'market' | 'orderFlow' | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  const { marketSidebarOpen, orderFlowSidebarOpen } = useUIStore(useShallow((state) => ({
    marketSidebarOpen: state.marketSidebarOpen,
    orderFlowSidebarOpen: state.orderFlowSidebarOpen,
  })));

  const closeAll = useCallback(() => {
    setIsSettingsOpen(false);
    const ui = useUIStore.getState();
    ui.setOrdersDialogOpen(false);
    ui.setAnalyticsOpen(false);
    ui.setMarketSidebarOpen(false);
    ui.setOrderFlowSidebarOpen(false);
    useBacktestModalStore.getState().closeBacktest();
    useScreenerStore.getState().setScreenerOpen(false);
    const prefs = usePreferencesStore.getState();
    prefs.set('ui', 'tradingSidebarOpen', false);
    prefs.set('ui', 'autoTradingSidebarOpen', false);
  }, []);

  const globalActions = useMemo(() => ({
    openSettings: (tab?: SettingsTab) => {
      setSettingsInitialTab(tab ?? DEFAULT_SETTINGS_TAB);
      setIsSettingsOpen(true);
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

  const startResize = useCallback((e: React.MouseEvent, target: 'trading' | 'autoTrading' | 'market' | 'orderFlow', currentWidth: number) => {
    e.preventDefault();
    resizingRef.current = target;
    startXRef.current = e.clientX;
    startWidthRef.current = currentWidth;
    setIsResizing(true);
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => startResize(e, 'trading', tradingWidth), [startResize, tradingWidth]);
  const handleMarketMouseDown = useCallback((e: React.MouseEvent) => startResize(e, 'market', marketWidth), [startResize, marketWidth]);
  const handleOrderFlowMouseDown = useCallback((e: React.MouseEvent) => startResize(e, 'orderFlow', orderFlowWidth), [startResize, orderFlowWidth]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const target = resizingRef.current;
    if (!target) return;
    const maxWidth = Math.floor(window.innerWidth * MAX_SIDEBAR_RATIO);
    if (target === 'market') {
      const deltaX = e.clientX - startXRef.current;
      const newWidth = Math.min(Math.max(startWidthRef.current + deltaX, MIN_MARKET_WIDTH), maxWidth);
      setMarketWidth(newWidth);
    } else if (target === 'trading') {
      const deltaX = startXRef.current - e.clientX;
      const newWidth = Math.min(Math.max(startWidthRef.current + deltaX, MIN_TRADING_WIDTH), maxWidth);
      setTradingWidth(newWidth);
    } else if (target === 'autoTrading') {
      const deltaX = startXRef.current - e.clientX;
      const newWidth = Math.min(Math.max(startWidthRef.current + deltaX, MIN_TRADING_WIDTH), maxWidth);
      setAutoTradingWidth(newWidth);
    } else if (target === 'orderFlow') {
      const deltaX = e.clientX - startXRef.current;
      const newWidth = Math.min(Math.max(startWidthRef.current + deltaX, MIN_MARKET_WIDTH), maxWidth);
      setOrderFlowWidth(newWidth);
    }
  }, [setTradingWidth, setMarketWidth, setAutoTradingWidth, setOrderFlowWidth]);

  const handleMouseUp = useCallback(() => {
    resizingRef.current = null;
    setIsResizing(false);
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, handleMouseMove, handleMouseUp]);

  return (
    <GlobalActionsProvider actions={globalActions}>
      <Box width="100vw" height="100vh" overflow="hidden">
        <Toolbar
          symbol={symbol}
          marketType={marketType}
          onMarketTypeChange={onMarketTypeChange}
          timeframe={timeframe}
          isTradingOpen={isTradingOpen}
          isAutoTradingOpen={isAutoTradingOpen}
          onSymbolChange={onSymbolChange}
          onTimeframeChange={onTimeframeChange}
          onToggleTrading={onToggleTrading}
          onToggleAutoTrading={onToggleAutoTrading}
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
          {marketSidebarOpen && (
            <>
              <MarketSidebar width={marketWidth} />
              <Box
                position="relative"
                width="4px"
                bg="border"
                cursor="col-resize"
                _hover={{ bg: 'green.500' }}
                onMouseDown={handleMarketMouseDown}
                userSelect="none"
              />
            </>
          )}

          {orderFlowSidebarOpen && (
            <>
              <OrderFlowSidebar width={orderFlowWidth} symbol={symbol} />
              <Box
                position="relative"
                width="4px"
                bg="border"
                cursor="col-resize"
                _hover={{ bg: 'green.500' }}
                onMouseDown={handleOrderFlowMouseDown}
                userSelect="none"
              />
            </>
          )}

          <ChartToolsToolbar />

          <Flex
            flex={1}
            direction="column"
            position="relative"
            overflow="hidden"
            width={(() => {
              let rightWidth = 0;
              if (isTradingOpen) rightWidth += tradingWidth;
              if (isAutoTradingOpen) rightWidth += autoTradingWidth;
              const leftWidth = (marketSidebarOpen ? marketWidth : 0) + (orderFlowSidebarOpen ? orderFlowWidth : 0);
              const totalSidebar = leftWidth + rightWidth;
              return totalSidebar > 0 ? `calc(100% - ${totalSidebar}px)` : '100%';
            })()}
            transition="width 0.2s ease"
          >
            <SymbolTabBar />
            {symbol && quickTradeMode === 'chart' && (
              <QuickTradeToolbar symbol={symbol} marketType={marketType} onMenuAction={setQuickTradeMode} currentMode={quickTradeMode} />
            )}
            <Box flex={1} overflow="hidden">
              <ChartGrid />
            </Box>
            <MinimizedPanelBar />
            <LayoutTabBar />
          </Flex>

          {isAutoTradingOpen && (
            <>
              <Box
                position="relative"
                width="4px"
                bg="border"
                cursor="col-resize"
                _hover={{ bg: 'green.500' }}
                onMouseDown={(e) => startResize(e, 'autoTrading', autoTradingWidth)}
                userSelect="none"
              />
              <AutoTradingSidebar width={autoTradingWidth} onClose={onToggleAutoTrading} />
            </>
          )}

          {isTradingOpen && (
            <>
              <Box
                position="relative"
                width="4px"
                bg="border"
                cursor="col-resize"
                _hover={{ bg: 'green.500' }}
                onMouseDown={handleMouseDown}
                userSelect="none"
              />
              <TradingSidebar width={tradingWidth} onClose={onToggleTrading} symbol={symbol} marketType={marketType} quickTradeMode={quickTradeMode} onQuickTradeModeChange={setQuickTradeMode} />
            </>
          )}
        </Flex>

        <SettingsDialog
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          initialTab={settingsInitialTab}
          advancedConfig={advancedConfig}
          onAdvancedConfigChange={onAdvancedConfigChange}
        />
        <ScreenerModal onSymbolClick={onNavigateToSymbol} />
        <BacktestModal />
        <AnalyticsModal />
      </Box>
    </GlobalActionsProvider>
  );
};

export const MainLayout = React.memo(MainLayoutComponent);
