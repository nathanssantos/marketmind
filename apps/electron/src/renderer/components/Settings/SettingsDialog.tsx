import { Dialog } from '@/renderer/components/ui/dialog';
import { Tabs } from '@/renderer/components/ui/tabs';
import { Box, CloseButton } from '@chakra-ui/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AdvancedControlsConfig } from '../Chart/AdvancedControls';
import { AboutTab } from './AboutTab';
import { AIConfigTab } from './AIConfigTab';
import { AITradingConfigTab } from './AITradingConfigTab';
import { AlgorithmicAutoTradingTab } from './AlgorithmicAutoTradingTab';
import { ChartSettingsTab } from './ChartSettingsTab';
import { ContextConfigTab } from './ContextConfigTab';
import { GeneralTab } from './GeneralTab';
import { MarketContextConfigTab } from './MarketContextConfigTab';
import { NewsConfigTab } from './NewsConfigTab';
import { PatternDetectionTab } from './PatternDetectionTab';
import { SetupConfigTab } from './SetupConfigTab';

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
        <Dialog.Content maxH="90vh" maxW="1400px">
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
                <Tabs.Trigger value="ai">{t('settings.tabs.ai')}</Tabs.Trigger>
                <Tabs.Trigger value="aiTrading">{t('settings.tabs.aiTrading')}</Tabs.Trigger>
                <Tabs.Trigger value="context">{t('settings.tabs.context')}</Tabs.Trigger>
                <Tabs.Trigger value="algorithmicAutoTrading">{t('settings.tabs.algorithmicAutoTrading')}</Tabs.Trigger>
                <Tabs.Trigger value="marketContext">{t('settings.tabs.marketContext')}</Tabs.Trigger>
                <Tabs.Trigger value="setupDetection">{t('settings.tabs.setupDetection')}</Tabs.Trigger>
                <Tabs.Trigger value="patternDetection">{t('settings.tabs.patternDetection')}</Tabs.Trigger>
                <Tabs.Trigger value="news">{t('settings.tabs.news')}</Tabs.Trigger>
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

                <Tabs.Content value="ai">
                  <AIConfigTab />
                </Tabs.Content>
                <Tabs.Content value="aiTrading">
                  <AITradingConfigTab />
                </Tabs.Content>

                <Tabs.Content value="context">
                  <ContextConfigTab />
                </Tabs.Content>

                <Tabs.Content value="algorithmicAutoTrading">
                  <AlgorithmicAutoTradingTab />
                </Tabs.Content>

                <Tabs.Content value="marketContext">
                  <MarketContextConfigTab />
                </Tabs.Content>

                <Tabs.Content value="setupDetection">
                  <SetupConfigTab />
                </Tabs.Content>

                <Tabs.Content value="patternDetection">
                  <PatternDetectionTab />
                </Tabs.Content>

                <Tabs.Content value="news">
                  <NewsConfigTab />
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
