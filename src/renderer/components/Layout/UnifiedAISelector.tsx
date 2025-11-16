import { Select as CustomSelect, type SelectOption } from '@/renderer/components/ui/select';
import { useAIStore } from '@/renderer/store/aiStore';
import { Badge, Flex } from '@chakra-ui/react';
import type { AIProviderType } from '@shared/types';
import { memo, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

const AI_MODEL_OPTIONS: SelectOption[] = [
  { value: 'openai:gpt-4o', label: 'OpenAI - GPT-4o' },
  { value: 'openai:gpt-4o-mini', label: 'OpenAI - GPT-4o Mini' },
  
  { value: 'anthropic:claude-sonnet-4-5-20250929', label: 'Claude - 4.5 Sonnet' },
  { value: 'anthropic:claude-haiku-4-5-20251001', label: 'Claude - 4.5 Haiku' },
  { value: 'anthropic:claude-opus-4-1-20250805', label: 'Claude - 4.1 Opus' },
  
  { value: 'gemini:gemini-2.0-flash-exp', label: 'Gemini - 2.0 Flash Exp (FREE)' },
  { value: 'gemini:gemini-1.5-pro', label: 'Gemini - 1.5 Pro' },
  { value: 'gemini:gemini-1.5-flash', label: 'Gemini - 1.5 Flash' },
  { value: 'gemini:gemini-1.5-flash-8b', label: 'Gemini - 1.5 Flash-8B' },
];

interface UnifiedAISelectorProps {
  showBadge?: boolean;
  openUpwards?: boolean;
}

export const UnifiedAISelector = memo(({ showBadge = true, openUpwards = false }: UnifiedAISelectorProps) => {
  const { t } = useTranslation();
  const settings = useAIStore((state) => state.settings);
  const provider = settings?.provider;
  const model = settings?.model;
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
