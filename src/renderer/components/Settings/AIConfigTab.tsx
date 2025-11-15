import { Field } from '@/renderer/components/ui/field';
import { Select } from '@/renderer/components/ui/select';
import { Slider } from '@/renderer/components/ui/slider';
import { useSecureStorage } from '@/renderer/hooks/useSecureStorage';
import { useAIStore } from '@/renderer/store';
import {
    Box,
    Flex,
    Input,
    Separator,
    Spinner,
    Stack,
    Text,
} from '@chakra-ui/react';
import type { AIProviderType } from '@shared/types';
import { useEffect, useMemo, useState } from 'react';

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
    apiKey, 
    isLoading: isLoadingApiKey, 
    error: apiKeyError,
    isEncryptionAvailable,
    setApiKey: setSecureApiKey,
  } = useSecureStorage();

  const [localApiKey, setLocalApiKey] = useState('');

  const provider = settings?.provider || 'gemini';
  const model = settings?.model || DEFAULT_MODELS[provider];
  const temperature = settings?.temperature ?? 0.7;
  const maxTokens = settings?.maxTokens ?? 4096;

  useEffect(() => {
    if (apiKey && !isLoadingApiKey) {
      setLocalApiKey(apiKey);
    }
  }, [apiKey, isLoadingApiKey]);

  const apiKeyEnvVar = useMemo(() => {
    const envVars: Record<AIProviderType, string> = {
      openai: 'VITE_OPENAI_API_KEY',
      anthropic: 'VITE_ANTHROPIC_API_KEY',
      gemini: 'VITE_GEMINI_API_KEY',
    };
    return envVars[provider];
  }, [provider]);

  const envApiKey = useMemo(() => {
    return import.meta.env[apiKeyEnvVar] as string | undefined;
  }, [apiKeyEnvVar]);

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

  const handleApiKeyChange = async (newApiKey: string) => {
    setLocalApiKey(newApiKey);
    
    try {
      await setSecureApiKey(newApiKey);
    } catch (error) {
      console.error('Failed to save API key:', error);
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

  return (
    <Stack gap={6}>
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

      <Box>
        <Field label="API Key" required helperText={envApiKey ? `Using ${apiKeyEnvVar} from .env` : undefined}>
          {isLoadingApiKey ? (
            <Flex align="center" gap={2} p={2}>
              <Spinner size="sm" />
              <Text fontSize="sm" color="fg.muted">Loading API key...</Text>
            </Flex>
          ) : (
            <Input
              type="password"
              value={localApiKey}
              onChange={(e) => handleApiKeyChange(e.target.value)}
              placeholder={envApiKey || `Enter your ${provider} API key`}
            />
          )}
        </Field>
        {apiKeyError && (
          <Text fontSize="sm" color="red.500" mt={2}>
            {apiKeyError}
          </Text>
        )}
        {!isEncryptionAvailable && (
          <Text fontSize="sm" color="orange.500" mt={2}>
            Warning: Encryption not available on this platform
          </Text>
        )}
      </Box>

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

      <Box bg="bg.muted" p={4} borderRadius="md">
        <Text fontSize="sm" fontWeight="medium" mb={2}>
          Quick Tips
        </Text>
        <Stack gap={2} fontSize="sm" color="fg.muted">
          <Text>• Lower temperature (0-0.5) for technical analysis</Text>
          <Text>• Higher temperature (0.7-1.5) for creative insights</Text>
          <Text>• Gemini 2.0 Flash Exp is FREE with no API key required</Text>
          <Text>• Store API keys in .env file for security</Text>
        </Stack>
      </Box>
    </Stack>
  );
};
