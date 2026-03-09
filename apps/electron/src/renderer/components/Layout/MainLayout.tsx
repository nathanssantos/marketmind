import { GlobalActionsProvider } from '@/renderer/context/GlobalActionsContext';
import { useUIPref } from '@/renderer/store/preferencesStore';
import { useUIStore } from '@/renderer/store/uiStore';
import { Box, Flex } from '@chakra-ui/react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { AdvancedControlsConfig } from '../Chart/AdvancedControls';
import type { Timeframe } from '../Chart/TimeframeSelector';
import type { MovingAverageConfig } from '../Chart/useMovingAverageRenderer';
import { MarketSidebar } from '../MarketSidebar';
import { AnalyticsModal } from '../Analytics';
import { ScreenerModal } from '../Screener';
import { SettingsDialog } from '../Settings/SettingsDialog';
import { TradingSidebar } from '../Trading/TradingSidebar';
import { ChartToolsToolbar } from './ChartToolsToolbar';
import { Toolbar } from './Toolbar';

interface MainLayoutProps {
  children: React.ReactNode;
  onOpenSymbolSelector?: () => void;
  advancedConfig: AdvancedControlsConfig;
  onAdvancedConfigChange: (config: AdvancedControlsConfig) => void;
  isTradingOpen: boolean;
  onToggleTrading: () => void;
  symbol: string;
  marketType?: 'SPOT' | 'FUTURES';
  onMarketTypeChange?: (marketType: 'SPOT' | 'FUTURES') => void;
  timeframe: Timeframe;
  movingAverages: MovingAverageConfig[];
  onSymbolChange: (symbol: string) => void;
  onTimeframeChange: (timeframe: Timeframe) => void;
  onMovingAveragesChange: (mas: MovingAverageConfig[]) => void;
  onNavigateToSymbol?: (symbol: string, marketType?: 'SPOT' | 'FUTURES') => void;
}

const MIN_TRADING_WIDTH = 300;
const DEFAULT_TRADING_WIDTH = MIN_TRADING_WIDTH;

const MIN_MARKET_WIDTH = 300;
const DEFAULT_MARKET_WIDTH = MIN_MARKET_WIDTH;

const MAX_SIDEBAR_RATIO = 0.75;

export const MainLayout = ({
  children,
  onOpenSymbolSelector,
  advancedConfig,
  onAdvancedConfigChange,
  isTradingOpen,
  onToggleTrading,
  symbol,
  marketType,
  onMarketTypeChange,
  timeframe,
  movingAverages,
  onSymbolChange,
  onTimeframeChange,
  onMovingAveragesChange,
  onNavigateToSymbol,
}: MainLayoutProps) => {
  const [tradingWidth, setTradingWidth] = useUIPref('tradingSidebarWidth', DEFAULT_TRADING_WIDTH);
  const [marketWidth, setMarketWidth] = useUIPref('marketSidebarWidth', DEFAULT_MARKET_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const [isResizingMarket, setIsResizingMarket] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  const marketSidebarOpen = useUIStore(useShallow((state) => state.marketSidebarOpen));

  const globalActions = useMemo(() => ({
    openSettings: () => setIsSettingsOpen(true),
    openSymbolSelector: () => onOpenSymbolSelector?.(),
    navigateToSymbol: (symbol: string, marketType?: 'SPOT' | 'FUTURES') => onNavigateToSymbol?.(symbol, marketType),
  }), [onOpenSymbolSelector, onNavigateToSymbol]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    startXRef.current = e.clientX;
    startWidthRef.current = tradingWidth;
  }, [tradingWidth]);

  const handleMarketMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingMarket(true);
    startXRef.current = e.clientX;
    startWidthRef.current = marketWidth;
  }, [marketWidth]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const maxWidth = Math.floor(window.innerWidth * MAX_SIDEBAR_RATIO);
    if (isResizing) {
      const deltaX = startXRef.current - e.clientX;
      const newWidth = Math.min(Math.max(startWidthRef.current + deltaX, MIN_TRADING_WIDTH), maxWidth);
      setTradingWidth(newWidth);
    } else if (isResizingMarket) {
      const deltaX = e.clientX - startXRef.current;
      const newWidth = Math.min(Math.max(startWidthRef.current + deltaX, MIN_MARKET_WIDTH), maxWidth);
      setMarketWidth(newWidth);
    }
  }, [isResizing, isResizingMarket, setTradingWidth, setMarketWidth]);

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
    setIsResizingMarket(false);
  }, []);

  useEffect(() => {
    if (!isResizing && !isResizingMarket) return;

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, isResizingMarket, handleMouseMove, handleMouseUp]);

  return (
    <GlobalActionsProvider actions={globalActions}>
      <Box width="100vw" height="100vh" overflow="hidden">
        <Toolbar
          symbol={symbol}
          marketType={marketType}
          onMarketTypeChange={onMarketTypeChange}
          timeframe={timeframe}
          movingAverages={movingAverages}
          isTradingOpen={isTradingOpen}
          onSymbolChange={onSymbolChange}
          onTimeframeChange={onTimeframeChange}
          onToggleTrading={onToggleTrading}
        />
        <Flex
          position="relative"
          top={0}
          left={0}
          right={0}
          height="calc(100vh - 41px)"
          marginTop="41px"
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

          <Box
            flex={1}
            position="relative"
            overflow="hidden"
            width={
              marketSidebarOpen && isTradingOpen
                ? `calc(100% - ${marketWidth}px - ${tradingWidth}px)`
                : marketSidebarOpen
                  ? `calc(100% - ${marketWidth}px)`
                  : isTradingOpen
                    ? `calc(100% - ${tradingWidth}px)`
                    : '100%'
            }
            transition="width 0.2s ease"
          >
            <ChartToolsToolbar
              symbol={symbol}
              movingAverages={movingAverages}
              onMovingAveragesChange={onMovingAveragesChange}
            />
            {children}
          </Box>

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
              <TradingSidebar width={tradingWidth} />
            </>
          )}
        </Flex>

        <SettingsDialog
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          advancedConfig={advancedConfig}
          onAdvancedConfigChange={onAdvancedConfigChange}
        />
        <ScreenerModal onSymbolClick={onNavigateToSymbol} />
        <AnalyticsModal />
      </Box>
    </GlobalActionsProvider>
  );
};
