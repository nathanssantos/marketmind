import {
  Badge, Button, FormRow, FormSection, Slider, Switch,
} from '@renderer/components/ui';
import { DEFAULT_AUTO_UPDATE_SETTINGS } from '@/renderer/constants/defaults';
import { useAutoUpdate } from '@/renderer/hooks/useAutoUpdate';
import { useDebounceCallback } from '@/renderer/hooks/useDebounceCallback';
import { useUIPref } from '@/renderer/store/preferencesStore';
import { Box, HStack, Stack, Text } from '@chakra-ui/react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { LuRefreshCw } from 'react-icons/lu';

export const UpdatesTab = () => {
  const { t } = useTranslation();

  const [autoCheckUpdates, setAutoCheckUpdates] = useUIPref<boolean>('autoCheckUpdates', DEFAULT_AUTO_UPDATE_SETTINGS.autoCheckUpdates);
  const [autoDownloadUpdates, setAutoDownloadUpdates] = useUIPref<boolean>('autoDownloadUpdates', DEFAULT_AUTO_UPDATE_SETTINGS.autoDownloadUpdates);
  const [updateCheckInterval, setUpdateCheckInterval] = useUIPref<number>('updateCheckInterval', DEFAULT_AUTO_UPDATE_SETTINGS.updateCheckInterval);

  const { status, updateInfo, checkForUpdates, downloadUpdate, startAutoCheck, stopAutoCheck } = useAutoUpdate();

  const debouncedSetUpdateCheckInterval = useDebounceCallback(setUpdateCheckInterval, 300);

  useEffect(() => {
    if (status === 'available' && autoDownloadUpdates) void downloadUpdate();
  }, [status, autoDownloadUpdates, downloadUpdate]);

  const handleAutoCheckChange = (checked: boolean) => {
    setAutoCheckUpdates(checked);
    if (checked) void startAutoCheck(updateCheckInterval);
    else void stopAutoCheck();
  };

  const handleIntervalChange = (value: number[]) => {
    const interval = value[0] ?? DEFAULT_AUTO_UPDATE_SETTINGS.updateCheckInterval;
    debouncedSetUpdateCheckInterval(interval);
    if (autoCheckUpdates) {
      void stopAutoCheck();
      void startAutoCheck(interval);
    }
  };

  const handleResetAutoUpdate = () => {
    setAutoCheckUpdates(DEFAULT_AUTO_UPDATE_SETTINGS.autoCheckUpdates);
    setAutoDownloadUpdates(DEFAULT_AUTO_UPDATE_SETTINGS.autoDownloadUpdates);
    setUpdateCheckInterval(DEFAULT_AUTO_UPDATE_SETTINGS.updateCheckInterval);
    if (DEFAULT_AUTO_UPDATE_SETTINGS.autoCheckUpdates) void startAutoCheck(DEFAULT_AUTO_UPDATE_SETTINGS.updateCheckInterval);
    else void stopAutoCheck();
  };

  return (
    <Stack gap={5}>
      <FormSection
        title={t('settings.autoUpdate.title')}
        description={t('settings.autoUpdate.description')}
        action={
          status === 'available' ? <Badge colorPalette="blue" size="sm">{t('about.update.available', { version: updateInfo?.version })}</Badge>
            : status === 'not-available' ? <Badge colorPalette="green" size="sm">{t('about.update.upToDate')}</Badge>
            : status === 'downloaded' ? <Badge colorPalette="orange" size="sm">{t('about.update.readyToInstall')}</Badge>
            : status === 'checking' ? <Badge colorPalette="gray" size="sm">{t('settings.autoUpdate.checking')}</Badge>
            : null
        }
      >
        <FormRow
          label={t('settings.autoUpdate.checkAutomatically')}
          helper={t('settings.autoUpdate.checkAutomaticallyDescription')}
        >
          <Switch checked={autoCheckUpdates} onCheckedChange={handleAutoCheckChange} data-testid="updates-auto-check" />
        </FormRow>

        {autoCheckUpdates && (
          <Box>
            <Text fontSize="xs" mb={1.5}>{t('settings.autoUpdate.checkInterval', { hours: updateCheckInterval })}</Text>
            <Slider value={[updateCheckInterval]} onValueChange={handleIntervalChange} min={1} max={168} step={1} />
          </Box>
        )}

        <FormRow
          label={t('settings.autoUpdate.downloadAutomatically')}
          helper={t('settings.autoUpdate.downloadAutomaticallyDescription')}
        >
          <Switch checked={autoDownloadUpdates} onCheckedChange={setAutoDownloadUpdates} data-testid="updates-auto-download" />
        </FormRow>

        <HStack gap={2}>
          <Button
            flex={1}
            size="sm"
            variant="outline"
            onClick={() => void checkForUpdates()}
            disabled={status === 'checking'}
            loading={status === 'checking'}
            data-testid="updates-check-now"
          >
            <LuRefreshCw />
            {t('settings.autoUpdate.checkNow')}
          </Button>
          <Button flex={1} size="sm" variant="outline" onClick={handleResetAutoUpdate}>
            <LuRefreshCw />
            {t('settings.resetToDefaults')}
          </Button>
        </HStack>
      </FormSection>
    </Stack>
  );
};
