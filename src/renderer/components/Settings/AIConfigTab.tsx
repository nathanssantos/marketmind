import { Field } from '@/renderer/components/ui/field';
import { Slider } from '@/renderer/components/ui/slider';
import { useAIStore } from '@/renderer/store';
import {
    Box,
    Flex,
    Input,
    NativeSelectField,
    NativeSelectRoot,
    Separator,
    Stack,
    Text,
} from '@chakra-ui/react';
import type { AIProviderType } from '@shared/types';
import { useMemo } from 'react';
import { HiInformationCircle } from 'react-icons/hi2';

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

  const provider = settings?.provider || 'gemini';
  const apiKey = settings?.apiKey || '';
  const model = settings?.model || DEFAULT_MODELS[provider];
  const temperature = settings?.temperature ?? 0.7;
  const maxTokens = settings?.maxTokens ?? 4096;

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
  const selectedModel = modelOptions.find((m) => m.value === model);

  const handleProviderChange = (newProvider: AIProviderType) => {
    updateSettings({
      provider: newProvider,
      model: DEFAULT_MODELS[newProvider],
      apiKey: import.meta.env[`VITE_${newProvider.toUpperCase()}_API_KEY`] as string | undefined || apiKey,
    });
  };

  const handleModelChange = (newModel: string) => {
    updateSettings({ model: newModel });
  };

  const handleApiKeyChange = (newApiKey: string) => {
    updateSettings({ apiKey: newApiKey });
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
          <NativeSelectRoot>
            <NativeSelectField
              value={provider}
              onChange={(e) => handleProviderChange(e.target.value as AIProviderType)}
            >
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic (Claude)</option>
              <option value="gemini">Google Gemini</option>
            </NativeSelectField>
          </NativeSelectRoot>
        </Field>
      </Box>

      <Box>
        <Field label="Model" required>
          <NativeSelectRoot>
            <NativeSelectField value={model} onChange={(e) => handleModelChange(e.target.value)}>
              {modelOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </NativeSelectField>
          </NativeSelectRoot>
        </Field>
        {selectedModel && (
          <Flex align="center" gap={2} mt={2}>
            <HiInformationCircle size={16} />
            <Text fontSize="sm" color="fg.muted">
              {selectedModel.pricing}
            </Text>
          </Flex>
        )}
      </Box>

      <Box>
        <Field label="API Key" required helperText={envApiKey ? `Using ${apiKeyEnvVar} from .env` : undefined}>
          <Input
            type="password"
            value={apiKey}
            onChange={(e) => handleApiKeyChange(e.target.value)}
            placeholder={envApiKey || `Enter your ${provider} API key`}
          />
        </Field>
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
