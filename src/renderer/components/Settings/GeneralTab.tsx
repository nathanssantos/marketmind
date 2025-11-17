import { Button } from '@/renderer/components/ui/button';
import { Slider } from '@/renderer/components/ui/slider';
import { Switch } from '@/renderer/components/ui/switch';
import { DEFAULT_AUTO_UPDATE_SETTINGS } from '@/renderer/constants/defaults';
import { useAutoUpdate } from '@/renderer/hooks/useAutoUpdate';
import { useDebounceCallback } from '@/renderer/hooks/useDebounceCallback';
import { useLocalStorage } from '@/renderer/hooks/useLocalStorage';
import { useAIStore } from '@/renderer/store';
import { Box, Flex, Separator, Stack, Text } from '@chakra-ui/react';
import { useTranslation } from 'react-i18next';
import { HiArrowDownTray, HiArrowPath, HiArrowUpTray, HiTrash } from 'react-icons/hi2';
import { LanguageSelector } from './LanguageSelector';

export const GeneralTab = () => {
  const { t } = useTranslation();
  const { conversations, importConversation, clearAll } = useAIStore();
  
  const [autoCheckUpdates, setAutoCheckUpdates] = useLocalStorage<boolean>('autoCheckUpdates', DEFAULT_AUTO_UPDATE_SETTINGS.autoCheckUpdates);
  const [autoDownloadUpdates, setAutoDownloadUpdates] = useLocalStorage<boolean>('autoDownloadUpdates', DEFAULT_AUTO_UPDATE_SETTINGS.autoDownloadUpdates);
  const [updateCheckInterval, setUpdateCheckInterval] = useLocalStorage<number>('updateCheckInterval', DEFAULT_AUTO_UPDATE_SETTINGS.updateCheckInterval);
  
  const { status, checkForUpdates, startAutoCheck, stopAutoCheck } = useAutoUpdate();

  const debouncedSetUpdateCheckInterval = useDebounceCallback(setUpdateCheckInterval, 300);

  const handleExportAll = () => {
    const data = {
      conversations,
      exportedAt: Date.now(),
      version: '0.6.0',
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `marketmind-conversations-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const content = event.target?.result as string;
          importConversation(content);
          alert(t('settings.dataManagement.importSuccess'));
        } catch (error) {
          alert(t('settings.dataManagement.importError'));
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const handleClearAll = () => {
    const confirm = window.confirm(t('settings.dataManagement.confirmClear'));
    if (confirm) {
      clearAll();
      alert(t('settings.dataManagement.clearSuccess'));
    }
  };

  const handleAutoCheckChange = (checked: boolean) => {
    setAutoCheckUpdates(checked);
    if (checked) {
      startAutoCheck(updateCheckInterval);
    } else {
      stopAutoCheck();
    }
  };

  const handleAutoDownloadChange = (checked: boolean) => {
    setAutoDownloadUpdates(checked);
  };

  const handleIntervalChange = (value: number[]) => {
    const interval = value[0] ?? DEFAULT_AUTO_UPDATE_SETTINGS.updateCheckInterval;
    debouncedSetUpdateCheckInterval(interval);
    if (autoCheckUpdates) {
      stopAutoCheck();
      startAutoCheck(interval);
    }
  };

  const handleCheckNow = () => {
    checkForUpdates();
  };

  const handleResetAutoUpdate = () => {
    setAutoCheckUpdates(DEFAULT_AUTO_UPDATE_SETTINGS.autoCheckUpdates);
    setAutoDownloadUpdates(DEFAULT_AUTO_UPDATE_SETTINGS.autoDownloadUpdates);
    setUpdateCheckInterval(DEFAULT_AUTO_UPDATE_SETTINGS.updateCheckInterval);
    if (DEFAULT_AUTO_UPDATE_SETTINGS.autoCheckUpdates) {
      startAutoCheck(DEFAULT_AUTO_UPDATE_SETTINGS.updateCheckInterval);
    } else {
      stopAutoCheck();
    }
  };

  return (
    <Stack gap={6}>
      <LanguageSelector />

      <Separator />

      <Box 
        bg="blue.500/10" 
        p={4} 
        borderRadius="md"
        borderLeft="4px solid"
        borderColor="blue.500"
      >
        <Text fontSize="sm" fontWeight="semibold" mb={2}>
          {t('settings.dataManagement.tipTitle')}
        </Text>
        <Stack gap={1} fontSize="sm" color="fg.muted">
          <Text>• {t('settings.dataManagement.export')}: {t('settings.dataManagement.exportDescription')}</Text>
          <Text>• {t('settings.dataManagement.import')}: {t('settings.dataManagement.importDescription')}</Text>
          <Text>• {t('settings.dataManagement.clear')}: {t('settings.dataManagement.clearDescription')}</Text>
          <Text>{t('settings.dataManagement.totalConversations', { count: conversations.length })}</Text>
        </Stack>
      </Box>

      <Separator />

      <Box>
        <Text fontSize="md" fontWeight="medium" mb={3}>
          {t('settings.autoUpdate.title')}
        </Text>
        <Stack gap={4}>
          <Box>
            <Switch 
              checked={autoCheckUpdates} 
              onCheckedChange={handleAutoCheckChange}
            >
              {t('settings.autoUpdate.checkAutomatically')}
            </Switch>
            <Text fontSize="sm" color="fg.muted" mt={1}>
              {t('settings.autoUpdate.checkAutomaticallyDescription')}
            </Text>
          </Box>

          {autoCheckUpdates && (
            <Box>
              <Text fontSize="sm" mb={2}>
                {t('settings.autoUpdate.checkInterval', { hours: updateCheckInterval })}
              </Text>
              <Slider 
                value={[updateCheckInterval]}
                onValueChange={handleIntervalChange}
                min={1}
                max={168}
                step={1}
              />
            </Box>
          )}

          <Box>
            <Switch 
              checked={autoDownloadUpdates} 
              onCheckedChange={handleAutoDownloadChange}
            >
              {t('settings.autoUpdate.downloadAutomatically')}
            </Switch>
            <Text fontSize="sm" color="fg.muted" mt={1}>
              {t('settings.autoUpdate.downloadAutomaticallyDescription')}
            </Text>
          </Box>

          <Button 
            variant="outline" 
            onClick={handleCheckNow}
            disabled={status === 'checking'}
          >
            <HiArrowPath />
            {t('settings.autoUpdate.checkNow')}
          </Button>

          <Button 
            variant="outline" 
            onClick={handleResetAutoUpdate}
          >
            <HiArrowPath />
            {t('settings.resetToDefaults')}
          </Button>
        </Stack>
      </Box>

      <Separator />

      <Box>
        <Text fontSize="md" fontWeight="medium" mb={3}>
          {t('settings.dataManagement.title')}
        </Text>
        <Flex gap={2}>
          <Button flex={1} variant="outline" onClick={handleExportAll} disabled={conversations.length === 0}>
            <HiArrowDownTray />
            {t('settings.dataManagement.exportAll')}
          </Button>
          <Button flex={1} variant="outline" onClick={handleImport}>
            <HiArrowUpTray />
            {t('settings.dataManagement.importConversation')}
          </Button>
          <Button flex={1} colorPalette="red" variant="outline" onClick={handleClearAll} disabled={conversations.length === 0}>
            <HiTrash />
            {t('settings.dataManagement.clearAll')}
          </Button>
        </Flex>
      </Box>
    </Stack>
  );
};
