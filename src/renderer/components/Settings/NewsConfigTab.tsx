import { Button } from '@/renderer/components/ui/button';
import { Field } from '@/renderer/components/ui/field';
import { NumberInput } from '@/renderer/components/ui/number-input';
import { PasswordInput } from '@/renderer/components/ui/password-input';
import { Box, Checkbox, Flex, Link, Separator, Stack, Text, VStack } from '@chakra-ui/react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

export const NewsConfigTab = () => {
  const { t } = useTranslation();
  const [enabled, setEnabled] = useState(false);
  const [newsApiKey, setNewsApiKey] = useState('');
  const [cryptoPanicApiKey, setCryptoPanicApiKey] = useState('');
  const [refreshInterval, setRefreshInterval] = useState(5);
  const [maxArticles, setMaxArticles] = useState(10);
  const [testMessage, setTestMessage] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const [newsKeyResult, cryptoKeyResult, settings] = await Promise.all([
        window.electron.secureStorage.getApiKey('newsapi'),
        window.electron.secureStorage.getApiKey('cryptopanic'),
        window.electron.secureStorage.getNewsSettings(),
      ]);

      if (newsKeyResult.success && newsKeyResult.apiKey) {
        setNewsApiKey(newsKeyResult.apiKey);
      }
      if (cryptoKeyResult.success && cryptoKeyResult.apiKey) {
        setCryptoPanicApiKey(cryptoKeyResult.apiKey);
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
      setTestMessage('✅ NewsAPI key saved successfully!');
      setTimeout(() => setTestMessage(''), 3000);
    } catch (error) {
      console.error('Failed to save NewsAPI key:', error);
      setTestMessage('❌ Failed to save NewsAPI key');
    }
  };

  const handleSaveCryptoPanicKey = async () => {
    if (!cryptoPanicApiKey.trim()) return;

    try {
      await window.electron.secureStorage.setApiKey('cryptopanic', cryptoPanicApiKey.trim());
      alert('CryptoPanic API key saved successfully!');
    } catch (error) {
      console.error('Failed to save CryptoPanic key:', error);
      alert('Failed to save CryptoPanic API key');
    }
  };

  const handleTestNewsAPI = async () => {
    if (!newsApiKey.trim()) {
      setTestMessage('⚠️ Please enter a NewsAPI key first');
      return;
    }

    setTestMessage('Testing connection...');
    
    try {
      const response = await fetch(
        `https://newsapi.org/v2/everything?q=bitcoin&apiKey=${newsApiKey.trim()}&pageSize=1`
      );

      if (response.ok) {
        setTestMessage('✅ NewsAPI connection successful!');
      } else {
        const data = await response.json();
        setTestMessage(`❌ Error: ${data.message || 'Invalid API key'}`);
      }
    } catch (error) {
      setTestMessage('❌ Connection failed. Check your internet connection.');
    }
  };

  return (
    <VStack align="stretch" gap={6}>
      {loading && (
        <Box textAlign="center" py={4}>
          <Text color="fg.muted">Loading settings...</Text>
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
          ⚠️ Important Notes
        </Text>
        <VStack align="start" gap={1} fontSize="sm" color="fg.muted">
          <Text>• API keys are encrypted and stored securely using OS-level encryption</Text>
          <Text>• Free tier limits: NewsAPI (100 req/day), CryptoPanic (varies)</Text>
          <Text>• Restart app after changing settings for full effect</Text>
        </VStack>
      </Box>

      <Separator />

      <Box>
        <Checkbox.Root checked={enabled} onCheckedChange={(e) => setEnabled(!!e.checked)}>
          <Checkbox.HiddenInput />
          <Checkbox.Control>
            <Checkbox.Indicator />
          </Checkbox.Control>
          <Checkbox.Label>
            <Text fontWeight="medium">Enable News Integration</Text>
          </Checkbox.Label>
        </Checkbox.Root>
        <Text fontSize="sm" color="fg.muted" mt={2}>
          Integrate financial news into AI analysis for better market insights
        </Text>
      </Box>

      <Separator />

      <Box>
        <Text fontSize="lg" fontWeight="semibold" mb={4}>
          NewsAPI Configuration
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
              Get your free API key at{' '}
              <Link href="https://newsapi.org/" target="_blank" rel="noopener noreferrer" color="blue.500">
                newsapi.org
              </Link>
              {' '}(Free tier: 100 requests/day)
            </Text>
          </Field>

          <Stack direction="row" gap={2}>
            <Button
              size="sm"
              variant="outline"
              onClick={handleTestNewsAPI}
              disabled={!enabled || !newsApiKey.trim()}
            >
              Test Connection
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
          CryptoPanic Configuration
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
            Get API key at{' '}
            <Link href="https://cryptopanic.com/developers/api/" target="_blank" rel="noopener noreferrer" color="blue.500">
              cryptopanic.com/developers
            </Link>
            {' '}or use "free" for public endpoint
          </Text>
        </Field>
      </Box>

      <Separator />

      <Box>
        <Text fontSize="lg" fontWeight="semibold" mb={4}>
          Advanced Settings
        </Text>
        
        <Stack gap={4}>
          <Field label={t('settings.news.refreshInterval')}>
            <NumberInput
              min={1}
              max={60}
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(Math.max(1, Math.min(60, parseInt(e.target.value) || 5)))}
              disabled={!enabled}
            />
            <Text fontSize="sm" color="fg.muted" mt={1}>
              How often to fetch new articles (1-60 minutes)
            </Text>
          </Field>

          <Field label={t('settings.news.maxArticles')}>
            <NumberInput
              min={5}
              max={50}
              value={maxArticles}
              onChange={(e) => setMaxArticles(Math.max(5, Math.min(50, parseInt(e.target.value) || 10)))}
              disabled={!enabled}
            />
            <Text fontSize="sm" color="fg.muted" mt={1}>
              Maximum number of articles to fetch (5-50)
            </Text>
          </Field>
        </Stack>
      </Box>
    </VStack>
  );
};
