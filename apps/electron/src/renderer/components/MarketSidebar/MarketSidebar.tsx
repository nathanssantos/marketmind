import { Box, Tabs, Text } from '@chakra-ui/react';
import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { type MarketSidebarTab, useUIStore } from '../../store/uiStore';
import { SidebarContainer } from '../ui/Sidebar';
import { MarketIndicatorsTab } from './tabs/MarketIndicatorsTab';
import { WatchersTab } from './tabs/WatchersTab';
import { LogsTab } from './tabs/LogsTab';
import { ScannerTab } from './tabs/ScannerTab';

interface MarketSidebarProps {
  width: number;
}

const MarketSidebarComponent = ({ width }: MarketSidebarProps) => {
  const { t } = useTranslation();

  const { marketSidebarTab, setMarketSidebarTab, marketSidebarOpen } = useUIStore(
    useShallow((s) => ({
      marketSidebarTab: s.marketSidebarTab,
      setMarketSidebarTab: s.setMarketSidebarTab,
      marketSidebarOpen: s.marketSidebarOpen,
    }))
  );

  const handleTabChange = useCallback(
    (details: { value: string }) => {
      setMarketSidebarTab(details.value as MarketSidebarTab);
    },
    [setMarketSidebarTab]
  );

  if (!marketSidebarOpen) return null;

  return (
    <SidebarContainer width={width} position="left">
      <Tabs.Root
        value={marketSidebarTab}
        onValueChange={handleTabChange}
        fitted
        h="full"
        display="flex"
        flexDirection="column"
      >
        <Tabs.List>
          <Tabs.Trigger value="indicators">
            <Text fontSize="xs">{t('marketSidebar.tabs.indicators')}</Text>
          </Tabs.Trigger>
          <Tabs.Trigger value="watchers">
            <Text fontSize="xs">{t('marketSidebar.tabs.watchers')}</Text>
          </Tabs.Trigger>
          <Tabs.Trigger value="logs">
            <Text fontSize="xs">{t('marketSidebar.tabs.logs')}</Text>
          </Tabs.Trigger>
          <Tabs.Trigger value="scanner">
            <Text fontSize="xs">{t('marketSidebar.tabs.scanner')}</Text>
          </Tabs.Trigger>
        </Tabs.List>

        <Box flex={1} overflowY="auto">
          <Tabs.Content value="indicators">
            <MarketIndicatorsTab />
          </Tabs.Content>

          <Tabs.Content value="watchers">
            <WatchersTab />
          </Tabs.Content>

          <Tabs.Content value="logs">
            <LogsTab />
          </Tabs.Content>

          <Tabs.Content value="scanner">
            <ScannerTab />
          </Tabs.Content>
        </Box>
      </Tabs.Root>
    </SidebarContainer>
  );
};

export const MarketSidebar = memo(MarketSidebarComponent);
