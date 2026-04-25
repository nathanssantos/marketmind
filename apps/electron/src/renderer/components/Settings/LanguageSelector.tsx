import { Select } from '@renderer/components/ui';
import { useUIPreferences } from '@/renderer/hooks/useUserPreferences';
import { Box, Stack, Text } from '@chakra-ui/react';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

const LANGUAGES = [
  { value: 'en', label: 'English', description: 'English' },
  { value: 'pt', label: 'Português', description: 'Portuguese (Brazil)' },
  { value: 'es', label: 'Español', description: 'Spanish' },
  { value: 'fr', label: 'Français', description: 'French' },
];

const LANGUAGE_KEY = 'language';

export const LanguageSelector = () => {
  const { i18n, t } = useTranslation();
  const { preferences, set } = useUIPreferences();
  const isHydratedRef = useRef(false);

  useEffect(() => {
    if (preferences && !isHydratedRef.current) {
      const savedLanguage = preferences[LANGUAGE_KEY] as string | undefined;
      if (savedLanguage && ['en', 'pt', 'es', 'fr'].includes(savedLanguage)) {
        void i18n.changeLanguage(savedLanguage);
      }
      isHydratedRef.current = true;
    }
  }, [preferences, i18n]);

  const handleLanguageChange = async (newLanguage: string) => {
    await i18n.changeLanguage(newLanguage);
    await set(LANGUAGE_KEY, newLanguage);
  };

  return (
    <Box>
      <Text fontSize="md" fontWeight="medium" mb={3}>
        {t('settings.language.title')}
      </Text>
      <Stack gap={2}>
        <Text fontSize="sm" color="fg.muted">
          {t('settings.language.description')}
        </Text>
        <Select
          value={i18n.language}
          onChange={(newLanguage) => { void handleLanguageChange(newLanguage); }}
          options={LANGUAGES}
          placeholder={LANGUAGES.find(l => l.value === i18n.language)?.label ?? 'English'}
          usePortal={false}
        />
      </Stack>
    </Box>
  );
};
