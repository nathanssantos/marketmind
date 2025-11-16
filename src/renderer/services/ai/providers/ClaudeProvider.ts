import Anthropic from '@anthropic-ai/sdk';
import type { AIAnalysisRequest, AIAnalysisResponse, AIMessage } from '@shared/types';
import { BaseAIProvider, type AIProviderConfig } from '../types';

export class ClaudeProvider extends BaseAIProvider {
  private client: Anthropic;

  constructor(config: AIProviderConfig) {
    super(config);
    this.client = new Anthropic({
      apiKey: this.apiKey,
      dangerouslyAllowBrowser: true,
    });
  }

  protected getDefaultModel(): string {
    return 'claude-sonnet-4-5-20250929';
  }

  async sendMessage(
    messages: AIMessage[],
    images?: string[]
  ): Promise<AIAnalysisResponse> {
    try {
      const systemPrompt = this.getSystemPrompt();
      const userMessages = messages.filter(m => m.role === 'user' || m.role === 'assistant');

      const claudeMessages = userMessages.map(msg => {
        if (msg.role === 'user' && images && images.length > 0) {
          const content: Anthropic.MessageParam['content'] = [
            {
              type: 'text',
              text: msg.content,
            },
            ...images.map(image => ({
              type: 'image' as const,
              source: {
                type: 'base64' as const,
                media_type: 'image/png' as const,
                data: image.replace(/^data:image\/\w+;base64,/, ''),
              },
            })),
          ];
          return { role: msg.role, content };
        }

        return {
          role: msg.role,
          content: msg.content,
        };
      });

      const params: Anthropic.MessageCreateParamsNonStreaming = {
        model: this.model,
        max_tokens: this.maxTokens,
        temperature: this.temperature,
        messages: claudeMessages as Anthropic.MessageParam[],
        system: systemPrompt,
      };

      const response = await this.client.messages.create(params);

      const textContent = response.content.find(c => c.type === 'text');
      const responseText = textContent && 'text' in textContent ? textContent.text : '';

      return {
        text: responseText,
      };
    } catch (error) {
      console.error('Claude API error:', error);
      throw new Error(`Failed to get AI response: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async analyzeChart(request: AIAnalysisRequest): Promise<AIAnalysisResponse> {
    try {
      const internalMessages = this.buildChartAnalysisMessages(request);

      const systemMessage = internalMessages.find(m => m.role === 'system');
      const userMessages = internalMessages.filter(m => m.role === 'user');

      const claudeMessages = userMessages.map(msg => {
        const content = Array.isArray(msg.content) ? msg.content : [{ type: 'text' as const, text: msg.content }];
        
        const processedContent = content.map(item => {
          if (item.type === 'image_url' && item.image_url) {
            const imageData = item.image_url.url.replace(/^data:image\/\w+;base64,/, '');
            return {
              type: 'image' as const,
              source: {
                type: 'base64' as const,
                media_type: 'image/png' as const,
                data: imageData,
              },
            };
          }
          return item;
        });

        return {
          role: msg.role,
          content: processedContent,
        };
      });

      const params: Anthropic.MessageCreateParamsNonStreaming = {
        model: this.model,
        max_tokens: this.maxTokens,
        temperature: this.temperature,
        messages: claudeMessages as Anthropic.MessageParam[],
      };

      if (systemMessage && typeof systemMessage.content === 'string') {
        params.system = systemMessage.content;
      }

      const response = await this.client.messages.create(params);

      const textContent = response.content.find(c => c.type === 'text');
      const responseText = textContent && 'text' in textContent ? textContent.text : '';

      const signalData = this.parseSignalFromResponse(responseText);

      const aiResponse: AIAnalysisResponse = {
        text: responseText,
      };

      if (signalData) {
        aiResponse.confidence = signalData.confidence;
        aiResponse.signals = [{
          signal: signalData.signal,
          confidence: signalData.confidence,
        }];
      }

      return aiResponse;
    } catch (error) {
      console.error('Claude chart analysis error:', error);
      throw new Error(`Failed to analyze chart: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
