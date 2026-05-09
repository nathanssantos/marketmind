import { Box, Flex, Stack, Text } from '@chakra-ui/react';
import { Badge, DialogShell, LoadingSpinner, Tabs } from '@renderer/components/ui';
import { useDialogMount } from '@renderer/hooks/useDialogMount';
import type { DialogControlProps } from '@marketmind/types';
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
const AutoTradingTab = lazy(() => import('./AutoTradingTab').then((m) => ({ default: m.AutoTradingTab })));
const IndicatorsTab = lazy(() => import('./IndicatorsTab').then((m) => ({ default: m.IndicatorsTab })));
const DataTab = lazy(() => import('./DataTab').then((m) => ({ default: m.DataTab })));
const AboutTab = lazy(() => import('./AboutTab').then((m) => ({ default: m.AboutTab })));
import {
  DEFAULT_SETTINGS_TAB,
  SETTINGS_GROUPS,
  SETTINGS_GROUP_LABEL_KEYS,
  SETTINGS_TAB_DEFS,
  type SettingsTab,
  isSettingsTab,
} from './constants';

interface SettingsDialogProps extends DialogControlProps {
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
    const isDev = import.meta.env.DEV;
    return SETTINGS_GROUPS.map((group) => ({
      group,
      tabs: SETTINGS_TAB_DEFS.filter((d) => d.group === group && (!d.devOnly || isDev)),
    }));
  }, []);

  return (
    <DialogShell
      isOpen={isOpen}
      onClose={onClose}
      size="xl"
      title={t('settings.title')}
      description={t('settings.dialogDescription')}
      bodyPadding={0}
      bodyFill
      hideFooter
    >
      <Tabs.Root
              value={activeTab}
              onValueChange={(e) => isSettingsTab(e.value) && setActiveTab(e.value)}
              orientation="vertical"
              variant="subtle"
              flex={1}
              minH={0}
              display="flex"
            >
              <Flex flex={1} minH={0} minW={0}>
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
                          {tabs.map(({ id, icon: Icon, labelKey, devOnly }) => (
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
                              {devOnly && (
                                <Badge size="xs" px={1.5} colorPalette="orange" ml="auto">
                                  DEV
                                </Badge>
                              )}
                            </Tabs.Trigger>
                          ))}
                        </Tabs.List>
                      </Box>
                    ))}
                  </Stack>
                </Box>

                <Box flex={1} overflowY="auto" data-testid="settings-content">
                  {/* pb on the scroll container itself is dropped by WebKit
                      when content overflows (last item flush against the
                      scroll edge). Moving padding INSIDE the scroll content
                      so it scrolls along with the rest. */}
                  <Box px={6} pt={4} pb={10}>
                    <Suspense fallback={
                      <LoadingSpinner />
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
                      <Tabs.Content value="autoTrading" pt={0} w="100%">
                        {activeTab === 'autoTrading' && <AutoTradingTab />}
                      </Tabs.Content>
                      <Tabs.Content value="indicators" pt={0} w="100%">
                        {activeTab === 'indicators' && <IndicatorsTab />}
                      </Tabs.Content>
                      <Tabs.Content value="data" pt={0} w="100%">
                        {activeTab === 'data' && <DataTab />}
                      </Tabs.Content>
                      <Tabs.Content value="about" pt={0} w="100%">
                        {activeTab === 'about' && <AboutTab />}
                      </Tabs.Content>
                    </Suspense>
                  </Box>
              </Box>
            </Flex>
      </Tabs.Root>
    </DialogShell>
  );
};
