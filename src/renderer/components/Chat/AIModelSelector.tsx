import { Select as CustomSelect, type SelectOption } from '@/renderer/components/ui/select';
import { useAIStore } from '@/renderer/store/aiStore';
import type { AIProviderType } from '@shared/types';
import { memo, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

const MODEL_OPTIONS: SelectOption[] = [
  { value: 'openai:gpt-5.1', label: '🤖 GPT-5.1 💎' },
  { value: 'openai:gpt-5', label: '🤖 GPT-5 🌟' },
  { value: 'openai:gpt-5-pro', label: '🤖 GPT-5 Pro' },
  { value: 'openai:gpt-5-mini', label: '🤖 GPT-5 Mini' },
  { value: 'openai:gpt-5-nano', label: '🤖 GPT-5 Nano' },
  { value: 'openai:o3', label: '🤖 o3 (Reasoning)' },
  { value: 'openai:o3-mini', label: '🤖 o3-mini (Reasoning)' },
  { value: 'openai:o1', label: '🤖 o1 (Reasoning)' },
  { value: 'openai:gpt-4.1', label: '🤖 GPT-4.1' },
  { value: 'openai:gpt-4.1-mini', label: '🤖 GPT-4.1 Mini' },
  { value: 'openai:gpt-4o', label: '🤖 GPT-4o' },
  { value: 'openai:gpt-4o-mini', label: '🤖 GPT-4o Mini' },
  
  { value: 'anthropic:claude-sonnet-4-5-20250929', label: '🧠 Claude 4.5 Sonnet' },
  { value: 'anthropic:claude-haiku-4-5-20251001', label: '🧠 Claude 4.5 Haiku' },
  { value: 'anthropic:claude-opus-4-1-20250805', label: '🧠 Claude 4.1 Opus' },
  
  { value: 'gemini:gemini-3-pro-preview', label: '✨ Gemini 3 Pro Preview 💎' },
  { value: 'gemini:gemini-2.5-pro', label: '✨ Gemini 2.5 Pro 🌟' },
  { value: 'gemini:gemini-2.5-flash', label: '✨ Gemini 2.5 Flash' },
  { value: 'gemini:gemini-2.5-flash-lite', label: '✨ Gemini 2.5 Flash-Lite' },
  { value: 'gemini:gemini-2.0-flash', label: '✨ Gemini 2.0 Flash' },
  { value: 'gemini:gemini-2.0-flash-exp', label: '✨ Gemini 2.0 Flash Exp (FREE)' },
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
