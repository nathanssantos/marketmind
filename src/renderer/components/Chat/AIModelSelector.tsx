import { Select as CustomSelect, type SelectOption } from '@/renderer/components/ui/select';
import { useAIStore } from '@/renderer/store/aiStore';
import type { AIProviderType } from '@shared/types';
import { memo, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

const MODEL_OPTIONS: SelectOption[] = [
  { value: 'openai:gpt-4o', label: '🤖 GPT-4o' },
  { value: 'openai:gpt-4o-mini', label: '🤖 GPT-4o Mini' },
  
  { value: 'anthropic:claude-sonnet-4-5-20250929', label: '🧠 Claude 4.5 Sonnet' },
  { value: 'anthropic:claude-haiku-4-5-20251001', label: '🧠 Claude 4.5 Haiku' },
  { value: 'anthropic:claude-opus-4-1-20250805', label: '🧠 Claude 4.1 Opus' },
  
  { value: 'gemini:gemini-2.0-flash-exp', label: '✨ Gemini 2.0 Flash Exp (FREE)' },
  { value: 'gemini:gemini-1.5-pro', label: '✨ Gemini 1.5 Pro' },
  { value: 'gemini:gemini-1.5-flash', label: '✨ Gemini 1.5 Flash' },
  { value: 'gemini:gemini-1.5-flash-8b', label: '✨ Gemini 1.5 Flash-8B' },
];

export const AIModelSelector = memo(() => {
  const { t } = useTranslation();
  const settings = useAIStore((state) => state.settings);
  const provider = settings?.provider;
  const model = settings?.model;
  const updateSettings = useAIStore((state) => state.updateSettings);

  const currentValue = useMemo(
    () => (provider && model ? `${provider}:${model}` : ''),
    [provider, model]
  );

  const handleChange = useCallback((value: string) => {
    if (!value) return;
    
    const [newProvider, ...modelParts] = value.split(':');
    const newModel = modelParts.join(':');
    
    updateSettings({
      provider: newProvider as AIProviderType,
      model: newModel,
    });
  }, [updateSettings]);

  return (
    <CustomSelect
      value={currentValue}
      onChange={handleChange}
      options={MODEL_OPTIONS}
      placeholder={t('common.selectAiModel')}
      enableSearch
      noWrap
    />
  );
});

AIModelSelector.displayName = 'AIModelSelector';
