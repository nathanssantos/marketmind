import type { AIProviderType } from '@marketmind/types';
import { create } from 'zustand';

export const DEFAULT_MODELS: Record<AIProviderType, string> = {
  openai: 'gpt-4o',
  anthropic: 'claude-sonnet-4-5',
  gemini: 'gemini-2.5-flash',
};

export interface AISettings {
  provider: AIProviderType;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  detailedKlinesCount?: number;
}

interface AISettingsState {
  settings: AISettings | null;
  provider: AIProviderType | null;
  model: string | null;
  enableAIPatterns: boolean;

  setSettings: (settings: AISettings) => void;
  updateSettings: (partialSettings: Partial<AISettings>) => void;
  clearSettings: () => void;
  toggleAIPatterns: () => void;

  loadFromStorage: (data: Partial<AISettingsState>) => void;
  getStorageData: () => Pick<AISettingsState, 'settings' | 'enableAIPatterns'>;
}

export const useAISettingsStore = create<AISettingsState>((set, get) => ({
  settings: { provider: 'openai', model: 'gpt-4o' },
  provider: 'openai',
  model: 'gpt-4o',
  enableAIPatterns: true,

  setSettings: (settings) =>
    set({
      settings,
      provider: settings.provider,
      model: settings.model || null,
    }),

  updateSettings: (partialSettings) =>
    set((state) => {
      const currentSettings = state.settings || {
        provider: 'openai' as AIProviderType,
        model: 'gpt-4o',
      };
      const newProvider = partialSettings.provider || currentSettings.provider;
      let newModel = partialSettings.model || currentSettings.model;

      if (partialSettings.provider && newProvider && !partialSettings.model) {
        newModel = DEFAULT_MODELS[newProvider];
      }

      const newSettings = {
        ...currentSettings,
        ...partialSettings,
        ...(newModel ? { model: newModel } : {}),
      };

      return {
        settings: newSettings,
        provider: newSettings.provider,
        model: newSettings.model || null,
      };
    }),

  clearSettings: () =>
    set({
      settings: null,
      provider: null,
      model: null,
    }),

  toggleAIPatterns: () =>
    set((state) => ({ enableAIPatterns: !state.enableAIPatterns })),

  loadFromStorage: (data) => set(data),

  getStorageData: () => {
    const state = get();
    return {
      settings: state.settings,
      enableAIPatterns: state.enableAIPatterns,
    };
  },
}));
