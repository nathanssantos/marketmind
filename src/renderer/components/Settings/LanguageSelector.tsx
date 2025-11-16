import { Select } from '@/renderer/components/ui/select';
import { Box, Stack, Text } from '@chakra-ui/react';
import { useTranslation } from 'react-i18next';

const LANGUAGES = [
  { value: 'en', label: 'English', description: 'English' },
  { value: 'pt', label: 'Português', description: 'Portuguese (Brazil)' },
  { value: 'es', label: 'Español', description: 'Spanish' },
];

export const LanguageSelector = () => {
  const { i18n, t } = useTranslation();

  const handleLanguageChange = (newLanguage: string) => {
    i18n.changeLanguage(newLanguage);
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
          onChange={handleLanguageChange}
          options={LANGUAGES}
          placeholder={LANGUAGES.find(l => l.value === i18n.language)?.label || 'English'}
        />
      </Stack>
    </Box>
  );
};
