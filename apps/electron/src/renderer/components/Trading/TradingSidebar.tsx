import { Box, Flex, Text } from '@chakra-ui/react';
import { memo, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { LuX } from 'react-icons/lu';
import { type TradingSidebarTab, useUIStore } from '../../store/uiStore';
import { useShallow } from 'zustand/react/shallow';
import { IconButton, SidebarContainer, Tabs } from '../ui';
import { QuickTradeActions, type QuickTradeMode } from '../Layout/QuickTradeToolbar';
import { OrdersList } from './OrdersList';
import { OrdersDialog } from './OrdersDialog';
import { Portfolio } from './Portfolio';

interface TradingSidebarProps {
  width: number;
  onClose?: () => void;
  symbol?: string;
  marketType?: 'SPOT' | 'FUTURES';
  quickTradeMode?: QuickTradeMode;
  onQuickTradeModeChange?: (mode: QuickTradeMode) => void;
}

const TradingSidebarComponent = ({ width, onClose, symbol, marketType, quickTradeMode, onQuickTradeModeChange }: TradingSidebarProps) => {
  const { t } = useTranslation();

  const { tradingSidebarTab, setTradingSidebarTab } = useUIStore(useShallow((s) => ({
    tradingSidebarTab: s.tradingSidebarTab,
    setTradingSidebarTab: s.setTradingSidebarTab,
  })));

  const handleTabChange = useCallback((details: { value: string }) => {
    setTradingSidebarTab(details.value as TradingSidebarTab);
  }, [setTradingSidebarTab]);

  const quickTradeHeader = useMemo(() => {
    if (!symbol || quickTradeMode !== 'sidebar' || !onQuickTradeModeChange) return undefined;
    return (
      <QuickTradeActions
        symbol={symbol}
        marketType={marketType}
        onMenuAction={onQuickTradeModeChange}
        currentMode={quickTradeMode}
      />
    );
  }, [symbol, marketType, quickTradeMode, onQuickTradeModeChange]);

  return (
    <SidebarContainer width={width}>
      <OrdersDialog />
      <Tabs.Root value={tradingSidebarTab} onValueChange={handleTabChange} fitted h="full" display="flex" flexDirection="column">
        <Flex>
          {onClose && (
            <IconButton size="2xs" variant="ghost" color="fg.muted" aria-label="Close" onClick={onClose} ml={1} mt={0.5}>
              <LuX />
            </IconButton>
          )}
          <Tabs.List flex={1}>
          <Tabs.Trigger value="orders">
            <Text fontSize="xs">{t('trading.tabs.orders')}</Text>
          </Tabs.Trigger>
          <Tabs.Trigger value="portfolio">
            <Text fontSize="xs">{t('trading.tabs.portfolio')}</Text>
          </Tabs.Trigger>
          </Tabs.List>
        </Flex>

        <Box flex={1} overflowY="auto">
          <Tabs.Content value="orders">
            <OrdersList />
          </Tabs.Content>

          <Tabs.Content value="portfolio">
            <Portfolio headerContent={quickTradeHeader} />
          </Tabs.Content>
        </Box>
      </Tabs.Root>
    </SidebarContainer>
  );
};

export const TradingSidebar = memo(TradingSidebarComponent);
