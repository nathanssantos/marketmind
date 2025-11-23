import { Logo } from '@/renderer/components/ui/logo';
import { Box, Flex, Link, Separator, Stack, Text } from '@chakra-ui/react';
import { APP_VERSION } from '@shared/constants';
import { useTranslation } from 'react-i18next';
import { LuExternalLink } from 'react-icons/lu';

export const AboutTab = () => {
  const { t } = useTranslation();

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
          {t('about.version', { version: '0.21.0' })}
        </Text>
        <Text fontSize="sm" color="fg.muted">{t('about.description')}</Text>
      </Box>

      <Separator />

      <Box>
        <Text fontSize="md" fontWeight="medium" mb={3}>
          {t('about.features')}
        </Text>
        <Stack gap={2} fontSize="sm" color="fg.muted">
          <Text>• {t('about.featuresList.marketData')}</Text>
          <Text>• {t('about.featuresList.charts')}</Text>
          <Text>• {t('about.featuresList.aiAnalysis')}</Text>
          <Text>• {t('about.featuresList.news')}</Text>
          <Text>• {t('about.featuresList.chat')}</Text>
          <Text>• {t('about.featuresList.security')}</Text>
          <Text>• {t('about.featuresList.autoUpdate')}</Text>
          <Text>• {t('about.featuresList.shortcuts')}</Text>
          <Text>• {t('about.featuresList.themes')}</Text>
          <Text>• {t('about.featuresList.websocket')}</Text>
        </Stack>
      </Box>

      <Separator />

      <Box>
        <Text fontSize="md" fontWeight="medium" mb={3}>
          {t('about.techStack')}
        </Text>
        <Stack gap={2} fontSize="sm" color="fg.muted">
          <Text>• {t('about.techStackList.electron', { version: '39.2.0' })}</Text>
          <Text>• {t('about.techStackList.react', { version: '19.2.0' })}</Text>
          <Text>• {t('about.techStackList.typescript', { version: '5.9.3' })}</Text>
          <Text>• {t('about.techStackList.chakra', { version: '3.29.0' })}</Text>
          <Text>• {t('about.techStackList.vite', { version: '7.2.2' })}</Text>
          <Text>• {t('about.techStackList.zustand', { version: '5.0.8' })}</Text>
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
          <Link href="https://github.com/nathanssantos/marketmind/blob/main/docs/AI_CONTEXT.md" target="_blank" color="blue.500" display="flex" alignItems="center" gap={1}>
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
          {t('about.copyright')}
        </Text>
      </Box>
    </Stack>
  );
};
