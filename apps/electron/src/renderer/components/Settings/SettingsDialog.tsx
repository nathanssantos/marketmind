import { Box, Flex, Spinner, Stack, Text } from '@chakra-ui/react';
import { CloseButton, Dialog, Tabs } from '@renderer/components/ui';
import { useDialogMount } from '@renderer/hooks/useDialogMount';
import { MM } from '@marketmind/tokens';
import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AdvancedControlsConfig } from '../Chart/AdvancedControls';

// v1.3 D.2 — lazy-load every tab body so opening the Settings dialog
// only mounts the tab the user actually views (was: 13 tabs mounted on
// every open). Each tab is its own chunk after the next prod build.
const AccountTab = lazy(() => import('./AccountTab').then((m) => ({ default: m.AccountTab })));
const SecurityTab = lazy(() => import('./SecurityTab').then((m) => ({ default: m.SecurityTab })));
const NotificationsTab = lazy(() => import('./NotificationsTab').then((m) => ({ default: m.NotificationsTab })));
const GeneralTab = lazy(() => import('./GeneralTab').then((m) => ({ default: m.GeneralTab })));
const ChartSettingsTab = lazy(() => import('./ChartSettingsTab').then((m) => ({ default: m.ChartSettingsTab })));
const WalletManager = lazy(() => import('../Trading/WalletManager').then((m) => ({ default: m.WalletManager })));
const TradingProfilesTab = lazy(() => import('./TradingProfilesTab').then((m) => ({ default: m.TradingProfilesTab })));
const AutoTradingTab = lazy(() => import('./AutoTradingTab').then((m) => ({ default: m.AutoTradingTab })));
const IndicatorsTab = lazy(() => import('./IndicatorsTab').then((m) => ({ default: m.IndicatorsTab })));
const CustomSymbolsTab = lazy(() => import('../CustomSymbols').then((m) => ({ default: m.CustomSymbolsTab })));
const DataTab = lazy(() => import('./DataTab').then((m) => ({ default: m.DataTab })));
const UpdatesTab = lazy(() => import('./UpdatesTab').then((m) => ({ default: m.UpdatesTab })));
const AboutTab = lazy(() => import('./AboutTab').then((m) => ({ default: m.AboutTab })));
import {
  DEFAULT_SETTINGS_TAB,
  SETTINGS_GROUPS,
  SETTINGS_GROUP_LABEL_KEYS,
  SETTINGS_TAB_DEFS,
  type SettingsTab,
  isSettingsTab,
} from './constants';

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: SettingsTab;
  advancedConfig: AdvancedControlsConfig;
  onAdvancedConfigChange: (config: AdvancedControlsConfig) => void;
}

export const SettingsDialog = ({
  isOpen,
  onClose,
  initialTab,
  advancedConfig,
  onAdvancedConfigChange,
}: SettingsDialogProps) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab ?? DEFAULT_SETTINGS_TAB);
  useDialogMount('SettingsDialog', isOpen);

  useEffect(() => {
    if (isOpen && initialTab && isSettingsTab(initialTab)) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  const groupedTabs = useMemo(() => {
    return SETTINGS_GROUPS.map((group) => ({
      group,
      tabs: SETTINGS_TAB_DEFS.filter((d) => d.group === group),
    }));
  }, []);

  return (
    <Dialog.Root open={isOpen} onOpenChange={(e) => !e.open && onClose()} size="xl">
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content maxH="90vh" maxW="1100px" overflow="hidden">
          <CloseButton
            position="absolute"
            top={4}
            right={4}
            onClick={onClose}
            size="sm"
            zIndex={2}
          />
          <Dialog.Header borderBottom="1px solid" borderColor="border" pr={12}>
            <Dialog.Title>{t('settings.title')}</Dialog.Title>
          </Dialog.Header>

          <Dialog.Body p={0} overflow="hidden">
            <Tabs.Root
              value={activeTab}
              onValueChange={(e) => isSettingsTab(e.value) && setActiveTab(e.value)}
              orientation="vertical"
              variant="subtle"
            >
              <Flex h="calc(90vh - 64px)" maxH="calc(90vh - 64px)">
                <Box
                  w="220px"
                  flexShrink={0}
                  borderRight="1px solid"
                  borderColor="border"
                  bg="bg.subtle"
                  overflowY="auto"
                  py={3}
                  px={2}
                  data-testid="settings-rail"
                >
                  <Stack gap={4}>
                    {groupedTabs.map(({ group, tabs }) => (
                      <Box key={group}>
                        <Text
                          fontSize="2xs"
                          fontWeight="bold"
                          color="fg.muted"
                          textTransform="uppercase"
                          letterSpacing="wider"
                          px={3}
                          mb={1}
                        >
                          {t(SETTINGS_GROUP_LABEL_KEYS[group])}
                        </Text>
                        <Tabs.List border="none" gap={0.5} display="flex" flexDirection="column">
                          {tabs.map(({ id, icon: Icon, labelKey }) => (
                            <Tabs.Trigger
                              key={id}
                              value={id}
                              data-testid={`settings-tab-${id}`}
                              justifyContent="flex-start"
                              gap={2}
                              px={3}
                              py={1.5}
                              fontSize="sm"
                              fontWeight="normal"
                              borderRadius="md"
                              w="100%"
                              _selected={{
                                bg: 'bg.emphasized',
                                color: 'fg',
                                fontWeight: 'medium',
                              }}
                            >
                              <Icon />
                              <Text>{t(labelKey)}</Text>
                            </Tabs.Trigger>
                          ))}
                        </Tabs.List>
                      </Box>
                    ))}
                  </Stack>
                </Box>

                <Box flex={1} overflowY="auto" px={5} pt={4} pb={8} data-testid="settings-content">
                  <Suspense fallback={
                    <Flex justify="center" align="center" py={MM.spinner.panel.py}>
                      <Spinner size={MM.spinner.panel.size} />
                    </Flex>
                  }>
                    {/* Tabs.Content wrappers stay so aria-controls on the
                        triggers still resolves to a panel id; lazy-loaded
                        bodies render only when active to skip mount cost. */}
                    <Tabs.Content value="account" pt={0} w="100%">
                      {activeTab === 'account' && <AccountTab />}
                    </Tabs.Content>
                    <Tabs.Content value="security" pt={0} w="100%">
                      {activeTab === 'security' && <SecurityTab />}
                    </Tabs.Content>
                    <Tabs.Content value="notifications" pt={0} w="100%">
                      {activeTab === 'notifications' && <NotificationsTab />}
                    </Tabs.Content>
                    <Tabs.Content value="general" pt={0} w="100%">
                      {activeTab === 'general' && <GeneralTab />}
                    </Tabs.Content>
                    <Tabs.Content value="chart" pt={0} w="100%">
                      {activeTab === 'chart' && (
                        <ChartSettingsTab
                          config={advancedConfig}
                          onConfigChange={onAdvancedConfigChange}
                        />
                      )}
                    </Tabs.Content>
                    <Tabs.Content value="wallets" pt={0} w="100%">
                      {activeTab === 'wallets' && <WalletManager />}
                    </Tabs.Content>
                    <Tabs.Content value="tradingProfiles" pt={0} w="100%">
                      {activeTab === 'tradingProfiles' && <TradingProfilesTab />}
                    </Tabs.Content>
                    <Tabs.Content value="autoTrading" pt={0} w="100%">
                      {activeTab === 'autoTrading' && <AutoTradingTab />}
                    </Tabs.Content>
                    <Tabs.Content value="indicators" pt={0} w="100%">
                      {activeTab === 'indicators' && <IndicatorsTab />}
                    </Tabs.Content>
                    <Tabs.Content value="customSymbols" pt={0} w="100%">
                      {activeTab === 'customSymbols' && <CustomSymbolsTab />}
                    </Tabs.Content>
                    <Tabs.Content value="data" pt={0} w="100%">
                      {activeTab === 'data' && <DataTab />}
                    </Tabs.Content>
                    <Tabs.Content value="updates" pt={0} w="100%">
                      {activeTab === 'updates' && <UpdatesTab />}
                    </Tabs.Content>
                    <Tabs.Content value="about" pt={0} w="100%">
                      {activeTab === 'about' && <AboutTab />}
                    </Tabs.Content>
                  </Suspense>
                </Box>
              </Flex>
            </Tabs.Root>
          </Dialog.Body>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
};
