import { Button } from '@/renderer/components/ui/button';
import { Field } from '@/renderer/components/ui/field';
import { PasswordInput } from '@/renderer/components/ui/password-input';
import { Select } from '@/renderer/components/ui/select';
import { Slider } from '@/renderer/components/ui/slider';
import { Switch } from '@/renderer/components/ui/switch';
import { DEFAULT_AI_SETTINGS } from '@/renderer/constants/defaults';
import { useCustomPrompts } from '@/renderer/hooks/useCustomPrompts';
import { useDebounceCallback } from '@/renderer/hooks/useDebounceCallback';
import { useSecureStorage } from '@/renderer/hooks/useSecureStorage';
import { useAIStore, useUIStore } from '@/renderer/store';
import type { PatternDetectionMode } from '@/renderer/store/uiStore';
import {
  Accordion,
  Box,
  Flex,
  Separator,
  Spinner,
  Stack,
  Text,
} from '@chakra-ui/react';
import type { AIProviderType } from '@shared/types';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuRefreshCw } from 'react-icons/lu';
import { PromptEditor } from './PromptEditor';

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
  const { t } = useTranslation();
  const { settings, updateSettings } = useAIStore();
  const {
    patternDetectionMode,
    setPatternDetectionMode,
    algorithmicDetectionSettings,
    setAlgorithmicDetectionSettings,
  } = useUIStore();
  const {
    loading: isLoadingSecureStorage,
    error: secureStorageError,
    isEncryptionAvailable,
    setApiKey: setSecureApiKey,
    getApiKey,
  } = useSecureStorage();

  const {
    getChartAnalysisPrompt,
    getChatPrompt,
    setChartAnalysisPrompt,
    setChatPrompt,
    resetChartAnalysisPrompt,
    resetChatPrompt,
    getDefaultChartAnalysisPrompt,
    getDefaultChatPrompt,
  } = useCustomPrompts();

  const [apiKeys, setApiKeys] = useState<Record<AIProvider, string>>({
    openai: '',
    anthropic: '',
    gemini: '',
  });
  const [isLoadingKeys, setIsLoadingKeys] = useState(true);

  const provider = settings?.provider || 'gemini';
  const model = settings?.model || DEFAULT_MODELS[provider];
  const temperature = settings?.temperature ?? DEFAULT_AI_SETTINGS.temperature;
  const maxTokens = settings?.maxTokens ?? DEFAULT_AI_SETTINGS.maxTokens;
  const detailedCandlesCount = settings?.detailedCandlesCount ?? DEFAULT_AI_SETTINGS.detailedCandlesCount;

  const debouncedUpdateSettings = useDebounceCallback(updateSettings, 300);

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
        if (import.meta.env.DEV) {
          console.log(`${provider} API key saved successfully`);
        }
      }
    } catch (error) {
      console.error(`Failed to save ${provider} API key:`, error);
    }
  };

  const handleTemperatureChange = (value: number[]) => {
    if (value[0] !== undefined) {
      debouncedUpdateSettings({ temperature: value[0] });
    }
  };

  const handleMaxTokensChange = (value: number[]) => {
    if (value[0] !== undefined) {
      debouncedUpdateSettings({ maxTokens: value[0] });
    }
  };

  const handleDetailedCandlesCountChange = (value: number[]) => {
    if (value[0] !== undefined) {
      debouncedUpdateSettings({ detailedCandlesCount: value[0] });
    }
  };

  const handleReset = () => {
    updateSettings({
      temperature: DEFAULT_AI_SETTINGS.temperature,
      maxTokens: DEFAULT_AI_SETTINGS.maxTokens,
      detailedCandlesCount: DEFAULT_AI_SETTINGS.detailedCandlesCount,
    });
  };

  const renderApiKeyInput = (provider: AIProvider, label: string) => {
    const envVar = `VITE_${provider.toUpperCase()}_API_KEY`;
    const envKey = import.meta.env[envVar] as string | undefined;

    const labelKey = provider === 'openai' ? 'openaiApiKey' :
      provider === 'anthropic' ? 'anthropicApiKey' :
        'geminiApiKey';

    return (
      <Box key={provider}>
        <Field
          label={t(`settings.ai.${labelKey}`)}
          helperText={envKey ? t('settings.ai.usingEnvVar', { var: envVar }) : undefined}
        >
          {isLoadingKeys ? (
            <Flex align="center" gap={2} p={2}>
              <Spinner size="sm" />
              <Text fontSize="sm" color="fg.muted">{t('common.loading')}</Text>
            </Flex>
          ) : (
            <Flex gap={2}>
              <PasswordInput
                value={apiKeys[provider]}
                onChange={(e) => handleApiKeyChange(provider, e.target.value)}
                placeholder={envKey || t('settings.ai.enterApiKey', { provider: label })}
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
          💡 {t('common.tips')}
        </Text>
        <Stack gap={1} fontSize="sm" color="fg.muted">
          <Text>• {t('settings.ai.tipsEncryption')}</Text>
          <Text>• {t('settings.ai.tipsTemperature')}</Text>
          <Text>• {t('settings.ai.tipsFree')}</Text>
        </Stack>
      </Box>

      <Box>
        <Button
          variant="outline"
          onClick={handleReset}
          width="full"
          colorPalette="red"
        >
          <LuRefreshCw />
          {t('settings.resetToDefaults')}
        </Button>
      </Box>

      <Separator />

      <Box>
        <Field label={t('aiConfig.provider')} required>
          <Select
            value={provider}
            onChange={(value) => handleProviderChange(value as AIProviderType)}
            options={[
              { value: 'openai', label: t('aiConfig.providers.openai') },
              { value: 'anthropic', label: t('aiConfig.providers.anthropic') },
              { value: 'gemini', label: t('aiConfig.providers.gemini') },
            ]}
            usePortal={false}
          />
        </Field>
      </Box>

      <Box>
        <Field label={t('aiConfig.model')} required>
          <Select
            value={model}
            onChange={handleModelChange}
            options={modelOptions.map((option) => ({
              value: option.value,
              label: option.label,
              description: option.pricing,
            }))}
            enableSearch
            usePortal={false}
          />
        </Field>
      </Box>

      <Separator />

      <Stack gap={4}>
        <Text fontWeight="medium" fontSize="sm">
          {t('settings.ai.apiKeysTitle')}
        </Text>

        {renderApiKeyInput('openai', t('aiConfig.providers.openai'))}
        {renderApiKeyInput('anthropic', t('aiConfig.providers.anthropic'))}
        {renderApiKeyInput('gemini', t('aiConfig.providers.gemini'))}

        {secureStorageError && (
          <Text fontSize="sm" color="red.500">
            {secureStorageError}
          </Text>
        )}
        {!isEncryptionAvailable && (
          <Text fontSize="sm" color="orange.500">
            {t('settings.ai.encryptionNotAvailable')}
          </Text>
        )}
      </Stack>

      <Separator />

      <Box>
        <Field label={t('settings.ai.temperature', { value: temperature.toFixed(2) })} helperText={t('settings.ai.temperatureHelper')}>
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
        <Field label={t('settings.ai.maxTokens', { value: maxTokens.toLocaleString() })} helperText={t('settings.ai.maxTokensHelper')}>
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

      <Box>
        <Field label={t('settings.ai.detailedCandles', { value: detailedCandlesCount })} helperText={t('settings.ai.detailedCandlesHelper')}>
          <Slider
            value={[detailedCandlesCount]}
            onValueChange={handleDetailedCandlesCountChange}
            min={10}
            max={100}
            step={1}
            width="full"
          />
        </Field>
      </Box>

      <Separator />

      <Box>
        <Text fontWeight="medium" fontSize="md" mb={4}>
          {t('settings.ai.patternDetection.title')}
        </Text>

        <Field label={t('settings.ai.patternDetection.mode')}>
          <Select
            value={patternDetectionMode}
            onChange={(value) => setPatternDetectionMode(value as PatternDetectionMode)}
            options={[
              { value: 'ai-only', label: t('settings.ai.patternDetection.aiOnly') },
              { value: 'algorithmic-only', label: t('settings.ai.patternDetection.algorithmicOnly') },
              { value: 'hybrid', label: t('settings.ai.patternDetection.hybrid') },
            ]}
            placeholder={t('settings.ai.patternDetection.selectMode')}
            usePortal={false}
          />
        </Field>

        {(patternDetectionMode === 'algorithmic-only' || patternDetectionMode === 'hybrid') && (
          <Stack gap={4} mt={4}>
            <Box>
              <Switch
                checked={algorithmicDetectionSettings.autoDisplayPatterns}
                onCheckedChange={(checked) =>
                  setAlgorithmicDetectionSettings({ autoDisplayPatterns: checked })
                }
              >
                {t('settings.ai.patternDetection.autoDisplay')}
              </Switch>
              <Text fontSize="xs" color="fg.muted" mt={1}>
                {t('settings.ai.patternDetection.autoDisplayHelper')}
              </Text>
            </Box>

            <Field
              label={t('settings.ai.patternDetection.minConfidence', {
                value: (algorithmicDetectionSettings.minConfidence * 100).toFixed(0),
              })}
              helperText={t('settings.ai.patternDetection.minConfidenceHelper')}
            >
              <Slider
                value={[algorithmicDetectionSettings.minConfidence]}
                onValueChange={(value) => {
                  if (value[0] !== undefined) {
                    setAlgorithmicDetectionSettings({ minConfidence: value[0] });
                  }
                }}
                min={0.5}
                max={0.9}
                step={0.05}
                width="full"
              />
            </Field>

            <Field
              label={t('settings.ai.patternDetection.pivotSensitivity', {
                value: algorithmicDetectionSettings.pivotSensitivity,
              })}
              helperText={t('settings.ai.patternDetection.pivotSensitivityHelper')}
            >
              <Slider
                value={[algorithmicDetectionSettings.pivotSensitivity]}
                onValueChange={(value) => {
                  if (value[0] !== undefined) {
                    setAlgorithmicDetectionSettings({ pivotSensitivity: value[0] });
                  }
                }}
                min={3}
                max={10}
                step={1}
                width="full"
              />
            </Field>
          </Stack>
        )}
      </Box>

      <Separator />

      <Accordion.Root collapsible defaultValue={[]}>
        <Accordion.Item value="chart-analysis">
          <Accordion.ItemTrigger py={3} justifyContent="space-between" alignItems="center">
            <Text fontWeight="medium" fontSize="sm">
              {t('settings.prompt.chartAnalysisPrompt')}
            </Text>
            <Accordion.ItemIndicator />
          </Accordion.ItemTrigger>
          <Accordion.ItemContent>
            <Box pt={4}>
              <PromptEditor
                value={getChartAnalysisPrompt()}
                defaultValue={getDefaultChartAnalysisPrompt()}
                onChange={setChartAnalysisPrompt}
                onReset={resetChartAnalysisPrompt}
                label={t('settings.prompt.chartAnalysisPrompt')}
                description={t('settings.prompt.chartAnalysisDescription')}
                placeholder={t('settings.prompt.jsonPlaceholder')}
              />
            </Box>
          </Accordion.ItemContent>
        </Accordion.Item>

        <Accordion.Item value="chat">
          <Accordion.ItemTrigger py={3} justifyContent="space-between" alignItems="center">
            <Text fontWeight="medium" fontSize="sm">
              {t('settings.prompt.chatPrompt')}
            </Text>
            <Accordion.ItemIndicator />
          </Accordion.ItemTrigger>
          <Accordion.ItemContent>
            <Box pt={4}>
              <PromptEditor
                value={getChatPrompt()}
                defaultValue={getDefaultChatPrompt()}
                onChange={setChatPrompt}
                onReset={resetChatPrompt}
                label={t('settings.prompt.chatPrompt')}
                description={t('settings.prompt.chatDescription')}
                placeholder={t('settings.prompt.jsonPlaceholder')}
              />
            </Box>
          </Accordion.ItemContent>
        </Accordion.Item>
      </Accordion.Root>
    </Stack>
  );
};
