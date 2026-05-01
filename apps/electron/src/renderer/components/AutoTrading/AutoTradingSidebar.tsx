import { Box } from '@chakra-ui/react';
import { memo, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuX } from 'react-icons/lu';
import { type AutoTradingSidebarTab, useUIStore } from '../../store/uiStore';
import { useShallow } from 'zustand/react/shallow';
import { useChartContext } from '../../context/ChartContext';
import { Callout, IconButton, SidebarContainer, SidebarTabsHeader, Tabs } from '../ui';
import { WatchersTab } from '../MarketSidebar/tabs/WatchersTab';
import { LogsTab } from '../MarketSidebar/tabs/LogsTab';
import { ScalpingDashboard } from '../Trading/ScalpingDashboard';
import { ScalpingConfigDialog } from '../Trading/ScalpingConfig';

interface AutoTradingSidebarProps {
  width: number;
  onClose?: () => void;
}

const AutoTradingSidebarComponent = ({ width, onClose }: AutoTradingSidebarProps) => {
  const { t } = useTranslation();
  const { chartData } = useChartContext();
  const currentSymbol = chartData?.symbol ?? 'BTCUSDT';
  const [scalpingConfigOpen, setScalpingConfigOpen] = useState(false);

  const { autoTradingSidebarTab, setAutoTradingSidebarTab, activeWalletId } = useUIStore(useShallow((s) => ({
    autoTradingSidebarTab: s.autoTradingSidebarTab,
    setAutoTradingSidebarTab: s.setAutoTradingSidebarTab,
    activeWalletId: s.activeWalletId,
  })));

  const handleTabChange = useCallback((details: { value: string }) => {
    setAutoTradingSidebarTab(details.value as AutoTradingSidebarTab);
  }, [setAutoTradingSidebarTab]);

  return (
    <SidebarContainer width={width}>
      <Tabs.Root value={autoTradingSidebarTab} onValueChange={handleTabChange} fitted h="full" display="flex" flexDirection="column">
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
            <Tabs.Trigger value="watchers">{t('marketSidebar.tabs.watchers')}</Tabs.Trigger>
            <Tabs.Trigger value="scalping">{t('scalping.dashboard.title')}</Tabs.Trigger>
            <Tabs.Trigger value="logs">{t('marketSidebar.tabs.logs')}</Tabs.Trigger>
          </Tabs.List>
        </SidebarTabsHeader>

        <Box flex={1} minH={0} display="flex" flexDirection="column" overflow="hidden">
          <Tabs.Content value="watchers" overflowY="auto">
            <WatchersTab />
          </Tabs.Content>

          <Tabs.Content value="scalping" overflowY="auto">
            {activeWalletId ? (
              <ScalpingDashboard
                walletId={activeWalletId}
                symbol={currentSymbol}
                onConfigClick={() => setScalpingConfigOpen(true)}
              />
            ) : (
              <Box p={3}>
                <Callout tone="warning" compact>
                  {t('trading.wallets.selectWallet')}
                </Callout>
              </Box>
            )}
          </Tabs.Content>

          <Tabs.Content value="logs" flex={1} display="flex" flexDirection="column" minH={0}>
            <LogsTab />
          </Tabs.Content>
        </Box>
      </Tabs.Root>

      {activeWalletId && (
        <ScalpingConfigDialog
          walletId={activeWalletId}
          isOpen={scalpingConfigOpen}
          onClose={() => setScalpingConfigOpen(false)}
        />
      )}
    </SidebarContainer>
  );
};

export const AutoTradingSidebar = memo(AutoTradingSidebarComponent);
