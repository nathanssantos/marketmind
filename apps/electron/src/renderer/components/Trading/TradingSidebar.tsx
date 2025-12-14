import { Box, Stack, Tabs, Text } from '@chakra-ui/react';
import { useTranslation } from 'react-i18next';
import { useBackendWallet } from '../../hooks/useBackendWallet';
import { type TradingSidebarTab, useUIStore } from '../../store/uiStore';
import { SidebarContainer } from '../ui/Sidebar';
import { OrdersList } from './OrdersList';
import { OrderTicket } from './OrderTicket';
import { PerformancePanel } from './PerformancePanel';
import { Portfolio } from './Portfolio';
import { RiskDisplay } from './RiskDisplay';
import { SetupStatsTable } from './SetupStatsTable';
import { WalletManager } from './WalletManager';

interface TradingSidebarProps {
  width: number;
}

export const TradingSidebar = ({ width }: TradingSidebarProps) => {
  const { t } = useTranslation();
  const { wallets: backendWallets } = useBackendWallet();
  const activeWalletId = backendWallets[0]?.id;

  const tradingSidebarTab = useUIStore((s) => s.tradingSidebarTab);
  const setTradingSidebarTab = useUIStore((s) => s.setTradingSidebarTab);

  const handleTabChange = (details: { value: string }) => {
    setTradingSidebarTab(details.value as TradingSidebarTab);
  };

  return (
    <SidebarContainer width={width}>
      <Tabs.Root value={tradingSidebarTab} onValueChange={handleTabChange} fitted>
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
          <Tabs.Trigger value="wallets">
            <Text fontSize="xs">{t('trading.tabs.wallets')}</Text>
          </Tabs.Trigger>
          {activeWalletId && (
            <Tabs.Trigger value="analytics">
              <Text fontSize="xs">{t('trading.tabs.analytics')}</Text>
            </Tabs.Trigger>
          )}
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

          <Tabs.Content value="wallets">
            <WalletManager />
          </Tabs.Content>

          {activeWalletId && (
            <Tabs.Content value="analytics">
              <Stack gap={4} p={4}>
                <RiskDisplay walletId={activeWalletId} />
                <PerformancePanel walletId={activeWalletId} />
                <SetupStatsTable walletId={activeWalletId} />
              </Stack>
            </Tabs.Content>
          )}
        </Box>
      </Tabs.Root>
    </SidebarContainer>
  );
};
