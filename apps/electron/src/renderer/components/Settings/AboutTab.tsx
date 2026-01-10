import { Logo } from '@/renderer/components/ui/logo';
import { Box, Flex, Link, Separator, Stack, Text } from '@chakra-ui/react';
import { APP_VERSION } from '@shared/constants';
import { useTranslation } from 'react-i18next';
import { LuExternalLink } from 'react-icons/lu';

export const AboutTab = () => {
  const { t } = useTranslation();
  const currentYear = new Date().getFullYear();

  return (
    <Stack gap={6}>
      <Box>
        <Flex align="center" gap={2} mb={2}>
          <Logo size={32} />
          <Text fontSize="2xl" fontWeight="bold">
            {t('app.title')}
          </Text>
        </Flex>
        <Text fontSize="md" color="fg.muted" mb={4}>
          {t('about.version', { version: APP_VERSION })}
        </Text>
        <Text fontSize="sm" color="fg.muted">{t('about.description')}</Text>
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
