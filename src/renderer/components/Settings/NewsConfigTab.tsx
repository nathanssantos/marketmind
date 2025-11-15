import { Button } from '@/renderer/components/ui/button';
import { Field } from '@/renderer/components/ui/field';
import { Input } from '@/renderer/components/ui/input';
import { Box, Checkbox, Link, Separator, Stack, Text, VStack } from '@chakra-ui/react';
import { useEffect, useState } from 'react';
import { HiEye, HiEyeSlash } from 'react-icons/hi2';

export const NewsConfigTab = () => {
  const [enabled, setEnabled] = useState(false);
  const [newsApiKey, setNewsApiKey] = useState('');
  const [cryptoPanicApiKey, setCryptoPanicApiKey] = useState('');
  const [showNewsApiKey, setShowNewsApiKey] = useState(false);
  const [showCryptoPanicKey, setShowCryptoPanicKey] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(5);
  const [maxArticles, setMaxArticles] = useState(10);
  const [testMessage, setTestMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      // Load API keys from secure storage
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

  const handleSave = async () => {
    setSaving(true);
    try {
      // Save API keys to secure storage
      await Promise.all([
        newsApiKey.trim() 
          ? window.electron.secureStorage.setApiKey('newsapi', newsApiKey.trim())
          : window.electron.secureStorage.deleteApiKey('newsapi'),
        cryptoPanicApiKey.trim() 
          ? window.electron.secureStorage.setApiKey('cryptopanic', cryptoPanicApiKey.trim())
          : window.electron.secureStorage.deleteApiKey('cryptopanic'),
        window.electron.secureStorage.setNewsSettings({
          enabled,
          refreshInterval,
          maxArticles,
        }),
      ]);

      alert('Settings saved successfully! Please restart the app for changes to take effect.');
    } catch (error) {
      console.error('Failed to save news settings:', error);
      alert('Failed to save settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <VStack align="stretch" gap={6}>
      {loading && (
        <Box textAlign="center" py={4}>
          <Text color="fg.muted">Loading settings...</Text>
        </Box>
      )}

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

      {/* NewsAPI */}
      <Box>
        <Text fontSize="lg" fontWeight="semibold" mb={4}>
          NewsAPI Configuration
        </Text>
        
        <Stack gap={4}>
          <Field label="API Key" required>
            <Stack gap={2}>
              <Box position="relative">
                <Input
                  type={showNewsApiKey ? 'text' : 'password'}
                  value={newsApiKey}
                  onChange={(e) => setNewsApiKey(e.target.value)}
                  placeholder="Enter your NewsAPI key"
                  disabled={!enabled}
                  pr="40px"
                />
                <Button
                  position="absolute"
                  right="4px"
                  top="50%"
                  transform="translateY(-50%)"
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowNewsApiKey(!showNewsApiKey)}
                  disabled={!enabled}
                >
                  {showNewsApiKey ? <HiEyeSlash /> : <HiEye />}
                </Button>
              </Box>
              <Text fontSize="sm" color="fg.muted">
                Get your free API key at{' '}
                <Link href="https://newsapi.org/" target="_blank" rel="noopener noreferrer" color="blue.500">
                  newsapi.org
                </Link>
                {' '}(Free tier: 100 requests/day)
              </Text>
            </Stack>
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

      {/* CryptoPanic */}
      <Box>
        <Text fontSize="lg" fontWeight="semibold" mb={4}>
          CryptoPanic Configuration
        </Text>
        
        <Field label="API Key">
          <Stack gap={2}>
            <Box position="relative">
              <Input
                type={showCryptoPanicKey ? 'text' : 'password'}
                value={cryptoPanicApiKey}
                onChange={(e) => setCryptoPanicApiKey(e.target.value)}
                placeholder="Enter CryptoPanic API key or use 'free'"
                disabled={!enabled}
                pr="40px"
              />
              <Button
                position="absolute"
                right="4px"
                top="50%"
                transform="translateY(-50%)"
                size="sm"
                variant="ghost"
                onClick={() => setShowCryptoPanicKey(!showCryptoPanicKey)}
                disabled={!enabled}
              >
                {showCryptoPanicKey ? <HiEyeSlash /> : <HiEye />}
              </Button>
            </Box>
            <Text fontSize="sm" color="fg.muted">
              Get API key at{' '}
              <Link href="https://cryptopanic.com/developers/api/" target="_blank" rel="noopener noreferrer" color="blue.500">
                cryptopanic.com/developers
              </Link>
              {' '}or use "free" for public endpoint
            </Text>
          </Stack>
        </Field>
      </Box>

      <Separator />

      {/* Advanced Settings */}
      <Box>
        <Text fontSize="lg" fontWeight="semibold" mb={4}>
          Advanced Settings
        </Text>
        
        <Stack gap={4}>
          <Field label="Refresh Interval (minutes)">
            <Input
              type="number"
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

          <Field label="Maximum Articles">
            <Input
              type="number"
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

      <Separator />

      {/* Important Notes */}
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
          <Text>• CryptoPanic may have CORS issues in browser (working on solution)</Text>
          <Text>• NewsAPI free tier only works from localhost in development</Text>
          <Text>• Restart app after changing settings</Text>
        </VStack>
      </Box>

      {/* Save Button */}
      <Box>
        <Button
          colorPalette="blue"
          onClick={handleSave}
          width="full"
          size="lg"
          loading={saving}
          disabled={loading}
        >
          {saving ? 'Saving...' : 'Save Configuration'}
        </Button>
      </Box>
    </VStack>
  );
};
