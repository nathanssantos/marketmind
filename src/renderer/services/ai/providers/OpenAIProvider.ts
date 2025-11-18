import type { AIAnalysisRequest, AIAnalysisResponse, AIMessage } from '@shared/types';
import OpenAI from 'openai';
import { BaseAIProvider, type AIProviderConfig } from '../types';

export class OpenAIProvider extends BaseAIProvider {
  private client: OpenAI;

  constructor(config: AIProviderConfig) {
    super(config);
    this.client = new OpenAI({
      apiKey: this.apiKey,
      dangerouslyAllowBrowser: true,
    });
  }

  protected getDefaultModel(): string {
    return 'gpt-4o';
  }

  async sendMessage(
    messages: AIMessage[],
    images?: string[]
  ): Promise<AIAnalysisResponse> {
    try {
      const systemPrompt = this.getSystemPrompt(messages);
      
      const optimizedMessages = this.convertMessages(messages);
      
      const chatMessages: OpenAI.ChatCompletionMessageParam[] = [
        {
          role: 'system',
          content: systemPrompt,
        },
        ...optimizedMessages.map(msg => ({
          role: msg.role,
          content: msg.content,
        })) as OpenAI.ChatCompletionMessageParam[],
      ];

      if (images && images.length > 0) {
        const lastMessage = chatMessages[chatMessages.length - 1];
        if (lastMessage && lastMessage.role === 'user') {
          const textContent = typeof lastMessage.content === 'string' 
            ? lastMessage.content 
            : '';

          const content: OpenAI.ChatCompletionContentPart[] = [
            { type: 'text', text: textContent },
          ];

          images.forEach(image => {
            content.push({
              type: 'image_url',
              image_url: {
                url: image,
                detail: 'high',
              },
            });
          });

          lastMessage.content = content;
        }
      }

      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages: chatMessages as never,
        temperature: this.temperature,
        max_tokens: this.maxTokens,
      });

      const responseText = completion.choices[0]?.message?.content || '';

      return {
        text: responseText,
      };
    } catch (error) {
      console.error('OpenAI API error:', error);
      throw new Error(`Failed to get AI response: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async analyzeChart(request: AIAnalysisRequest): Promise<AIAnalysisResponse> {
    try {
      const internalMessages = this.buildChartAnalysisMessages(request);

      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages: internalMessages as never,
        temperature: this.temperature,
        max_tokens: this.maxTokens,
      });

      const responseText = completion.choices[0]?.message?.content || '';

      const signalData = this.parseSignalFromResponse(responseText);

      const response: AIAnalysisResponse = {
        text: responseText,
      };

      if (signalData) {
        response.confidence = signalData.confidence;
        response.signals = [{
          signal: signalData.signal,
          confidence: signalData.confidence,
        }];
      }

      return response;
    } catch (error) {
      console.error('OpenAI chart analysis error:', error);
      throw new Error(`Failed to analyze chart: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
