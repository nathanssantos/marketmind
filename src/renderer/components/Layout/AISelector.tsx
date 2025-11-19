import { Select as CustomSelect, type SelectOption } from '@/renderer/components/ui/select';
import { useAIStore } from '@/renderer/store/aiStore';
import { Badge, Flex } from '@chakra-ui/react';
import type { AIProviderType } from '@shared/types';
import { memo, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

const PROVIDER_OPTIONS: SelectOption[] = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Claude' },
  { value: 'gemini', label: 'Gemini' },
];

const MODEL_OPTIONS: Record<AIProviderType, SelectOption[]> = {
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
    { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
    { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
    { value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash-Lite' },
    { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
    { value: 'gemini-2.0-flash-exp', label: 'Gemini 2.0 Flash Exp (FREE)' },
  ],
};

export const AISelector = memo(() => {
  const { t } = useTranslation();
  const settings = useAIStore((state) => state.settings);
  const provider = settings?.provider;
  const model = settings?.model;
  const updateSettings = useAIStore((state) => state.updateSettings);

  const modelOptions = useMemo(
    () => (provider ? MODEL_OPTIONS[provider] : []),
    [provider]
  );

  const isConfigured = provider && model;

  const handleProviderChange = useCallback((value: string) => {
    const newProvider = value as AIProviderType;
    const defaultModel = MODEL_OPTIONS[newProvider]?.[0]?.value;
    
    if (defaultModel) {
      updateSettings({ 
        provider: newProvider,
        model: defaultModel,
      });
    }
  }, [updateSettings]);

  const handleModelChange = useCallback((value: string) => {
    if (value) {
      updateSettings({ model: value });
    }
  }, [updateSettings]);

  return (
    <Flex align="center" gap={2}>
      <CustomSelect
        value={provider || ''}
        onChange={handleProviderChange}
        options={PROVIDER_OPTIONS}
        placeholder={t('common.selectAi')}
      />

      {provider && (
        <CustomSelect
          value={model || ''}
          onChange={handleModelChange}
          options={modelOptions}
          placeholder={t('common.selectModel')}
          enableSearch
          noWrap
        />
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
});

AISelector.displayName = 'AISelector';
