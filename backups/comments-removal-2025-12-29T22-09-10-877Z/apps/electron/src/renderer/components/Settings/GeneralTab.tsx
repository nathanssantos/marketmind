import { Button } from '@/renderer/components/ui/button';
import { Slider } from '@/renderer/components/ui/slider';
import { Switch } from '@/renderer/components/ui/switch';
import { DEFAULT_AUTO_UPDATE_SETTINGS } from '@/renderer/constants/defaults';
import { useAutoUpdate } from '@/renderer/hooks/useAutoUpdate';
import { useDebounceCallback } from '@/renderer/hooks/useDebounceCallback';
import { useLocalStorage } from '@/renderer/hooks/useLocalStorage';
import { Box, HStack, Separator, Stack, Text } from '@chakra-ui/react';
import { useTranslation } from 'react-i18next';
import { LuMoon, LuRefreshCw, LuSun } from 'react-icons/lu';
import { useColorMode } from '../ui/color-mode';
import { LanguageSelector } from './LanguageSelector';

export const GeneralTab = () => {
  const { t } = useTranslation();
  const { colorMode, setColorMode } = useColorMode();

  const [autoCheckUpdates, setAutoCheckUpdates] = useLocalStorage<boolean>('autoCheckUpdates', DEFAULT_AUTO_UPDATE_SETTINGS.autoCheckUpdates);
  const [autoDownloadUpdates, setAutoDownloadUpdates] = useLocalStorage<boolean>('autoDownloadUpdates', DEFAULT_AUTO_UPDATE_SETTINGS.autoDownloadUpdates);
  const [updateCheckInterval, setUpdateCheckInterval] = useLocalStorage<number>('updateCheckInterval', DEFAULT_AUTO_UPDATE_SETTINGS.updateCheckInterval);

  const { status, checkForUpdates, startAutoCheck, stopAutoCheck } = useAutoUpdate();

  const debouncedSetUpdateCheckInterval = useDebounceCallback(setUpdateCheckInterval, 300);

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

      <Box>
        <Text fontSize="md" fontWeight="medium" mb={3}>
          {t('header.theme')}
        </Text>
        <HStack gap={2}>
          <Button
            flex={1}
            variant={colorMode === 'light' ? 'solid' : 'outline'}
            colorPalette={colorMode === 'light' ? 'blue' : 'gray'}
            onClick={() => setColorMode('light')}
          >
            <LuSun />
            {t('header.themeLight')}
          </Button>
          <Button
            flex={1}
            variant={colorMode === 'dark' ? 'solid' : 'outline'}
            colorPalette={colorMode === 'dark' ? 'blue' : 'gray'}
            onClick={() => setColorMode('dark')}
          >
            <LuMoon />
            {t('header.themeDark')}
          </Button>
        </HStack>
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
            <LuRefreshCw />
            {t('settings.autoUpdate.checkNow')}
          </Button>

          <Button
            variant="outline"
            onClick={handleResetAutoUpdate}
          >
            <LuRefreshCw />
            {t('settings.resetToDefaults')}
          </Button>
        </Stack>
      </Box>
    </Stack>
  );
};
