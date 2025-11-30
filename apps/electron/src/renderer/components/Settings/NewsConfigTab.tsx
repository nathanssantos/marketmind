import { Button } from '@/renderer/components/ui/button';
import { Checkbox } from '@/renderer/components/ui/checkbox';
import { Field } from '@/renderer/components/ui/field';
import { NumberInput } from '@/renderer/components/ui/number-input';
import { PasswordInput } from '@/renderer/components/ui/password-input';
import { DEFAULT_NEWS_SETTINGS } from '@/renderer/constants/defaults';
import { useDebounceCallback } from '@/renderer/hooks/useDebounceCallback';
import { Box, Flex, Link, Separator, Stack, Text, VStack } from '@chakra-ui/react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuRefreshCw } from 'react-icons/lu';

export const NewsConfigTab = () => {
  const { t } = useTranslation();
  const [enabled, setEnabled] = useState<boolean>(DEFAULT_NEWS_SETTINGS.enabled);
  const [newsApiKey, setNewsApiKey] = useState<string>('');
  const [cryptoPanicApiKey, setCryptoPanicApiKey] = useState<string>('');
  const [refreshInterval, setRefreshInterval] = useState<number>(DEFAULT_NEWS_SETTINGS.refreshInterval);
  const [maxArticles, setMaxArticles] = useState<number>(DEFAULT_NEWS_SETTINGS.maxArticles);
  const [testMessage, setTestMessage] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const debouncedSaveSettings = useDebounceCallback(
    async (settings: { enabled: boolean; refreshInterval: number; maxArticles: number }) => {
      try {
        await window.electron.secureStorage.setNewsSettings(settings);
      } catch (error) {
        console.error('Failed to save news settings:', error);
      }
    },
    300
  );

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    if (!testMessage) return;

    const timeout = setTimeout(() => setTestMessage(''), 3000);
    return () => clearTimeout(timeout);
  }, [testMessage]);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const [newsKeyResult, cryptoKeyResult, settings] = await Promise.all([
        window.electron.secureStorage.getApiKey('newsapi'),
        window.electron.secureStorage.getApiKey('cryptopanic'),
        window.electron.secureStorage.getNewsSettings(),
      ]);

      const envNewsApiKey = import.meta.env['VITE_NEWSAPI_API_KEY'];
      const envCryptoPanicKey = import.meta.env['VITE_CRYPTOPANIC_API_KEY'];

      if (newsKeyResult.success && newsKeyResult.apiKey) {
        setNewsApiKey(newsKeyResult.apiKey);
      } else if (envNewsApiKey) {
        setNewsApiKey(envNewsApiKey);
        await window.electron.secureStorage.setApiKey('newsapi', envNewsApiKey);
      }

      if (cryptoKeyResult.success && 'apiKey' in cryptoKeyResult && cryptoKeyResult.apiKey) {
        setCryptoPanicApiKey(cryptoKeyResult.apiKey);
      } else if (envCryptoPanicKey) {
        setCryptoPanicApiKey(envCryptoPanicKey);
        await window.electron.secureStorage.setApiKey('cryptopanic', envCryptoPanicKey);
      }

      setEnabled(settings.enabled);
      setRefreshInterval(settings.refreshInterval);
      setMaxArticles(settings.maxArticles);
    } catch (error) {
      console.error('Failed to load news settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveNewsApiKey = async () => {
    if (!newsApiKey.trim()) return;

    try {
      await window.electron.secureStorage.setApiKey('newsapi', newsApiKey.trim());
      setTestMessage(t('settings.news.newsApiKeySaved'));
    } catch (error) {
      console.error('Failed to save NewsAPI key:', error);
      setTestMessage(t('settings.news.newsApiKeyFailed'));
    }
  };

  const handleSaveCryptoPanicKey = async () => {
    if (!cryptoPanicApiKey.trim()) return;

    try {
      await window.electron.secureStorage.setApiKey('cryptopanic', cryptoPanicApiKey.trim());
      alert(t('settings.news.cryptoPanicKeySaved'));
    } catch (error) {
      console.error('Failed to save CryptoPanic key:', error);
      alert(t('settings.news.cryptoPanicKeyFailed'));
    }
  };

  const handleTestNewsAPI = async () => {
    if (!newsApiKey.trim()) {
      setTestMessage(t('settings.news.enterKeyFirst'));
      return;
    }

    setTestMessage(t('settings.news.testingConnection'));

    try {
      const response = await fetch(
        `https://newsapi.org/v2/everything?q=bitcoin&apiKey=${newsApiKey.trim()}&pageSize=1`
      );

      if (response.ok) {
        setTestMessage(t('settings.news.connectionSuccessful'));
      } else {
        const data = await response.json();
        setTestMessage(t('settings.news.connectionError', { message: data.message || t('settings.news.invalidApiKey') }));
      }
    } catch (error) {
      setTestMessage(t('settings.news.connectionFailed'));
    }
  };

  const handleEnabledChange = (checked: boolean) => {
    setEnabled(checked);
    debouncedSaveSettings({ enabled: checked, refreshInterval, maxArticles });
  };

  const handleRefreshIntervalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Math.max(1, Math.min(60, parseInt(e.target.value) || DEFAULT_NEWS_SETTINGS.refreshInterval));
    setRefreshInterval(value);
    debouncedSaveSettings({ enabled, refreshInterval: value, maxArticles });
  };

  const handleMaxArticlesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Math.max(5, Math.min(50, parseInt(e.target.value) || DEFAULT_NEWS_SETTINGS.maxArticles));
    setMaxArticles(value);
    debouncedSaveSettings({ enabled, refreshInterval, maxArticles: value });
  };

  const handleReset = () => {
    setEnabled(DEFAULT_NEWS_SETTINGS.enabled);
    setRefreshInterval(DEFAULT_NEWS_SETTINGS.refreshInterval);
    setMaxArticles(DEFAULT_NEWS_SETTINGS.maxArticles);
    window.electron.secureStorage.setNewsSettings(DEFAULT_NEWS_SETTINGS);
  };

  return (
    <VStack align="stretch" gap={6}>
      {loading && (
        <Box textAlign="center" py={4}>
          <Text color="fg.muted">{t('settings.news.loadingSettings')}</Text>
        </Box>
      )}

      <Box
        bg="orange.500/10"
        p={4}
        borderRadius="md"
        borderLeft="4px solid"
        borderColor="orange.500"
      >
        <Text fontSize="sm" fontWeight="semibold" mb={2}>
          ⚠️ {t('settings.news.importantNotes')}
        </Text>
        <VStack align="start" gap={1} fontSize="sm" color="fg.muted">
          <Text>• {t('settings.news.noteEncryption')}</Text>
          <Text>• {t('settings.news.noteFreeTier')}</Text>
          <Text>• {t('settings.news.noteRestart')}</Text>
        </VStack>
      </Box>

      <Separator />

      <Box>
        <Checkbox checked={enabled} onCheckedChange={handleEnabledChange}>
          <Text fontWeight="medium">{t('settings.news.enableNewsIntegration')}</Text>
        </Checkbox>
        <Text fontSize="sm" color="fg.muted" mt={2}>
          {t('settings.news.newsIntegrationDescription')}
        </Text>
      </Box>

      <Separator />

      <Box>
        <Text fontSize="lg" fontWeight="semibold" mb={4}>
          {t('settings.news.newsApiConfiguration')}
        </Text>

        <Stack gap={4}>
          <Field label={t('settings.news.newsApiKey')} required>
            <Flex gap={2}>
              <PasswordInput
                value={newsApiKey}
                onChange={(e) => setNewsApiKey(e.target.value)}
                placeholder={t('settings.news.newsApiKeyPlaceholder')}
                disabled={!enabled}
                flex={1}
              />
              <Button
                onClick={handleSaveNewsApiKey}
                disabled={!newsApiKey.trim() || !enabled}
                size="sm"
              >
                {t('common.save')}
              </Button>
            </Flex>
            <Text fontSize="sm" color="fg.muted" mt={2}>
              {t('settings.news.getFreeApiKey')}{' '}
              <Link href="https://newsapi.org/" target="_blank" rel="noopener noreferrer" color="blue.500">
                newsapi.org
              </Link>
              {' '}{t('settings.news.freeTierLimit')}
            </Text>
          </Field>

          <Stack direction="row" gap={2}>
            <Button
              size="sm"
              variant="outline"
              onClick={handleTestNewsAPI}
              disabled={!enabled || !newsApiKey.trim()}
            >
              {t('settings.news.testConnection')}
            </Button>
            {testMessage && (
              <Text fontSize="sm" alignSelf="center">
                {testMessage}
              </Text>
            )}
          </Stack>
        </Stack>
      </Box>

      <Separator />

      <Box>
        <Text fontSize="lg" fontWeight="semibold" mb={4}>
          {t('settings.news.cryptoPanicConfiguration')}
        </Text>

        <Field label={t('settings.news.cryptoPanicApiKey')}>
          <Flex gap={2}>
            <PasswordInput
              value={cryptoPanicApiKey}
              onChange={(e) => setCryptoPanicApiKey(e.target.value)}
              placeholder={t('settings.news.cryptoPanicApiKeyPlaceholder')}
              disabled={!enabled}
              flex={1}
            />
            <Button
              onClick={handleSaveCryptoPanicKey}
              disabled={!cryptoPanicApiKey.trim() || !enabled}
              size="sm"
            >
              {t('common.save')}
            </Button>
          </Flex>
          <Text fontSize="sm" color="fg.muted" mt={2}>
            {t('settings.news.getApiKeyAt')}{' '}
            <Link href="https://cryptopanic.com/developers/api/" target="_blank" rel="noopener noreferrer" color="blue.500">
              cryptopanic.com/developers
            </Link>
            {' '}{t('settings.news.orUseFree')}
          </Text>
        </Field>
      </Box>

      <Separator />

      <Box>
        <Text fontSize="lg" fontWeight="semibold" mb={4}>
          {t('settings.news.advancedSettings')}
        </Text>

        <Stack gap={4}>
          <Field label={t('settings.news.refreshInterval')}>
            <NumberInput
              min={1}
              max={60}
              value={refreshInterval}
              onChange={handleRefreshIntervalChange}
              disabled={!enabled}
            />
            <Text fontSize="sm" color="fg.muted" mt={1}>
              {t('settings.news.refreshIntervalHelper')}
            </Text>
          </Field>

          <Field label={t('settings.news.maxArticles')}>
            <NumberInput
              min={5}
              max={50}
              value={maxArticles}
              onChange={handleMaxArticlesChange}
              disabled={!enabled}
            />
            <Text fontSize="sm" color="fg.muted" mt={1}>
              {t('settings.news.maxArticlesHelper')}
            </Text>
          </Field>

          <Button
            variant="outline"
            onClick={handleReset}
          >
            <LuRefreshCw />
            {t('settings.resetToDefaults')}
          </Button>
        </Stack>
      </Box>
    </VStack>
  );
};
