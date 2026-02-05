import { useGlobalActionsOptional } from '@/renderer/context/GlobalActionsContext';
import { Box, Flex, HStack, IconButton } from '@chakra-ui/react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  LuActivity,
  LuDollarSign,
  LuPlus,
  LuSettings,
} from 'react-icons/lu';
import { useShallow } from 'zustand/react/shallow';
import { useUIStore } from '../../store/uiStore';
import { useChartWindows } from '../../hooks/useChartWindows';
import { TimeframeSelector, type Timeframe } from '../Chart/TimeframeSelector';
import type { MovingAverageConfig } from '../Chart/useMovingAverageRenderer';
import { SymbolSelector } from '../SymbolSelector';
import { Logo } from '../ui/logo';
import { TooltipWrapper } from '../ui/Tooltip';
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
  onSymbolChange,
  onTimeframeChange,
  onToggleTrading,
}: ToolbarProps) => {
  const { t } = useTranslation();
  const globalActions = useGlobalActionsOptional();
  const { openChartWindow } = useChartWindows();

  const { marketSidebarOpen, toggleMarketSidebar } = useUIStore(
    useShallow((state) => ({
      marketSidebarOpen: state.marketSidebarOpen,
      toggleMarketSidebar: state.toggleMarketSidebar,
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
      height="41px"
      px={4}
      py={1}
      align="center"
      justifyContent="space-between"
      gap={4}
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
      <Flex align="center" gap={4} flex={1} overflowX="auto">
        <Box flexShrink={0}>
          <Logo size={24} />
        </Box>

        <Box w="1px" h="32px" bg="border" flexShrink={0} />

        <Box flexShrink={0}>
          <SymbolSelector
            value={symbol}
            marketType={marketType}
            onMarketTypeChange={onMarketTypeChange}
            onChange={onSymbolChange}
            showMarketTypeToggle
          />
        </Box>

        {showNewWindowButton && (
          <TooltipWrapper label={t('chart.controls.newWindow')} showArrow>
            <IconButton
              size="2xs"
              aria-label={t('chart.controls.newWindow')}
              onClick={handleOpenNewWindow}
              colorPalette="blue"
              variant="ghost"
            >
              <LuPlus />
            </IconButton>
          </TooltipWrapper>
        )}

        <Box w="1px" h="32px" bg="border" flexShrink={0} />

        <Box flexShrink={0}>
          <TimeframeSelector
            selectedTimeframe={timeframe}
            onTimeframeChange={onTimeframeChange}
          />
        </Box>

        <Box w="1px" h="32px" bg="border" flexShrink={0} />

        {showSidebarButtons && (
          <>
            <Box w="1px" h="32px" bg="border" flexShrink={0} />

            <HStack gap={1} flexShrink={0}>
              <TooltipWrapper label={t('marketSidebar.title')} showArrow>
                <IconButton
                  size="2xs"
                  aria-label={t('marketSidebar.title')}
                  onClick={toggleMarketSidebar}
                  colorPalette={marketSidebarOpen ? 'blue' : 'gray'}
                  variant={marketSidebarOpen ? 'solid' : 'ghost'}
                >
                  <LuActivity />
                </IconButton>
              </TooltipWrapper>
              <TooltipWrapper label={t('trading.sidebar.title')} showArrow>
                <IconButton
                  size="2xs"
                  aria-label={t('trading.sidebar.title')}
                  onClick={onToggleTrading}
                  colorPalette={isTradingOpen ? 'blue' : 'gray'}
                  variant={isTradingOpen ? 'solid' : 'ghost'}
                >
                  <LuDollarSign />
                </IconButton>
              </TooltipWrapper>
            </HStack>

            <Box w="1px" h="32px" bg="border" flexShrink={0} />

            <TooltipWrapper label={t('header.settings')} placement="bottom" showArrow>
              <IconButton
                aria-label={t('header.settings')}
                onClick={globalActions?.openSettings}
                variant="solid"
                colorPalette="blue"
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
