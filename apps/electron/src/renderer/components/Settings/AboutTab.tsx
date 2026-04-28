import { Callout, FormSection, Link, Logo, PageTitle } from '@renderer/components/ui';
import { Box, Flex, HStack, Stack, Text } from '@chakra-ui/react';
import { APP_VERSION } from '@shared/constants';
import { useTranslation } from 'react-i18next';
import { LuExternalLink } from 'react-icons/lu';

export const AboutTab = () => {
  const { t } = useTranslation();
  const currentYear = new Date().getFullYear();

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
