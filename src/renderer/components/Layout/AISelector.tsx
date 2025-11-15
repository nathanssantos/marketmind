import { useAIStore } from '@/renderer/store/aiStore';
import { Badge, createListCollection, Flex, Select } from '@chakra-ui/react';
import type { AIProviderType } from '@shared/types';
import { useMemo } from 'react';

interface ModelOption {
  value: string;
  label: string;
}

const PROVIDER_OPTIONS: Array<{ value: AIProviderType; label: string }> = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Claude' },
  { value: 'gemini', label: 'Gemini' },
];

const MODEL_OPTIONS: Record<AIProviderType, ModelOption[]> = {
  openai: [
    { value: 'gpt-4o', label: 'GPT-4o' },
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
  ],
  anthropic: [
    { value: 'claude-sonnet-4-5-20250929', label: 'Claude 4.5 Sonnet' },
    { value: 'claude-haiku-4-5-20251001', label: 'Claude 4.5 Haiku' },
    { value: 'claude-opus-4-1-20250805', label: 'Claude 4.1 Opus' },
  ],
  gemini: [
    { value: 'gemini-2.0-flash-exp', label: 'Gemini 2.0 Flash Exp (FREE)' },
    { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
    { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
    { value: 'gemini-1.5-flash-8b', label: 'Gemini 1.5 Flash-8B' },
  ],
};

export const AISelector = () => {
  const settings = useAIStore((state) => state.settings);
  const provider = settings?.provider;
  const model = settings?.model;
  const updateSettings = useAIStore((state) => state.updateSettings);

  const modelOptions = useMemo(
    () => (provider ? MODEL_OPTIONS[provider] : []),
    [provider]
  );

  const isConfigured = provider && model;

  const providerCollection = useMemo(
    () => createListCollection({ items: PROVIDER_OPTIONS }),
    []
  );

  const modelCollection = useMemo(
    () => createListCollection({ items: modelOptions }),
    [modelOptions]
  );

  const handleProviderChange = (details: { value: string[] }) => {
    const newProvider = details.value[0] as AIProviderType;
    const defaultModel = MODEL_OPTIONS[newProvider]?.[0]?.value;
    
    if (defaultModel) {
      updateSettings({ 
        provider: newProvider,
        model: defaultModel,
      });
    }
  };

  const handleModelChange = (details: { value: string[] }) => {
    const newModel = details.value[0];
    if (newModel) {
      updateSettings({ model: newModel });
    }
  };

  return (
    <Flex align="center" gap={2}>
      <Select.Root
        collection={providerCollection}
        value={provider ? [provider] : []}
        onValueChange={handleProviderChange}
        size="sm"
        width="140px"
        positioning={{ 
          sameWidth: true,
          placement: 'bottom-start',
        }}
      >
        <Select.Trigger>
          <Select.ValueText placeholder="Select AI" />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Positioner>
          <Select.Content>
            {PROVIDER_OPTIONS.map((option) => (
              <Select.Item key={option.value} item={option.value}>
                <Select.ItemText>{option.label}</Select.ItemText>
                <Select.ItemIndicator>✓</Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Content>
        </Select.Positioner>
      </Select.Root>

      {provider && (
        <Select.Root
          collection={modelCollection}
          value={model ? [model] : []}
          onValueChange={handleModelChange}
          size="sm"
          width="200px"
          positioning={{ 
            sameWidth: true,
            placement: 'bottom-start',
          }}
        >
          <Select.Trigger>
            <Select.ValueText placeholder="Select Model" />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Positioner>
            <Select.Content>
              {modelOptions.map((option) => (
                <Select.Item key={option.value} item={option.value}>
                  <Select.ItemText>{option.label}</Select.ItemText>
                  <Select.ItemIndicator>✓</Select.ItemIndicator>
                </Select.Item>
              ))}
            </Select.Content>
          </Select.Positioner>
        </Select.Root>
      )}

      {isConfigured ? (
        <Badge colorPalette="green" size="sm" px={2}>
          Ready
        </Badge>
      ) : (
        <Badge colorPalette="gray" size="sm" px={2}>
          Not configured
        </Badge>
      )}
    </Flex>
  );
};
