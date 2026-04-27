import { Button, FormSection, useColorMode } from '@renderer/components/ui';
import { HStack, Stack } from '@chakra-ui/react';
import { useTranslation } from 'react-i18next';
import { LuMoon, LuSun } from 'react-icons/lu';
import { LanguageSelector } from './LanguageSelector';

export const GeneralTab = () => {
  const { t } = useTranslation();
  const { colorMode, setColorMode } = useColorMode();

  return (
    <Stack gap={5}>
      <FormSection
        title={t('settings.language.title')}
        description={t('settings.language.description')}
      >
        <LanguageSelector />
      </FormSection>

      <FormSection
        title={t('header.theme')}
        description={t('settings.theme.description')}
      >
        <HStack gap={2}>
          <Button
            flex={1}
            size="sm"
            variant="outline"
            color={colorMode === 'light' ? 'blue.500' : 'fg.muted'}
            onClick={() => setColorMode('light')}
            data-testid="theme-light-button"
          >
            <LuSun />
            {t('header.themeLight')}
          </Button>
          <Button
            flex={1}
            size="sm"
            variant="outline"
            color={colorMode === 'dark' ? 'blue.500' : 'fg.muted'}
            onClick={() => setColorMode('dark')}
            data-testid="theme-dark-button"
          >
            <LuMoon />
            {t('header.themeDark')}
          </Button>
        </HStack>
      </FormSection>
    </Stack>
  );
};
