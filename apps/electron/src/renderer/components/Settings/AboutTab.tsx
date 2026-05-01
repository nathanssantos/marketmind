import { Badge, Button, Callout, FormRow, FormSection, Link, Logo, PageTitle, Slider, Switch } from '@renderer/components/ui';
import { Box, Flex, HStack, Stack, Text } from '@chakra-ui/react';
import { APP_VERSION } from '@shared/constants';
import { DEFAULT_AUTO_UPDATE_SETTINGS } from '@/renderer/constants/defaults';
import { useAutoUpdate } from '@/renderer/hooks/useAutoUpdate';
import { useDebounceCallback } from '@/renderer/hooks/useDebounceCallback';
import { useUIPref } from '@/renderer/store/preferencesStore';
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
      <Box>
        <Flex align="center" gap={2} mb={1}>
          <Logo size={28} />
          <PageTitle>{t('app.title')}</PageTitle>
        </Flex>
        <HStack gap={2} align="center" mb={2}>
          <Text fontSize="xs" color="fg.muted">
            {t('about.version', { version: APP_VERSION })}
          </Text>
        </HStack>
        <Text fontSize="xs" color="fg.muted">
          {t('about.description')}
        </Text>
      </Box>

      <FormSection
        title={t('settings.autoUpdate.title')}
        description={t('settings.autoUpdate.description')}
        action={
          <HStack gap={2}>
            {status === 'available' && <Badge colorPalette="blue" size="xs">{t('about.update.available', { version: updateInfo?.version })}</Badge>}
            {status === 'not-available' && <Badge colorPalette="green" size="xs">{t('about.update.upToDate')}</Badge>}
            {status === 'downloaded' && <Badge colorPalette="orange" size="xs">{t('about.update.readyToInstall')}</Badge>}
            {status === 'checking' && <Badge colorPalette="gray" size="xs">{t('settings.autoUpdate.checking')}</Badge>}
            <Button size="2xs" variant="outline" onClick={handleResetAutoUpdate}>
              <LuRefreshCw />
              {t('settings.resetToDefaults')}
            </Button>
          </HStack>
        }
      >
        <FormRow
          label={t('settings.autoUpdate.checkAutomatically')}
          helper={t('settings.autoUpdate.checkAutomaticallyDescription')}
        >
          <Switch
            checked={autoCheckUpdates}
            onCheckedChange={handleAutoCheckChange}
            aria-label={t('settings.autoUpdate.checkAutomatically')}
            data-testid="updates-auto-check"
          />
        </FormRow>

        {autoCheckUpdates && (
          <Box>
            <Text fontSize="xs" mb={1.5} id="settings-update-interval-label">{t('settings.autoUpdate.checkInterval', { hours: updateCheckInterval })}</Text>
            <Slider
              value={[updateCheckInterval]}
              onValueChange={handleIntervalChange}
              min={1}
              max={168}
              step={1}
              aria-label={t('settings.autoUpdate.checkAutomatically')}
            />
          </Box>
        )}

        <FormRow
          label={t('settings.autoUpdate.downloadAutomatically')}
          helper={t('settings.autoUpdate.downloadAutomaticallyDescription')}
        >
          <Switch
            checked={autoDownloadUpdates}
            onCheckedChange={setAutoDownloadUpdates}
            aria-label={t('settings.autoUpdate.downloadAutomatically')}
            data-testid="updates-auto-download"
          />
        </FormRow>

        <Button
          size="xs"
          variant="outline"
          onClick={() => void checkForUpdates()}
          disabled={status === 'checking'}
          loading={status === 'checking'}
          data-testid="updates-check-now"
        >
          <LuRefreshCw />
          {t('settings.autoUpdate.checkNow')}
        </Button>
      </FormSection>

      <FormSection title={t('about.resources')}>
        <Stack gap={1.5} fontSize="xs">
          <Link href="https://github.com/nathanssantos/marketmind" target="_blank" color="blue.fg" display="inline-flex" alignItems="center" gap={1}>
            {t('about.resourcesList.github')} <LuExternalLink />
          </Link>
          <Link href="https://github.com/nathanssantos/marketmind/blob/main/.github/copilot-instructions.md" target="_blank" color="blue.fg" display="inline-flex" alignItems="center" gap={1}>
            {t('about.resourcesList.documentation')} <LuExternalLink />
          </Link>
          <Link href="https://github.com/nathanssantos/marketmind/blob/main/docs/CHANGELOG.md" target="_blank" color="blue.fg" display="inline-flex" alignItems="center" gap={1}>
            {t('about.resourcesList.changelog')} <LuExternalLink />
          </Link>
        </Stack>
      </FormSection>

      <Callout tone="neutral" compact>
        {t('about.copyright', { year: currentYear })}
      </Callout>
    </Stack>
  );
};
