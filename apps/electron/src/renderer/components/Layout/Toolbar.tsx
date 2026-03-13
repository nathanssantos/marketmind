import { useGlobalActionsOptional } from '@/renderer/context/GlobalActionsContext';
import { Box, Flex, HStack, Text } from '@chakra-ui/react';
import { IconButton, Logo, ToggleIconButton, TooltipWrapper } from '@renderer/components/ui';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  LuActivity,
  LuChartBar,
  LuDollarSign,
  LuLayers,
  LuSquareArrowOutUpRight,
  LuScanLine,
  LuSettings,
  LuZoomIn,
  LuZoomOut,
} from 'react-icons/lu';
import { useShallow } from 'zustand/react/shallow';
import { useScreenerStore } from '../../store/screenerStore';
import { useUIStore } from '../../store/uiStore';
import { useChartWindows } from '../../hooks/useChartWindows';
import { useUIZoom } from '../../hooks/useUIZoom';
import { ZOOM_MIN, ZOOM_MAX } from '../../constants/defaults';
import { TimeframeSelector, type Timeframe } from '../Chart/TimeframeSelector';
import type { MovingAverageConfig } from '../Chart/useMovingAverageRenderer';
import { SymbolSelector } from '../SymbolSelector';
import { WalletSelector } from '../WalletSelector';

export interface ToolbarProps {
  symbol: string;
  marketType?: 'SPOT' | 'FUTURES';
  onMarketTypeChange?: (marketType: 'SPOT' | 'FUTURES') => void;
  timeframe: Timeframe;
  movingAverages: MovingAverageConfig[];
  isTradingOpen: boolean;
  showNewWindowButton?: boolean;
  showSidebarButtons?: boolean;
  showZoomControls?: boolean;
  onSymbolChange: (symbol: string, marketType?: 'SPOT' | 'FUTURES') => void;
  onTimeframeChange: (timeframe: Timeframe) => void;
  onToggleTrading: () => void;
}

export const Toolbar = memo(({
  symbol,
  marketType,
  onMarketTypeChange,
  timeframe,
  movingAverages: _movingAverages,
  isTradingOpen,
  showNewWindowButton = true,
  showSidebarButtons = true,
  showZoomControls = true,
  onSymbolChange,
  onTimeframeChange,
  onToggleTrading,
}: ToolbarProps) => {
  const { t } = useTranslation();
  const globalActions = useGlobalActionsOptional();
  const { openChartWindow } = useChartWindows();
  const { zoomLevel, zoomIn, zoomOut } = useUIZoom();

  const { marketSidebarOpen, toggleMarketSidebar, isAnalyticsOpen, toggleAnalytics, isCustomSymbolsOpen, toggleCustomSymbols } = useUIStore(
    useShallow((state) => ({
      marketSidebarOpen: state.marketSidebarOpen,
      toggleMarketSidebar: state.toggleMarketSidebar,
      isAnalyticsOpen: state.isAnalyticsOpen,
      toggleAnalytics: state.toggleAnalytics,
      isCustomSymbolsOpen: state.isCustomSymbolsOpen,
      toggleCustomSymbols: state.toggleCustomSymbols,
    }))
  );

  const { isScreenerOpen, toggleScreener } = useScreenerStore(
    useShallow((state) => ({
      isScreenerOpen: state.isScreenerOpen,
      toggleScreener: state.toggleScreener,
    }))
  );

  const handleOpenNewWindow = (): void => {
    void openChartWindow(symbol, timeframe);
  };

  return (
    <Flex
      position="fixed"
      top={0}
      left={0}
      right={0}
      height="30px"
      pl={0}
      pr={2}
      py={0}
      align="center"
      justifyContent="space-between"
      gap={2}
      bg="bg.panel"
      borderBottom="1px solid"
      borderColor="border"
      zIndex={99}
      overflowX="auto"
      overflowY="hidden"
      css={{
        '&::-webkit-scrollbar': {
          height: '4px',
        },
        '&::-webkit-scrollbar-track': {
          background: 'transparent',
        },
        '&::-webkit-scrollbar-thumb': {
          background: 'var(--chakra-colors-border)',
          borderRadius: '2px',
        },
      }}
    >
      <Flex align="center" gap={2} flex={1} overflowX="auto">
        <Flex flexShrink={0} align="center" gap={0}>
          <Flex w="28px" align="center" justify="center">
            <Logo size={18} />
          </Flex>
          <Box w="1px" h="22px" bg="border" flexShrink={0} />
        </Flex>

        <SymbolSelector
          value={symbol}
          marketType={marketType}
          onMarketTypeChange={onMarketTypeChange}
          onChange={onSymbolChange}
          showMarketTypeToggle
        />

        {showNewWindowButton && (
          <TooltipWrapper label={t('chart.controls.newWindow')} showArrow>
            <IconButton
              size="2xs"
              aria-label={t('chart.controls.newWindow')}
              onClick={handleOpenNewWindow}
              variant="outline"
              color="fg.muted"
            >
              <LuSquareArrowOutUpRight />
            </IconButton>
          </TooltipWrapper>
        )}

        <Box w="1px" h="22px" bg="border" flexShrink={0} />

        <TimeframeSelector
          selectedTimeframe={timeframe}
          onTimeframeChange={onTimeframeChange}
        />

        <Box w="1px" h="22px" bg="border" flexShrink={0} />

        {showSidebarButtons && (
          <HStack gap={1} flexShrink={0}>
            <TooltipWrapper label={t('marketSidebar.title')} showArrow>
              <ToggleIconButton
                active={marketSidebarOpen}
                size="2xs"
                aria-label={t('marketSidebar.title')}
                onClick={toggleMarketSidebar}
              >
                <LuActivity />
              </ToggleIconButton>
            </TooltipWrapper>
            <TooltipWrapper label={t('screener.title')} showArrow>
              <ToggleIconButton
                active={isScreenerOpen}
                size="2xs"
                aria-label={t('screener.title')}
                onClick={toggleScreener}
              >
                <LuScanLine />
              </ToggleIconButton>
            </TooltipWrapper>
            <TooltipWrapper label={t('trading.tabs.analytics')} showArrow>
              <ToggleIconButton
                active={isAnalyticsOpen}
                size="2xs"
                aria-label={t('trading.tabs.analytics')}
                onClick={toggleAnalytics}
              >
                <LuChartBar />
              </ToggleIconButton>
            </TooltipWrapper>
            <TooltipWrapper label={t('customSymbols.title')} showArrow>
              <ToggleIconButton
                active={isCustomSymbolsOpen}
                size="2xs"
                aria-label={t('customSymbols.title')}
                onClick={toggleCustomSymbols}
              >
                <LuLayers />
              </ToggleIconButton>
            </TooltipWrapper>
            <TooltipWrapper label={t('trading.sidebar.title')} showArrow>
              <ToggleIconButton
                active={isTradingOpen}
                size="2xs"
                aria-label={t('trading.sidebar.title')}
                onClick={onToggleTrading}
              >
                <LuDollarSign />
              </ToggleIconButton>
            </TooltipWrapper>
          </HStack>
        )}

        {showZoomControls && (
          <>
            {showSidebarButtons && <Box w="1px" h="22px" bg="border" flexShrink={0} />}
            <HStack gap={1} flexShrink={0}>
              <TooltipWrapper label={t('header.zoomOut')} showArrow>
                <IconButton
                  size="2xs"
                  aria-label={t('header.zoomOut')}
                  onClick={zoomOut}
                  variant="outline"
                  color="fg.muted"
                  disabled={zoomLevel <= ZOOM_MIN}
                >
                  <LuZoomOut />
                </IconButton>
              </TooltipWrapper>
              <Text fontSize="xs" color="fg.muted" minW="36px" textAlign="center" userSelect="none">
                {zoomLevel}%
              </Text>
              <TooltipWrapper label={t('header.zoomIn')} showArrow>
                <IconButton
                  size="2xs"
                  aria-label={t('header.zoomIn')}
                  onClick={zoomIn}
                  variant="outline"
                  color="fg.muted"
                  disabled={zoomLevel >= ZOOM_MAX}
                >
                  <LuZoomIn />
                </IconButton>
              </TooltipWrapper>
            </HStack>
          </>
        )}

        {showSidebarButtons && (
          <>
            <Box w="1px" h="22px" bg="border" flexShrink={0} />
            <TooltipWrapper label={t('header.settings')} placement="bottom" showArrow>
              <IconButton
                aria-label={t('header.settings')}
                onClick={globalActions?.openSettings}
                variant="outline"
                color="fg.muted"
                size="2xs"
              >
                <LuSettings />
              </IconButton>
            </TooltipWrapper>
          </>
        )}
      </Flex>

      {showSidebarButtons && (
        <Box flexShrink={0}>
          <WalletSelector />
        </Box>
      )}

    </Flex>
  );
});

Toolbar.displayName = 'Toolbar';
