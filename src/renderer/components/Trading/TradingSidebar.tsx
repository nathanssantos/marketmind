import { Box, IconButton, Tabs, Text } from '@chakra-ui/react';
import { useTranslation } from 'react-i18next';
import { LuPause, LuPlay } from 'react-icons/lu';
import { useTradingStore } from '../../store/tradingStore';
import { SidebarContainer, SidebarHeader } from '../ui/Sidebar';
import { TooltipWrapper } from '../ui/Tooltip';
import { OrdersList } from './OrdersList';
import { OrderTicket } from './OrderTicket';
import { Portfolio } from './Portfolio';
import { WalletManager } from './WalletManager';

interface TradingSidebarProps {
  width: number;
}

export const TradingSidebar = ({ width }: TradingSidebarProps) => {
  const { t } = useTranslation();
  const isSimulatorActive = useTradingStore((state) => state.isSimulatorActive);
  const toggleSimulator = useTradingStore((state) => state.toggleSimulator);

  return (
    <SidebarContainer width={width}>
      <SidebarHeader
        title={t('trading.sidebar.title')}
        actions={
          <TooltipWrapper label={t('trading.simulator.toggle')} showArrow>
            <IconButton
              size="2xs"
              aria-label={t('trading.simulator.toggle')}
              onClick={toggleSimulator}
              colorPalette={isSimulatorActive ? 'green' : 'gray'}
              variant={isSimulatorActive ? 'solid' : 'ghost'}
            >
              {isSimulatorActive ? <LuPause /> : <LuPlay />}
            </IconButton>
          </TooltipWrapper>
        }
      />

      <Tabs.Root defaultValue="wallets" fitted>
        <Tabs.List>
          <Tabs.Trigger value="wallets">
            <Text fontSize="xs">{t('trading.tabs.wallets')}</Text>
          </Tabs.Trigger>
          <Tabs.Trigger value="ticket">
            <Text fontSize="xs">{t('trading.tabs.ticket')}</Text>
          </Tabs.Trigger>
          <Tabs.Trigger value="portfolio">
            <Text fontSize="xs">{t('trading.tabs.portfolio')}</Text>
          </Tabs.Trigger>
          <Tabs.Trigger value="orders">
            <Text fontSize="xs">{t('trading.tabs.orders')}</Text>
          </Tabs.Trigger>
        </Tabs.List>

        <Box flex={1} overflowY="auto">
          <Tabs.Content value="wallets">
            <WalletManager />
          </Tabs.Content>

          <Tabs.Content value="ticket">
            <OrderTicket />
          </Tabs.Content>

          <Tabs.Content value="portfolio">
            <Portfolio />
          </Tabs.Content>

          <Tabs.Content value="orders">
            <OrdersList />
          </Tabs.Content>
        </Box>
      </Tabs.Root>
    </SidebarContainer>
  );
};
