import { Box, Flex, Stack, Text } from '@chakra-ui/react';
import { CloseButton, Dialog, Tabs } from '@renderer/components/ui';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AdvancedControlsConfig } from '../Chart/AdvancedControls';
import { CustomSymbolsTab } from '../CustomSymbols';
import { WalletManager } from '../Trading/WalletManager';
import { AboutTab } from './AboutTab';
import { AccountTab } from './AccountTab';
import { AutoTradingTab } from './AutoTradingTab';
import { ChartSettingsTab } from './ChartSettingsTab';
import { DataTab } from './DataTab';
import { GeneralTab } from './GeneralTab';
import { IndicatorsTab } from './IndicatorsTab';
import { NotificationsTab } from './NotificationsTab';
import { SecurityTab } from './SecurityTab';
import { TradingProfilesTab } from './TradingProfilesTab';
import { UpdatesTab } from './UpdatesTab';
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

                <Box flex={1} overflowY="auto" p={4} data-testid="settings-content">
                  <Tabs.Content value="account" pt={0}>
                    <AccountTab />
                  </Tabs.Content>
                  <Tabs.Content value="security" pt={0}>
                    <SecurityTab />
                  </Tabs.Content>
                  <Tabs.Content value="notifications" pt={0}>
                    <NotificationsTab />
                  </Tabs.Content>
                  <Tabs.Content value="general" pt={0}>
                    <GeneralTab />
                  </Tabs.Content>
                  <Tabs.Content value="chart" pt={0}>
                    <ChartSettingsTab
                      config={advancedConfig}
                      onConfigChange={onAdvancedConfigChange}
                    />
                  </Tabs.Content>
                  <Tabs.Content value="wallets" pt={0}>
                    <WalletManager />
                  </Tabs.Content>
                  <Tabs.Content value="tradingProfiles" pt={0}>
                    <TradingProfilesTab />
                  </Tabs.Content>
                  <Tabs.Content value="autoTrading" pt={0}>
                    <AutoTradingTab />
                  </Tabs.Content>
                  <Tabs.Content value="indicators" pt={0}>
                    <IndicatorsTab />
                  </Tabs.Content>
                  <Tabs.Content value="customSymbols" pt={0}>
                    <CustomSymbolsTab />
                  </Tabs.Content>
                  <Tabs.Content value="data" pt={0}>
                    <DataTab />
                  </Tabs.Content>
                  <Tabs.Content value="updates" pt={0}>
                    <UpdatesTab />
                  </Tabs.Content>
                  <Tabs.Content value="about" pt={0}>
                    <AboutTab />
                  </Tabs.Content>
                </Box>
              </Flex>
            </Tabs.Root>
          </Dialog.Body>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
};
