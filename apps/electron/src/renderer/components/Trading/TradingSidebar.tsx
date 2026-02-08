import { Box, Tabs, Text } from '@chakra-ui/react';
import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { type TradingSidebarTab, useUIStore } from '../../store/uiStore';
import { useShallow } from 'zustand/react/shallow';
import { SidebarContainer } from '../ui/Sidebar';
import { OrdersList } from './OrdersList';
import { OrderTicket } from './OrderTicket';
import { Portfolio } from './Portfolio';

interface TradingSidebarProps {
  width: number;
}

const TradingSidebarComponent = ({ width }: TradingSidebarProps) => {
  const { t } = useTranslation();

  const { tradingSidebarTab, setTradingSidebarTab } = useUIStore(useShallow((s) => ({
    tradingSidebarTab: s.tradingSidebarTab,
    setTradingSidebarTab: s.setTradingSidebarTab,
  })));

  const handleTabChange = useCallback((details: { value: string }) => {
    setTradingSidebarTab(details.value as TradingSidebarTab);
  }, [setTradingSidebarTab]);

  return (
    <SidebarContainer width={width}>
      <Tabs.Root value={tradingSidebarTab} onValueChange={handleTabChange} fitted h="full" display="flex" flexDirection="column">
        <Tabs.List>
          <Tabs.Trigger value="ticket">
            <Text fontSize="xs">{t('trading.tabs.ticket')}</Text>
          </Tabs.Trigger>
          <Tabs.Trigger value="orders">
            <Text fontSize="xs">{t('trading.tabs.orders')}</Text>
          </Tabs.Trigger>
          <Tabs.Trigger value="portfolio">
            <Text fontSize="xs">{t('trading.tabs.portfolio')}</Text>
          </Tabs.Trigger>
        </Tabs.List>

        <Box flex={1} overflowY="auto">
          <Tabs.Content value="ticket">
            <OrderTicket />
          </Tabs.Content>

          <Tabs.Content value="orders">
            <OrdersList />
          </Tabs.Content>

          <Tabs.Content value="portfolio">
            <Portfolio />
          </Tabs.Content>
        </Box>
      </Tabs.Root>
    </SidebarContainer>
  );
};

export const TradingSidebar = memo(TradingSidebarComponent);
