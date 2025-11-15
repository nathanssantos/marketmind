import { Button } from '@/renderer/components/ui/button';
import { Field } from '@/renderer/components/ui/field';
import { PasswordInput } from '@/renderer/components/ui/password-input';
import { Select } from '@/renderer/components/ui/select';
import { Slider } from '@/renderer/components/ui/slider';
import { useSecureStorage } from '@/renderer/hooks/useSecureStorage';
import { useAIStore } from '@/renderer/store';
import {
  Box,
  Flex,
  Separator,
  Spinner,
  Stack,
  Text,
} from '@chakra-ui/react';
import type { AIProviderType } from '@shared/types';
import { useEffect, useState } from 'react';

type AIProvider = 'openai' | 'anthropic' | 'gemini';

const PROVIDER_MODELS: Record<AIProviderType, Array<{ value: string; label: string; pricing: string }>> = {
  openai: [
    { value: 'gpt-4o', label: 'GPT-4o', pricing: '$2.50/$10 per 1M tokens' },
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini', pricing: '$0.15/$0.60 per 1M tokens' },
  ],
  anthropic: [
    { value: 'claude-sonnet-4-5-20250929', label: 'Claude 4.5 Sonnet', pricing: '$3/$15 per 1M tokens' },
    { value: 'claude-haiku-4-5-20251001', label: 'Claude 4.5 Haiku', pricing: '$1/$5 per 1M tokens' },
    { value: 'claude-opus-4-1-20250805', label: 'Claude 4.1 Opus', pricing: '$15/$75 per 1M tokens' },
  ],
  gemini: [
    { value: 'gemini-2.0-flash-exp', label: 'Gemini 2.0 Flash Exp', pricing: 'FREE' },
    { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro', pricing: '$1.25/$5 per 1M tokens' },
    { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash', pricing: '$0.075/$0.30 per 1M tokens' },
    { value: 'gemini-1.5-flash-8b', label: 'Gemini 1.5 Flash-8B', pricing: '$0.0375/$0.15 per 1M tokens' },
  ],
};

const DEFAULT_MODELS: Record<AIProviderType, string> = {
  openai: 'gpt-4o',
  anthropic: 'claude-sonnet-4-5-20250929',
  gemini: 'gemini-2.0-flash-exp',
};

export const AIConfigTab = () => {
  const { settings, updateSettings } = useAIStore();
  const { 
    loading: isLoadingSecureStorage,
    error: secureStorageError,
    isEncryptionAvailable,
    setApiKey: setSecureApiKey,
    getApiKey,
  } = useSecureStorage();

  const [apiKeys, setApiKeys] = useState<Record<AIProvider, string>>({
    openai: '',
    anthropic: '',
    gemini: '',
  });
  const [isLoadingKeys, setIsLoadingKeys] = useState(true);

  const provider = settings?.provider || 'gemini';
  const model = settings?.model || DEFAULT_MODELS[provider];
  const temperature = settings?.temperature ?? 0.7;
  const maxTokens = settings?.maxTokens ?? 4096;

  useEffect(() => {
    const loadApiKeys = async () => {
      setIsLoadingKeys(true);
      try {
        const [openaiKey, anthropicKey, geminiKey] = await Promise.all([
          getApiKey('openai'),
          getApiKey('anthropic'),
          getApiKey('gemini'),
        ]);

        setApiKeys({
          openai: openaiKey || '',
          anthropic: anthropicKey || '',
          gemini: geminiKey || '',
        });
      } catch (error) {
        console.error('Failed to load API keys:', error);
      } finally {
        setIsLoadingKeys(false);
      }
    };

    loadApiKeys();
  }, [getApiKey]);

  const modelOptions = PROVIDER_MODELS[provider];

  const handleProviderChange = (newProvider: AIProviderType) => {
    updateSettings({
      provider: newProvider,
      model: DEFAULT_MODELS[newProvider],
    });
  };

  const handleModelChange = (newModel: string) => {
    updateSettings({ model: newModel });
  };

  const handleApiKeyChange = (provider: AIProvider, value: string) => {
    setApiKeys((prev) => ({
      ...prev,
      [provider]: value,
    }));
  };

  const handleSaveApiKey = async (provider: AIProvider) => {
    const key = apiKeys[provider];
    if (!key) return;

    try {
      const success = await setSecureApiKey(provider, key);
      if (success) {
        console.log(`${provider} API key saved successfully`);
      }
    } catch (error) {
      console.error(`Failed to save ${provider} API key:`, error);
    }
  };

  const handleTemperatureChange = (value: number[]) => {
    if (value[0] !== undefined) {
      updateSettings({ temperature: value[0] });
    }
  };

  const handleMaxTokensChange = (value: number[]) => {
    if (value[0] !== undefined) {
      updateSettings({ maxTokens: value[0] });
    }
  };

  const renderApiKeyInput = (provider: AIProvider, label: string) => {
    const envVar = `VITE_${provider.toUpperCase()}_API_KEY`;
    const envKey = import.meta.env[envVar] as string | undefined;

    return (
      <Box key={provider}>
        <Field 
          label={`${label} API Key`} 
          helperText={envKey ? `Using ${envVar} from .env` : undefined}
        >
          {isLoadingKeys ? (
            <Flex align="center" gap={2} p={2}>
              <Spinner size="sm" />
              <Text fontSize="sm" color="fg.muted">Loading...</Text>
            </Flex>
          ) : (
            <Flex gap={2}>
              <PasswordInput
                value={apiKeys[provider]}
                onChange={(e) => handleApiKeyChange(provider, e.target.value)}
                placeholder={envKey || `Enter your ${label} API key`}
                flex={1}
              />
              <Button
                onClick={() => handleSaveApiKey(provider)}
                disabled={!apiKeys[provider] || isLoadingSecureStorage}
                size="sm"
              >
                Save
              </Button>
            </Flex>
          )}
        </Field>
      </Box>
    );
  };

  return (
    <Stack gap={6}>
      <Box 
        bg="blue.500/10" 
        p={4} 
        borderRadius="md"
        borderLeft="4px solid"
        borderColor="blue.500"
      >
        <Text fontSize="sm" fontWeight="semibold" mb={2}>
          💡 Quick Tips
        </Text>
        <Stack gap={1} fontSize="sm" color="fg.muted">
          <Text>• API keys are encrypted and stored securely using OS-level encryption</Text>
          <Text>• Lower temperature (0-0.5) for technical analysis</Text>
          <Text>• Higher temperature (0.7-1.5) for creative insights</Text>
          <Text>• Gemini 2.0 Flash Exp is FREE with no API key required</Text>
        </Stack>
      </Box>

      <Separator />

      <Box>
        <Field label="AI Provider" required>
          <Select
            value={provider}
            onChange={(value) => handleProviderChange(value as AIProviderType)}
            options={[
              { value: 'openai', label: 'OpenAI' },
              { value: 'anthropic', label: 'Anthropic (Claude)' },
              { value: 'gemini', label: 'Google Gemini' },
            ]}
          />
        </Field>
      </Box>

      <Box>
        <Field label="Model" required>
          <Select
            value={model}
            onChange={handleModelChange}
            options={modelOptions.map((option) => ({
              value: option.value,
              label: option.label,
              description: option.pricing,
            }))}
            enableSearch
          />
        </Field>
      </Box>

      <Separator />

      <Stack gap={4}>
        <Text fontWeight="medium" fontSize="sm">
          API Keys (Encrypted)
        </Text>
        
        {renderApiKeyInput('openai', 'OpenAI')}
        {renderApiKeyInput('anthropic', 'Anthropic')}
        {renderApiKeyInput('gemini', 'Google Gemini')}

        {secureStorageError && (
          <Text fontSize="sm" color="red.500">
            {secureStorageError}
          </Text>
        )}
        {!isEncryptionAvailable && (
          <Text fontSize="sm" color="orange.500">
            Warning: Encryption not available on this platform
          </Text>
        )}
      </Stack>

      <Separator />

      <Box>
        <Field label={`Temperature: ${temperature.toFixed(2)}`} helperText="Controls randomness (0 = focused, 2 = creative)">
          <Slider
            value={[temperature]}
            onValueChange={handleTemperatureChange}
            min={0}
            max={2}
            step={0.1}
            width="full"
          />
        </Field>
      </Box>

      <Box>
        <Field label={`Max Tokens: ${maxTokens.toLocaleString()}`} helperText="Maximum response length">
          <Slider
            value={[maxTokens]}
            onValueChange={handleMaxTokensChange}
            min={256}
            max={16384}
            step={256}
            width="full"
          />
        </Field>
      </Box>
    </Stack>
  );
};
