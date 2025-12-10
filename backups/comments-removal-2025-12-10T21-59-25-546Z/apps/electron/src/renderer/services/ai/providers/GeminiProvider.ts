import { GoogleGenerativeAI } from '@google/generative-ai';
import type { AIAnalysisRequest, AIAnalysisResponse, AIMessage } from '@marketmind/types';
import { BaseAIProvider, type AIProviderConfig } from '../types';

export class GeminiProvider extends BaseAIProvider {
  private client: GoogleGenerativeAI;

  constructor(config: AIProviderConfig) {
    super(config);
    this.client = new GoogleGenerativeAI(this.apiKey);
  }

  protected getDefaultModel(): string {
    return 'gemini-2.5-flash';
  }

  async sendMessage(
    messages: AIMessage[],
    images?: string[]
  ): Promise<AIAnalysisResponse> {
    try {
      const systemPrompt = this.getSystemPrompt(messages);
      const optimizedMessages = this.convertMessages(messages);
      
      const model = this.client.getGenerativeModel({ 
        model: this.model,
        generationConfig: {
          temperature: this.temperature,
          maxOutputTokens: this.maxTokens,
        },
        systemInstruction: systemPrompt,
      });

      const history: Array<{
        role: 'user' | 'model';
        parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }>;
      }> = [];

      for (let i = 0; i < optimizedMessages.length - 1; i++) {
        const msg = optimizedMessages[i];
        if (!msg) continue;
        
        const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];

        const contentText = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
        parts.push({ text: contentText });

        history.push({
          role: msg.role === 'user' ? 'user' : 'model',
          parts,
        });
      }

      const chat = model.startChat({ history });

      const lastMessage = optimizedMessages[optimizedMessages.length - 1];
      if (!lastMessage) {
        throw new Error('No messages provided');
      }

      const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];

      const lastContentText = typeof lastMessage.content === 'string' ? lastMessage.content : JSON.stringify(lastMessage.content);
      parts.push({ text: lastContentText });

      if (images && images.length > 0) {
        images.forEach(imageUrl => {
          const base64Data = imageUrl.replace(/^data:image\/\w+;base64,/, '');
          parts.push({
            inlineData: {
              mimeType: 'image/png',
              data: base64Data,
            },
          });
        });
      }

      const result = await chat.sendMessage(parts);
      const response = await result.response;
      const text = response.text();

      return {
        text,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Gemini API error: ${error.message}`);
      }
      throw error;
    }
  }

  async analyzeChart(request: AIAnalysisRequest): Promise<AIAnalysisResponse> {
    try {
      const model = this.client.getGenerativeModel({ 
        model: this.model,
        generationConfig: {
          temperature: this.temperature,
          maxOutputTokens: this.maxTokens,
        }
      });

      const analysisMessages = this.buildChartAnalysisMessages(request);

      const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];

      const systemPrompt = this.getSystemPrompt();
      parts.push({ text: systemPrompt });

      const userMessage = analysisMessages.find(m => m.role === 'user');
      if (userMessage && typeof userMessage.content === 'string') {
        parts.push({ text: userMessage.content });
      } else if (userMessage && Array.isArray(userMessage.content)) {
        userMessage.content.forEach(content => {
          if (content.type === 'text' && content.text) {
            parts.push({ text: content.text });
          } else if (content.type === 'image_url' && content.image_url?.url) {
            const base64Data = content.image_url.url.replace(/^data:image\/\w+;base64,/, '');
            parts.push({
              inlineData: {
                mimeType: 'image/png',
                data: base64Data,
              },
            });
          }
        });
      }

      const result = await model.generateContent(parts);
      const response = await result.response;
      const text = response.text();

      return {
        text,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Gemini API error: ${error.message}`);
      }
      throw error;
    }
  }
}

