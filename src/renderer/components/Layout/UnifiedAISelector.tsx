import { Select as CustomSelect, type SelectOption } from '@/renderer/components/ui/select';
import { useAIStore } from '@/renderer/store/aiStore';
import { Badge, Flex } from '@chakra-ui/react';
import type { AIProviderType } from '@shared/types';
import { memo, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

const AI_MODEL_OPTIONS: SelectOption[] = [
  { value: 'openai:gpt-5.1', label: 'OpenAI - GPT-5.1' },
  { value: 'openai:gpt-5', label: 'OpenAI - GPT-5' },
  { value: 'openai:gpt-5-pro', label: 'OpenAI - GPT-5 Pro' },
  { value: 'openai:gpt-5-mini', label: 'OpenAI - GPT-5 Mini' },
  { value: 'openai:gpt-5-nano', label: 'OpenAI - GPT-5 Nano' },
  { value: 'openai:o3', label: 'OpenAI - o3 (Reasoning)' },
  { value: 'openai:o3-mini', label: 'OpenAI - o3-mini (Reasoning)' },
  { value: 'openai:o1', label: 'OpenAI - o1 (Reasoning)' },
  { value: 'openai:gpt-4.1', label: 'OpenAI - GPT-4.1' },
  { value: 'openai:gpt-4.1-mini', label: 'OpenAI - GPT-4.1 Mini' },
  { value: 'openai:gpt-4o', label: 'OpenAI - GPT-4o' },
  { value: 'openai:gpt-4o-mini', label: 'OpenAI - GPT-4o Mini' },
  
  { value: 'anthropic:claude-sonnet-4-5', label: 'Claude - 4.5 Sonnet' },
  { value: 'anthropic:claude-haiku-4-5', label: 'Claude - 4.5 Haiku' },
  { value: 'anthropic:claude-opus-4-1', label: 'Claude - 4.1 Opus' },
  { value: 'anthropic:claude-3-5-haiku-20241022', label: 'Claude - 3.5 Haiku' },
  { value: 'anthropic:claude-3-haiku-20240307', label: 'Claude - 3 Haiku' },
  
  { value: 'gemini:gemini-3-pro-preview', label: 'Gemini - 3 Pro Preview' },
  { value: 'gemini:gemini-2.5-pro', label: 'Gemini - 2.5 Pro' },
  { value: 'gemini:gemini-2.5-flash', label: 'Gemini - 2.5 Flash' },
  { value: 'gemini:gemini-2.5-flash-lite', label: 'Gemini - 2.5 Flash-Lite' },
  { value: 'gemini:gemini-2.0-flash', label: 'Gemini - 2.0 Flash' },
  { value: 'gemini:gemini-2.0-flash-exp', label: 'Gemini - 2.0 Flash Exp (FREE)' },
];

interface UnifiedAISelectorProps {
  showBadge?: boolean;
  openUpwards?: boolean;
}

export const UnifiedAISelector = memo(({ showBadge = true, openUpwards = false }: UnifiedAISelectorProps) => {
  const { t } = useTranslation();
  const provider = useAIStore((state) => state.provider);
  const model = useAIStore((state) => state.model);
  const updateSettings = useAIStore((state) => state.updateSettings);

  const currentValue = useMemo(
    () => provider && model ? `${provider}:${model}` : '',
    [provider, model]
  );

  const isConfigured = provider && model;

  const handleChange = useCallback((value: string) => {
    const [newProvider, ...modelParts] = value.split(':');
    const newModel = modelParts.join(':');
    
    if (newProvider && newModel) {
      updateSettings({ 
        provider: newProvider as AIProviderType,
        model: newModel,
      });
    }
  }, [updateSettings]);

  return (
    <Flex align="center" gap={2}>
      <CustomSelect
        value={currentValue}
        onChange={handleChange}
        options={AI_MODEL_OPTIONS}
        placeholder={t('common.selectAiModel')}
        enableSearch
        noWrap
        openUpwards={openUpwards}
      />

      {showBadge && (
        isConfigured ? (
          <Badge colorPalette="green" size="sm" px={2}>
            Ready
          </Badge>
        ) : (
          <Badge colorPalette="gray" size="sm" px={2}>
            Not configured
          </Badge>
        )
      )}
    </Flex>
  );
});

UnifiedAISelector.displayName = 'UnifiedAISelector';
