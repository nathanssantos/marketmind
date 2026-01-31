import { Dialog } from '@/renderer/components/ui/dialog';
import { Tabs } from '@/renderer/components/ui/tabs';
import { Box, CloseButton } from '@chakra-ui/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AdvancedControlsConfig } from '../Chart/AdvancedControls';
import { BacktestingPanel } from '../Trading/BacktestingPanel';
import { AboutTab } from './AboutTab';
import { ChartSettingsTab } from './ChartSettingsTab';
import { GeneralTab } from './GeneralTab';
import { TradingProfilesTab } from './TradingProfilesTab';

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  advancedConfig: AdvancedControlsConfig;
  onAdvancedConfigChange: (config: AdvancedControlsConfig) => void;
}

export const SettingsDialog = ({ isOpen, onClose, advancedConfig, onAdvancedConfigChange }: SettingsDialogProps) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<string>('general');

  return (
    <Dialog.Root open={isOpen} onOpenChange={(e) => !e.open && onClose()} size="xl">
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content maxH="90vh" maxW="900px">
          <CloseButton
            position="absolute"
            top={4}
            right={4}
            onClick={onClose}
            size="sm"
          />
          <Dialog.Header borderBottom="1px solid" borderColor="border">
            <Dialog.Title>{t('settings.title')}</Dialog.Title>
          </Dialog.Header>

          <Dialog.Body overflowY="auto">
            <Tabs.Root value={activeTab} onValueChange={(e) => setActiveTab(e.value)} variant="enclosed">
              <Tabs.List>
                <Tabs.Trigger value="general">{t('settings.tabs.general')}</Tabs.Trigger>
                <Tabs.Trigger value="chart">{t('settings.tabs.chart')}</Tabs.Trigger>
                <Tabs.Trigger value="autoTrading">{t('settings.tabs.autoTrading')}</Tabs.Trigger>
                <Tabs.Trigger value="backtesting">{t('settings.tabs.backtesting')}</Tabs.Trigger>
                <Tabs.Trigger value="about">{t('settings.tabs.about')}</Tabs.Trigger>
              </Tabs.List>

              <Box mt={4}>
                <Tabs.Content value="general">
                  <GeneralTab />
                </Tabs.Content>

                <Tabs.Content value="chart">
                  <ChartSettingsTab
                    config={advancedConfig}
                    onConfigChange={onAdvancedConfigChange}
                  />
                </Tabs.Content>

                <Tabs.Content value="autoTrading">
                  <TradingProfilesTab />
                </Tabs.Content>

                <Tabs.Content value="backtesting">
                  <BacktestingPanel />
                </Tabs.Content>

                <Tabs.Content value="about">
                  <AboutTab />
                </Tabs.Content>
              </Box>
            </Tabs.Root>
          </Dialog.Body>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
};
