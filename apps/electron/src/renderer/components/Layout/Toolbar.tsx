import { Box, Flex, HStack } from '@chakra-ui/react';
import { IconButton, Logo, TooltipWrapper } from '@renderer/components/ui';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  LuSettings,
  LuSquareArrowOutUpRight,
} from 'react-icons/lu';
import { useGlobalActionsOptional } from '../../context/GlobalActionsContext';
import { useChartWindows } from '../../hooks/useChartWindows';
import { TimeframeSelector, type Timeframe } from '../Chart/TimeframeSelector';
import { IndicatorTogglePopover } from './IndicatorTogglePopover';
import { LayersTogglePopover } from './LayersTogglePopover';
import { ToolsPopover } from './ToolsPopover';
import type { MarketType } from '@marketmind/types';
import { SymbolSelector } from '../SymbolSelector';
import { UserAvatar } from '../UserAvatar';
import { WalletSelector } from '../WalletSelector';

export interface ToolbarProps {
  symbol: string;
  marketType?: MarketType;
  onMarketTypeChange?: (marketType: MarketType) => void;
  timeframe: Timeframe;
  showNewWindowButton?: boolean;
  showSidebarButtons?: boolean;
  rightExtra?: React.ReactNode;
  onSymbolChange: (symbol: string, marketType?: MarketType) => void;
  onTimeframeChange: (timeframe: Timeframe) => void;
}

export const Toolbar = memo(({
  symbol,
  marketType,
  onMarketTypeChange,
  timeframe,
  showNewWindowButton = true,
  showSidebarButtons = true,
  rightExtra,
  onSymbolChange,
  onTimeframeChange,
}: ToolbarProps) => {
  const { t } = useTranslation();
  const { openChartWindow } = useChartWindows();
  const globalActions = useGlobalActionsOptional();

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

        <Box w="1px" h="22px" bg="border" flexShrink={0} />

        <TimeframeSelector
          selectedTimeframe={timeframe}
          onTimeframeChange={onTimeframeChange}
        />

        <IndicatorTogglePopover triggerVariant="labeled" popoverPlacement="bottom-start" />

        <LayersTogglePopover />

        {showSidebarButtons && <ToolsPopover />}

      </Flex>

      {showSidebarButtons && (
        <HStack gap={1} flexShrink={0}>
          {showNewWindowButton && (
            <TooltipWrapper label={t('chart.controls.newWindow')} showArrow>
              <IconButton
                size="2xs"
                aria-label={t('chart.controls.newWindow')}
                onClick={handleOpenNewWindow}
                variant="outline"
                color="fg.muted"
                data-testid="toolbar-detach-button"
              >
                <LuSquareArrowOutUpRight />
              </IconButton>
            </TooltipWrapper>
          )}
          <TooltipWrapper label={t('settings.title')} showArrow>
            <IconButton
              size="2xs"
              aria-label={t('settings.title')}
              onClick={() => globalActions?.openSettings()}
              variant="outline"
              color="fg.muted"
              data-testid="toolbar-settings-button"
            >
              <LuSettings />
            </IconButton>
          </TooltipWrapper>
          <WalletSelector />
          <UserAvatar />
        </HStack>
      )}

      {rightExtra && <Box flexShrink={0}>{rightExtra}</Box>}
    </Flex>
  );
});

Toolbar.displayName = 'Toolbar';
