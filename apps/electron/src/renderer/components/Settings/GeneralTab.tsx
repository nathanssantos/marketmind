import { Button } from '@/renderer/components/ui/button';
import { Box, Grid, HStack, Text } from '@chakra-ui/react';
import { useTranslation } from 'react-i18next';
import { LuMoon, LuSun } from 'react-icons/lu';
import { useColorMode } from '../ui/color-mode';
import { LanguageSelector } from './LanguageSelector';

export const GeneralTab = () => {
  const { t } = useTranslation();
  const { colorMode, setColorMode } = useColorMode();

  return (
    <Grid templateColumns="1fr 1fr" gap={6}>
      <LanguageSelector />

      <Box>
        <Text fontSize="md" fontWeight="medium" mb={3}>
          {t('header.theme')}
        </Text>
        <Text fontSize="sm" color="fg.muted" mb={2}>
          {t('settings.theme.description')}
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
    </Grid>
  );
};
