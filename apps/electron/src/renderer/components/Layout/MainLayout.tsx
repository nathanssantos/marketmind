import { GlobalActionsProvider } from '@/renderer/context/GlobalActionsContext';
import { useLocalStorage } from '@/renderer/hooks/useLocalStorage';
import { Box, Flex } from '@chakra-ui/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AdvancedControlsConfig } from '../Chart/AdvancedControls';
import type { Timeframe } from '../Chart/TimeframeSelector';
import type { MovingAverageConfig } from '../Chart/useMovingAverageRenderer';
import { KeyboardShortcutsDialog } from '../KeyboardShortcuts/KeyboardShortcutsDialog';
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
  chartType: 'kline' | 'line';
  showVolume: boolean;
  showGrid: boolean;
  showCurrentPriceLine: boolean;
  showCrosshair: boolean;
  showProfitLossAreas: boolean;
  showFibonacciProjection: boolean;
  showMeasurementRuler: boolean;
  showMeasurementArea: boolean;
  showTooltip: boolean;
  showStochastic: boolean;
  showRSI: boolean;
  showBollingerBands: boolean;
  showATR: boolean;
  showVWAP: boolean;
  showEventRow: boolean;
  movingAverages: MovingAverageConfig[];
  isBacktestOpen: boolean;
  onSymbolChange: (symbol: string) => void;
  onTimeframeChange: (timeframe: Timeframe) => void;
  onChartTypeChange: (type: 'kline' | 'line') => void;
  onShowVolumeChange: (show: boolean) => void;
  onShowGridChange: (show: boolean) => void;
  onShowCurrentPriceLineChange: (show: boolean) => void;
  onShowCrosshairChange: (show: boolean) => void;
  onShowProfitLossAreasChange: (show: boolean) => void;
  onShowFibonacciProjectionChange: (show: boolean) => void;
  onShowMeasurementRulerChange: (show: boolean) => void;
  onShowMeasurementAreaChange: (show: boolean) => void;
  onShowTooltipChange: (show: boolean) => void;
  onShowStochasticChange: (show: boolean) => void;
  onShowRSIChange: (show: boolean) => void;
  onShowBollingerBandsChange: (show: boolean) => void;
  onShowATRChange: (show: boolean) => void;
  onShowVWAPChange: (show: boolean) => void;
  onShowEventRowChange: (show: boolean) => void;
  onMovingAveragesChange: (mas: MovingAverageConfig[]) => void;
  onToggleBacktest: () => void;
  onNavigateToSymbol?: (symbol: string, marketType?: 'SPOT' | 'FUTURES') => void;
}

const MIN_TRADING_WIDTH = 300;
const MAX_TRADING_WIDTH = 600;
const DEFAULT_TRADING_WIDTH = 400;

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
  chartType,
  showVolume,
  showGrid,
  showCurrentPriceLine,
  showCrosshair,
  showProfitLossAreas,
  showFibonacciProjection,
  showMeasurementRuler,
  showMeasurementArea,
  showTooltip,
  showStochastic,
  showRSI,
  showBollingerBands,
  showATR,
  showVWAP,
  showEventRow,
  movingAverages,
  isBacktestOpen,
  onSymbolChange,
  onTimeframeChange,
  onChartTypeChange,
  onShowVolumeChange,
  onShowGridChange,
  onShowCurrentPriceLineChange,
  onShowCrosshairChange,
  onShowProfitLossAreasChange,
  onShowFibonacciProjectionChange,
  onShowMeasurementRulerChange,
  onShowMeasurementAreaChange,
  onShowTooltipChange,
  onShowStochasticChange,
  onShowRSIChange,
  onShowBollingerBandsChange,
  onShowATRChange,
  onShowVWAPChange,
  onShowEventRowChange,
  onMovingAveragesChange,
  onToggleBacktest,
  onNavigateToSymbol,
}: MainLayoutProps) => {
  const [tradingWidth, setTradingWidth] = useLocalStorage('trading-sidebar-width', DEFAULT_TRADING_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  const globalActions = useMemo(() => ({
    openSettings: () => setIsSettingsOpen(true),
    showKeyboardShortcuts: () => setShowKeyboardShortcuts(true),
    openSymbolSelector: () => onOpenSymbolSelector?.(),
    navigateToSymbol: (symbol: string, marketType?: 'SPOT' | 'FUTURES') => onNavigateToSymbol?.(symbol, marketType),
  }), [onOpenSymbolSelector, onNavigateToSymbol]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    startXRef.current = e.clientX;
    startWidthRef.current = tradingWidth;
  }, [tradingWidth]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return;

    const deltaX = startXRef.current - e.clientX;
    const newWidth = Math.min(Math.max(startWidthRef.current + deltaX, MIN_TRADING_WIDTH), MAX_TRADING_WIDTH);
    setTradingWidth(newWidth);
  }, [isResizing, setTradingWidth]);

  const handleMouseUp = useCallback(() => {
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
          movingAverages={movingAverages}
          isTradingOpen={isTradingOpen}
          isBacktestOpen={isBacktestOpen}
          onSymbolChange={onSymbolChange}
          onTimeframeChange={onTimeframeChange}
          onToggleTrading={onToggleTrading}
          onToggleBacktest={onToggleBacktest}
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
          <Box
            flex={1}
            position="relative"
            overflow="hidden"
            width={isTradingOpen ? `calc(100% - ${tradingWidth}px)` : '100%'}
            transition="width 0.2s ease"
          >
            <ChartToolsToolbar
              chartType={chartType}
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
              onChartTypeChange={onChartTypeChange}
              onShowGridChange={onShowGridChange}
              onShowCurrentPriceLineChange={onShowCurrentPriceLineChange}
              onShowCrosshairChange={onShowCrosshairChange}
              onShowProfitLossAreasChange={onShowProfitLossAreasChange}
              onShowFibonacciProjectionChange={onShowFibonacciProjectionChange}
              onShowMeasurementRulerChange={onShowMeasurementRulerChange}
              onShowMeasurementAreaChange={onShowMeasurementAreaChange}
              onShowTooltipChange={onShowTooltipChange}
              onShowVolumeChange={onShowVolumeChange}
              onShowStochasticChange={onShowStochasticChange}
              onShowRSIChange={onShowRSIChange}
              onShowBollingerBandsChange={onShowBollingerBandsChange}
              onShowATRChange={onShowATRChange}
              onShowVWAPChange={onShowVWAPChange}
              onShowEventRowChange={onShowEventRowChange}
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
        <KeyboardShortcutsDialog isOpen={showKeyboardShortcuts} onClose={() => setShowKeyboardShortcuts(false)} />
      </Box>
    </GlobalActionsProvider>
  );
};
