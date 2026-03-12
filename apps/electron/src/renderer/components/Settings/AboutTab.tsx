import { Button } from '@/renderer/components/ui/button';
import { Logo } from '@/renderer/components/ui/logo';
import { Slider } from '@/renderer/components/ui/slider';
import { Switch } from '@/renderer/components/ui/switch';
import { DEFAULT_AUTO_UPDATE_SETTINGS } from '@/renderer/constants/defaults';
import { useAutoUpdate } from '@/renderer/hooks/useAutoUpdate';
import { useDebounceCallback } from '@/renderer/hooks/useDebounceCallback';
import { useUIPref } from '@/renderer/store/preferencesStore';
import { Separator } from '@/renderer/components/ui/separator';
import { Badge, Box, Flex, HStack, Link, Stack, Text } from '@chakra-ui/react';
import { APP_VERSION } from '@shared/constants';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { LuExternalLink, LuRefreshCw } from 'react-icons/lu';

export const AboutTab = () => {
  const { t } = useTranslation();
  const currentYear = new Date().getFullYear();

  const [autoCheckUpdates, setAutoCheckUpdates] = useUIPref<boolean>('autoCheckUpdates', DEFAULT_AUTO_UPDATE_SETTINGS.autoCheckUpdates);
  const [autoDownloadUpdates, setAutoDownloadUpdates] = useUIPref<boolean>('autoDownloadUpdates', DEFAULT_AUTO_UPDATE_SETTINGS.autoDownloadUpdates);
  const [updateCheckInterval, setUpdateCheckInterval] = useUIPref<number>('updateCheckInterval', DEFAULT_AUTO_UPDATE_SETTINGS.updateCheckInterval);

  const { status, updateInfo, checkForUpdates, downloadUpdate, startAutoCheck, stopAutoCheck } = useAutoUpdate();

  const debouncedSetUpdateCheckInterval = useDebounceCallback(setUpdateCheckInterval, 300);

  useEffect(() => {
    if (status === 'available' && autoDownloadUpdates) downloadUpdate();
  }, [status, autoDownloadUpdates, downloadUpdate]);

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
      <Box>
        <Flex align="center" gap={2} mb={2}>
          <Logo size={32} />
          <Text fontSize="2xl" fontWeight="bold">
            {t('app.title')}
          </Text>
        </Flex>
        <HStack gap={2} align="center" mb={4}>
          <Text fontSize="md" color="fg.muted">
            {t('about.version', { version: APP_VERSION })}
          </Text>
          {status === 'available' && (
            <Badge colorPalette="blue" size="sm">{t('about.update.available', { version: updateInfo?.version })}</Badge>
          )}
          {status === 'not-available' && (
            <Badge colorPalette="green" size="sm">{t('about.update.upToDate')}</Badge>
          )}
          {status === 'downloaded' && (
            <Badge colorPalette="orange" size="sm">{t('about.update.readyToInstall')}</Badge>
          )}
        </HStack>
        <Text fontSize="sm" color="fg.muted">{t('about.description')}</Text>
      </Box>

      <Separator />

      <Box>
        <Text fontSize="md" fontWeight="medium" mb={3}>{t('settings.autoUpdate.title')}</Text>
        <Stack gap={4}>
          <Box>
            <Switch checked={autoCheckUpdates} onCheckedChange={handleAutoCheckChange}>
              {t('settings.autoUpdate.checkAutomatically')}
            </Switch>
            <Text fontSize="sm" color="fg.muted" mt={1}>{t('settings.autoUpdate.checkAutomaticallyDescription')}</Text>
          </Box>

          {autoCheckUpdates && (
            <Box>
              <Text fontSize="sm" mb={2}>{t('settings.autoUpdate.checkInterval', { hours: updateCheckInterval })}</Text>
              <Slider value={[updateCheckInterval]} onValueChange={handleIntervalChange} min={1} max={168} step={1} />
            </Box>
          )}

          <Box>
            <Switch checked={autoDownloadUpdates} onCheckedChange={handleAutoDownloadChange}>
              {t('settings.autoUpdate.downloadAutomatically')}
            </Switch>
            <Text fontSize="sm" color="fg.muted" mt={1}>{t('settings.autoUpdate.downloadAutomaticallyDescription')}</Text>
          </Box>

          <HStack gap={2}>
            <Button flex={1} variant="outline" onClick={handleCheckNow} disabled={status === 'checking'} loading={status === 'checking'}>
              <LuRefreshCw />
              {t('settings.autoUpdate.checkNow')}
            </Button>
            <Button flex={1} variant="outline" onClick={handleResetAutoUpdate}>
              <LuRefreshCw />
              {t('settings.resetToDefaults')}
            </Button>
          </HStack>
        </Stack>
      </Box>

      <Separator />

      <Box>
        <Text fontSize="md" fontWeight="medium" mb={3}>
          {t('about.resources')}
        </Text>
        <Stack gap={2} fontSize="sm">
          <Link href="https://github.com/nathanssantos/marketmind" target="_blank" color="blue.500" display="flex" alignItems="center" gap={1}>
            {t('about.resourcesList.github')}
            <LuExternalLink />
          </Link>
          <Link href="https://github.com/nathanssantos/marketmind/blob/main/.github/copilot-instructions.md" target="_blank" color="blue.500" display="flex" alignItems="center" gap={1}>
            {t('about.resourcesList.documentation')}
            <LuExternalLink />
          </Link>
          <Link href="https://github.com/nathanssantos/marketmind/blob/main/docs/CHANGELOG.md" target="_blank" color="blue.500" display="flex" alignItems="center" gap={1}>
            {t('about.resourcesList.changelog')}
            <LuExternalLink />
          </Link>
        </Stack>
      </Box>

      <Box bg="bg.muted" p={4} borderRadius="md">
        <Text fontSize="sm" color="fg.muted">
          {t('about.copyright', { year: currentYear })}
        </Text>
      </Box>
    </Stack>
  );
};
