import type { MarketType } from '@marketmind/types';
import { Box } from '@chakra-ui/react';
import { memo, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { LuX } from 'react-icons/lu';
import { type TradingSidebarTab, useUIStore } from '../../store/uiStore';
import { useShallow } from 'zustand/react/shallow';
import { IconButton, SidebarContainer, SidebarTabsHeader, Tabs } from '../ui';
import { QuickTradeActions, type QuickTradeMode } from '../Layout/QuickTradeToolbar';
import { OrdersList } from './OrdersList';
import { OrdersDialog } from './OrdersDialog';
import { Portfolio } from './Portfolio';

interface TradingSidebarProps {
  width: number;
  onClose?: () => void;
  symbol?: string;
  marketType?: MarketType;
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
        <SidebarTabsHeader
          closeAction={
            onClose && (
              <IconButton size="2xs" variant="ghost" color="fg.muted" aria-label={t('common.close')} onClick={onClose}>
                <LuX />
              </IconButton>
            )
          }
        >
          <Tabs.List flex={1}>
            <Tabs.Trigger value="orders">{t('trading.tabs.orders')}</Tabs.Trigger>
            <Tabs.Trigger value="portfolio">{t('trading.tabs.portfolio')}</Tabs.Trigger>
          </Tabs.List>
        </SidebarTabsHeader>

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
