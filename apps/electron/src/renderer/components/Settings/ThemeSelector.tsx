import { Button, useColorMode } from '@renderer/components/ui';
import { HStack } from '@chakra-ui/react';
import { useTranslation } from 'react-i18next';
import { LuMoon, LuSun } from 'react-icons/lu';

export const ThemeSelector = () => {
  const { t } = useTranslation();
  const { colorMode, setColorMode } = useColorMode();

  return (
    <HStack gap={2} w="100%">
      <Button
        flex={1}
        size="sm"
        variant="outline"
        color={colorMode === 'light' ? 'accent.solid' : 'fg.muted'}
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
        color={colorMode === 'dark' ? 'accent.solid' : 'fg.muted'}
        onClick={() => setColorMode('dark')}
        data-testid="theme-dark-button"
      >
        <LuMoon />
        {t('header.themeDark')}
      </Button>
    </HStack>
  );
};
