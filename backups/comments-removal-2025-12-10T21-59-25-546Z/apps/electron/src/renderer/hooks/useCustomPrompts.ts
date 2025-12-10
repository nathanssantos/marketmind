import { DEFAULT_PROMPTS } from '@/renderer/constants/defaults';
import { useLocalStorage } from './useLocalStorage';

const STORAGE_KEY = 'marketmind-custom-prompts';

interface CustomPromptsState {
  chartAnalysis?: string;
  chat?: string;
  signals?: string;
}

export const useCustomPrompts = () => {
  const [customPrompts, setCustomPrompts] = useLocalStorage<CustomPromptsState>(
    STORAGE_KEY,
    {}
  );

  const getChartAnalysisPrompt = (): string => {
    if (customPrompts.chartAnalysis) {
      return customPrompts.chartAnalysis;
    }
    return JSON.stringify(DEFAULT_PROMPTS.chartAnalysis, null, 2);
  };

  const getChatPrompt = (): string => {
    if (customPrompts.chat) {
      return customPrompts.chat;
    }
    return JSON.stringify(DEFAULT_PROMPTS.chat, null, 2);
  };

  const getSignalsPrompt = (): string => {
    if (customPrompts.signals) {
      return customPrompts.signals;
    }
    return JSON.stringify(DEFAULT_PROMPTS.signals, null, 2);
  };

  const setChartAnalysisPrompt = (prompt: string) => {
    setCustomPrompts((prev) => ({
      ...prev,
      chartAnalysis: prompt,
    }));
  };

  const setChatPrompt = (prompt: string) => {
    setCustomPrompts((prev) => ({
      ...prev,
      chat: prompt,
    }));
  };

  const setSignalsPrompt = (prompt: string) => {
    setCustomPrompts((prev) => ({
      ...prev,
      signals: prompt,
    }));
  };

  const resetChartAnalysisPrompt = () => {
    setCustomPrompts((prev) => {
      const { chartAnalysis, ...rest } = prev;
      return rest;
    });
  };

  const resetChatPrompt = () => {
    setCustomPrompts((prev) => {
      const { chat, ...rest } = prev;
      return rest;
    });
  };

  const resetSignalsPrompt = () => {
    setCustomPrompts((prev) => {
      const { signals, ...rest } = prev;
      return rest;
    });
  };

  const resetAllPrompts = () => {
    setCustomPrompts({});
  };

  const isChartAnalysisModified = () => !!customPrompts.chartAnalysis;
  const isChatModified = () => !!customPrompts.chat;
  const isSignalsModified = () => !!customPrompts.signals;
  const isAnyModified = () => Object.keys(customPrompts).length > 0;

  const getDefaultChartAnalysisPrompt = () => JSON.stringify(DEFAULT_PROMPTS.chartAnalysis, null, 2);
  const getDefaultChatPrompt = () => JSON.stringify(DEFAULT_PROMPTS.chat, null, 2);
  const getDefaultSignalsPrompt = () => JSON.stringify(DEFAULT_PROMPTS.signals, null, 2);

  return {
    getChartAnalysisPrompt,
    getChatPrompt,
    getSignalsPrompt,
    setChartAnalysisPrompt,
    setChatPrompt,
    setSignalsPrompt,
    resetChartAnalysisPrompt,
    resetChatPrompt,
    resetSignalsPrompt,
    resetAllPrompts,
    isChartAnalysisModified,
    isChatModified,
    isSignalsModified,
    isAnyModified,
    getDefaultChartAnalysisPrompt,
    getDefaultChatPrompt,
    getDefaultSignalsPrompt,
  };
};
