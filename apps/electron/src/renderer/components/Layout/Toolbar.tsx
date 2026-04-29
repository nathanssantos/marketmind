import { Box, Flex, HStack, Portal, Text } from '@chakra-ui/react';
import { IconButton, Logo, Menu, ToggleIconButton, TooltipWrapper } from '@renderer/components/ui';
import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  LuActivity,
  LuBookOpen,
  LuBot,
  LuChartBar,
  LuDollarSign,
  LuPlus,
  LuSquareArrowOutUpRight,
  LuFlaskConical,
  LuScanLine,
  LuZoomIn,
  LuZoomOut,
} from 'react-icons/lu';
import { useLayoutStore } from '../../store/layoutStore';
import { useShallow } from 'zustand/react/shallow';
import { useBacktestModalStore } from '../../store/backtestModalStore';
import { useScreenerStore } from '../../store/screenerStore';
import { useUIStore } from '../../store/uiStore';
import { useChartWindows } from '../../hooks/useChartWindows';
import { useUIZoom } from '../../hooks/useUIZoom';
import { ZOOM_MIN, ZOOM_MAX } from '../../constants/defaults';
import { TimeframeSelector, type Timeframe } from '../Chart/TimeframeSelector';
import { IndicatorTogglePopover } from './IndicatorTogglePopover';
import type { MarketType } from '@marketmind/types';
import { SymbolSelector } from '../SymbolSelector';
import { UserAvatar } from '../UserAvatar';
import { WalletSelector } from '../WalletSelector';

const TIMEFRAME_OPTIONS = ['1m', '5m', '15m', '30m', '1h', '4h', '1d'] as const;

const ToolbarLayoutActions = memo(({ showNewWindowButton, onOpenNewWindow }: { showNewWindowButton: boolean; onOpenNewWindow: () => void }) => {
  const { t } = useTranslation();
  const activeLayout = useLayoutStore(s => s.getActiveLayout());
  const addPanel = useLayoutStore(s => s.addPanel);

  const handleAddPanel = useCallback((tf: string) => {
    if (activeLayout) addPanel(activeLayout.id, tf);
  }, [activeLayout, addPanel]);

  return (
    <HStack gap={1} flexShrink={0}>
      <Menu.Root>
        <Menu.Trigger asChild>
          <Box>
            <TooltipWrapper label={t('chart.controls.addChart', 'Add chart')} showArrow>
              <IconButton size="2xs" aria-label={t('chart.controls.addChart', 'Add chart')} variant="ghost" color="fg.muted">
                <LuPlus />
              </IconButton>
            </TooltipWrapper>
          </Box>
        </Menu.Trigger>
        <Portal>
          <Menu.Positioner>
            <Menu.Content>
              {TIMEFRAME_OPTIONS.map(tf => (
                <Menu.Item key={tf} value={tf} onClick={() => handleAddPanel(tf)}>{tf}</Menu.Item>
              ))}
            </Menu.Content>
          </Menu.Positioner>
        </Portal>
      </Menu.Root>
      {showNewWindowButton && (
        <TooltipWrapper label={t('chart.controls.newWindow')} showArrow>
          <IconButton size="2xs" aria-label={t('chart.controls.newWindow')} onClick={onOpenNewWindow} variant="ghost" color="fg.muted">
            <LuSquareArrowOutUpRight />
          </IconButton>
        </TooltipWrapper>
      )}
    </HStack>
  );
});

ToolbarLayoutActions.displayName = 'ToolbarLayoutActions';

export interface ToolbarProps {
  symbol: string;
  marketType?: MarketType;
  onMarketTypeChange?: (marketType: MarketType) => void;
  timeframe: Timeframe;
  isTradingOpen: boolean;
  isAutoTradingOpen: boolean;
  showNewWindowButton?: boolean;
  showSidebarButtons?: boolean;
  showZoomControls?: boolean;
  rightExtra?: React.ReactNode;
  onSymbolChange: (symbol: string, marketType?: MarketType) => void;
  onTimeframeChange: (timeframe: Timeframe) => void;
  onToggleTrading: () => void;
  onToggleAutoTrading: () => void;
}

export const Toolbar = memo(({
  symbol,
  marketType,
  onMarketTypeChange,
  timeframe,
  isTradingOpen,
  isAutoTradingOpen,
  showNewWindowButton = true,
  showSidebarButtons = true,
  showZoomControls = true,
  rightExtra,
  onSymbolChange,
  onTimeframeChange,
  onToggleTrading,
  onToggleAutoTrading,
}: ToolbarProps) => {
  const { t } = useTranslation();
  const { openChartWindow } = useChartWindows();
  const { zoomLevel, zoomIn, zoomOut } = useUIZoom();

  const { marketSidebarOpen, toggleMarketSidebar, orderFlowSidebarOpen, toggleOrderFlowSidebar, isAnalyticsOpen, toggleAnalytics } = useUIStore(
    useShallow((state) => ({
      marketSidebarOpen: state.marketSidebarOpen,
      toggleMarketSidebar: state.toggleMarketSidebar,
      orderFlowSidebarOpen: state.orderFlowSidebarOpen,
      toggleOrderFlowSidebar: state.toggleOrderFlowSidebar,
      isAnalyticsOpen: state.isAnalyticsOpen,
      toggleAnalytics: state.toggleAnalytics,
    }))
  );

  const { isScreenerOpen, toggleScreener } = useScreenerStore(
    useShallow((state) => ({
      isScreenerOpen: state.isScreenerOpen,
      toggleScreener: state.toggleScreener,
    }))
  );

  const { isBacktestOpen, toggleBacktest } = useBacktestModalStore(
    useShallow((state) => ({
      isBacktestOpen: state.isBacktestOpen,
      toggleBacktest: state.toggleBacktest,
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

        <Box w="1px" h="22px" bg="border" flexShrink={0} />

        <TimeframeSelector
          selectedTimeframe={timeframe}
          onTimeframeChange={onTimeframeChange}
        />

        <Box w="1px" h="22px" bg="border" flexShrink={0} />

        <IndicatorTogglePopover triggerVariant="labeled" popoverPlacement="bottom-start" />

        <Box w="1px" h="22px" bg="border" flexShrink={0} />

        <ToolbarLayoutActions
          showNewWindowButton={showNewWindowButton}
          onOpenNewWindow={handleOpenNewWindow}
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
            <TooltipWrapper label={t('orderFlow.title', 'Order Flow')} showArrow>
              <ToggleIconButton
                active={orderFlowSidebarOpen}
                size="2xs"
                aria-label={t('orderFlow.title', 'Order Flow')}
                onClick={toggleOrderFlowSidebar}
              >
                <LuBookOpen />
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
            <TooltipWrapper label={t('backtest.title')} showArrow>
              <ToggleIconButton
                active={isBacktestOpen}
                size="2xs"
                aria-label={t('backtest.title')}
                onClick={toggleBacktest}
              >
                <LuFlaskConical />
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
            <TooltipWrapper label={t('autoTrading.sidebar.title', 'Auto Trading')} showArrow>
              <ToggleIconButton
                active={isAutoTradingOpen}
                size="2xs"
                aria-label={t('autoTrading.sidebar.title', 'Auto Trading')}
                onClick={onToggleAutoTrading}
              >
                <LuBot />
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

      </Flex>

      {showSidebarButtons && (
        <HStack gap={1} flexShrink={0}>
          <WalletSelector />
          <UserAvatar />
        </HStack>
      )}

      {rightExtra && <Box flexShrink={0}>{rightExtra}</Box>}
    </Flex>
  );
});

Toolbar.displayName = 'Toolbar';
