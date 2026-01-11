import { useGlobalActionsOptional } from '@/renderer/context/GlobalActionsContext';
import { Box, Flex, HStack, IconButton } from '@chakra-ui/react';
import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  LuBot,
  LuDollarSign,
  LuHistory,
  LuPlus,
  LuSettings,
} from 'react-icons/lu';
import { useChartWindows } from '../../hooks/useChartWindows';
import { TimeframeSelector, type Timeframe } from '../Chart/TimeframeSelector';
import type { MovingAverageConfig } from '../Chart/useMovingAverageRenderer';
import { SymbolSelector } from '../SymbolSelector';
import { TradingProfilesModal } from '../Trading/TradingProfilesModal';
import { Logo } from '../ui/logo';
import { TooltipWrapper } from '../ui/Tooltip';

export interface ToolbarProps {
  symbol: string;
  marketType?: 'SPOT' | 'FUTURES';
  onMarketTypeChange?: (marketType: 'SPOT' | 'FUTURES') => void;
  timeframe: Timeframe;
  movingAverages: MovingAverageConfig[];
  isTradingOpen: boolean;
  isBacktestOpen: boolean;
  showNewWindowButton?: boolean;
  showSidebarButtons?: boolean;
  onSymbolChange: (symbol: string, marketType?: 'SPOT' | 'FUTURES') => void;
  onTimeframeChange: (timeframe: Timeframe) => void;
  onToggleTrading: () => void;
  onToggleBacktest: () => void;
}

export const Toolbar = memo(({
  symbol,
  marketType,
  onMarketTypeChange,
  timeframe,
  movingAverages,
  isTradingOpen,
  isBacktestOpen: _isBacktestOpen,
  showNewWindowButton = true,
  showSidebarButtons = true,
  onSymbolChange,
  onTimeframeChange,
  onToggleTrading,
  onToggleBacktest,
}: ToolbarProps) => {
  const { t } = useTranslation();
  const globalActions = useGlobalActionsOptional();
  const { openChartWindow } = useChartWindows();

  const [isTradingProfilesModalOpen, setIsTradingProfilesModalOpen] = useState(false);

  const handleOpenNewWindow = (): void => {
    void openChartWindow(symbol, timeframe);
  };

  const handleOpenTradingProfilesModal = (): void => {
    setIsTradingProfilesModalOpen(true);
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

        <Flex gap={3} align="center" flexShrink={0}>
          {movingAverages.length > 0 && showSidebarButtons && (
            <HStack gap={1}>
              <TooltipWrapper label="Backtest Strategy" showArrow placement="top">
                <IconButton
                  size="2xs"
                  aria-label="Backtest Strategy"
                  onClick={onToggleBacktest}
                  colorPalette="blue"
                  variant="solid"
                >
                  <LuHistory />
                </IconButton>
              </TooltipWrapper>
              <TooltipWrapper
                label={t('tradingProfiles.modalTitle')}
                showArrow
                placement="top"
              >
                <IconButton
                  size="2xs"
                  aria-label={t('tradingProfiles.modalTitle')}
                  onClick={handleOpenTradingProfilesModal}
                  colorPalette="blue"
                  variant="solid"
                >
                  <LuBot />
                </IconButton>
              </TooltipWrapper>
            </HStack>
          )}

          {showSidebarButtons && (
            <>
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
      </Flex>

      {showSidebarButtons && (
        <HStack gap={1} flexShrink={0}>
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
      )}

      <TradingProfilesModal
        isOpen={isTradingProfilesModalOpen}
        onClose={() => setIsTradingProfilesModalOpen(false)}
      />
    </Flex>
  );
});

Toolbar.displayName = 'Toolbar';
