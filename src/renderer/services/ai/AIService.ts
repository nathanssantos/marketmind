import type { AIMessage, AIAnalysisRequest, AIAnalysisResponse, AIProviderType } from '@shared/types';
import type { BaseAIProvider, AIProviderConfig } from './types';
import { OpenAIProvider } from './providers/OpenAIProvider';
import prompts from './prompts.json';

export interface AIServiceConfig {
  provider: AIProviderType;
  apiKey: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export class AIService {
  private provider: BaseAIProvider | null = null;
  private providerType: AIProviderType;
  private config: AIServiceConfig;

  constructor(config: AIServiceConfig) {
    this.config = config;
    this.providerType = config.provider;
    this.initializeProvider();
  }

  private initializeProvider(): void {
    const providerConfig: AIProviderConfig = {
      apiKey: this.config.apiKey,
      ...(this.config.model && { model: this.config.model }),
      ...(this.config.temperature !== undefined && { temperature: this.config.temperature }),
      ...(this.config.maxTokens !== undefined && { maxTokens: this.config.maxTokens }),
    };

    switch (this.providerType) {
      case 'openai':
        this.provider = new OpenAIProvider(providerConfig);
        break;
      case 'anthropic':
        throw new Error('Anthropic provider not yet implemented');
      case 'gemini':
        throw new Error('Gemini provider not yet implemented');
      default:
        throw new Error(`Unknown provider type: ${this.providerType}`);
    }
  }

  async sendMessage(
    messages: AIMessage[],
    images?: string[]
  ): Promise<AIAnalysisResponse> {
    if (!this.provider) {
      throw new Error('AI provider not initialized');
    }

    return this.provider.sendMessage(messages, images);
  }

  async analyzeChart(request: AIAnalysisRequest): Promise<AIAnalysisResponse> {
    if (!this.provider) {
      throw new Error('AI provider not initialized');
    }

    return this.provider.analyzeChart(request);
  }

  switchProvider(newConfig: AIServiceConfig): void {
    this.config = newConfig;
    this.providerType = newConfig.provider;
    this.initializeProvider();
  }

  updateConfig(partialConfig: Partial<AIServiceConfig>): void {
    this.config = { ...this.config, ...partialConfig };
    this.initializeProvider();
  }

  getProviderType(): AIProviderType {
    return this.providerType;
  }

  getConfig(): AIServiceConfig {
    return { ...this.config };
  }

  getSystemPrompt(): string {
    return prompts.chartAnalysis.system;
  }

  getChatSystemPrompt(): string {
    return prompts.chat.system;
  }

  getDisclaimer(): string {
    return prompts.chat.disclaimer;
  }

  getSignalInfo(signal: keyof typeof prompts.signals) {
    return prompts.signals[signal];
  }
}
