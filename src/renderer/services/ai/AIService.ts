import type { AIAnalysisRequest, AIAnalysisResponse, AIMessage, AIProviderType } from '@shared/types';
import defaultPrompts from './prompts.json';
import { ClaudeProvider, GeminiProvider, OpenAIProvider } from './providers';
import type { AIProviderConfig, BaseAIProvider } from './types';

export interface AIServiceConfig {
  provider: AIProviderType;
  apiKey?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  useOptimizedPrompts?: boolean;
  enableAIStudies?: boolean;
  customPrompts?: {
    chartAnalysis?: typeof defaultPrompts.chartAnalysis;
    chat?: typeof defaultPrompts.chat;
    signals?: typeof defaultPrompts.signals;
  };
}

export class AIService {
  private provider: BaseAIProvider | null = null;
  private providerType: AIProviderType;
  private config: AIServiceConfig;
  private apiKey: string | null = null;

  constructor(config: AIServiceConfig) {
    this.config = config;
    this.providerType = config.provider;
  }

  private async getApiKey(): Promise<string> {
    if (this.config.apiKey) {
      return this.config.apiKey;
    }

    if (this.apiKey) {
      return this.apiKey;
    }

    const result = await window.electron.secureStorage.getApiKey(this.providerType);
    
    if (!result.success || !result.apiKey) {
      throw new Error('API key not configured. Please set your API key in Settings.');
    }

    this.apiKey = result.apiKey;
    return this.apiKey;
  }

  private async initializeProvider(): Promise<void> {
    const apiKey = await this.getApiKey();

    const providerConfig: AIProviderConfig = {
      apiKey,
      ...(this.config.model && { model: this.config.model }),
      ...(this.config.temperature !== undefined && { temperature: this.config.temperature }),
      ...(this.config.maxTokens !== undefined && { maxTokens: this.config.maxTokens }),
    };

    switch (this.providerType) {
      case 'openai':
        this.provider = new OpenAIProvider(providerConfig);
        break;
      case 'anthropic':
        this.provider = new ClaudeProvider(providerConfig);
        break;
      case 'gemini':
        this.provider = new GeminiProvider(providerConfig);
        break;
      default:
        throw new Error(`Unknown provider type: ${this.providerType}`);
    }
    
    if (this.provider && this.config.enableAIStudies !== undefined) {
      this.provider.enableAIStudies = this.config.enableAIStudies;
    }
  }

  async sendMessage(
    messages: AIMessage[],
    images?: string[]
  ): Promise<AIAnalysisResponse> {
    if (!this.provider) {
      await this.initializeProvider();
    }

    if (!this.provider) {
      throw new Error('AI provider not initialized');
    }

    return this.provider.sendMessage(messages, images);
  }

  async analyzeChart(request: AIAnalysisRequest): Promise<AIAnalysisResponse> {
    if (!this.provider) {
      await this.initializeProvider();
    }

    if (!this.provider) {
      throw new Error('AI provider not initialized');
    }

    return this.provider.analyzeChart(request);
  }

  async switchProvider(newConfig: AIServiceConfig): Promise<void> {
    this.config = newConfig;
    this.providerType = newConfig.provider;
    this.apiKey = null;
    await this.initializeProvider();
  }

  async updateConfig(partialConfig: Partial<AIServiceConfig>): Promise<void> {
    this.config = { ...this.config, ...partialConfig };
    if (partialConfig.provider) {
      this.providerType = partialConfig.provider;
      this.apiKey = null;
    }
    await this.initializeProvider();
  }

  getProviderType(): AIProviderType {
    return this.providerType;
  }

  getConfig(): AIServiceConfig {
    return { ...this.config };
  }

  getSystemPrompt(): string {
    return this.config.customPrompts?.chartAnalysis?.system || defaultPrompts.chartAnalysis.system;
  }

  getChatSystemPrompt(): string {
    return this.config.customPrompts?.chat?.system || defaultPrompts.chat.system;
  }

  getDisclaimer(): string {
    return this.config.customPrompts?.chat?.disclaimer || defaultPrompts.chat.disclaimer;
  }

  getSignalInfo(signal: keyof typeof defaultPrompts.signals) {
    return this.config.customPrompts?.signals?.[signal] || defaultPrompts.signals[signal];
  }

  setOptimizedPrompts(enabled: boolean): void {
    if (this.provider) {
      this.provider['useOptimizedPrompts'] = enabled;
    }
  }
  
  setEnableAIStudies(enabled: boolean): void {
    this.config.enableAIStudies = enabled;
    if (this.provider) {
      this.provider.enableAIStudies = enabled;
    }
  }

  isUsingOptimizedPrompts(): boolean {
    return this.provider?.['useOptimizedPrompts'] ?? true;
  }
}
