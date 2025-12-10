import type { AIAnalysisResponse, AIMessage } from '@marketmind/types';
import { describe, expect, it } from 'vitest';
import { BaseAIProvider } from './types';

class TestProvider extends BaseAIProvider {
  protected getDefaultModel(): string {
    return 'test-model';
  }

  async sendMessage(): Promise<AIAnalysisResponse> {
    return { text: 'test' };
  }

  async analyzeChart(): Promise<AIAnalysisResponse> {
    return { text: 'test' };
  }

  public getTestSystemPrompt(messages?: AIMessage[]): string {
    return this.getSystemPrompt(messages);
  }
}

describe('BaseAIProvider - AI Patterns Control', () => {
  it('should use full prompt when enableAIPatterns is true', () => {
    const provider = new TestProvider({
      apiKey: 'test-key',
    });

    provider.enableAIPatterns = true;

    const systemPrompt = provider.getTestSystemPrompt();

    expect(systemPrompt).toContain('DRAWING PATTERN');
    expect(systemPrompt).toContain('actionable insights');
  });

  it('should use simple prompt when enableAIPatterns is false', () => {
    const provider = new TestProvider({
      apiKey: 'test-key',
    });

    provider.enableAIPatterns = false;

    const systemPrompt = provider.getTestSystemPrompt();

    expect(systemPrompt).not.toContain('DRAWING PATTERN');
    expect(systemPrompt).not.toContain('JSON Format');
    expect(systemPrompt).toContain('clear, concise');
    expect(systemPrompt.length).toBeLessThan(500);
  });

  it('should dynamically switch between simple and full prompts', () => {
    const provider = new TestProvider({
      apiKey: 'test-key',
    });

    provider.enableAIPatterns = true;
    const fullPrompt = provider.getTestSystemPrompt();
    expect(fullPrompt).toContain('DRAWING PATTERN');

    provider.enableAIPatterns = false;
    const simplePrompt = provider.getTestSystemPrompt();
    expect(simplePrompt).not.toContain('DRAWING PATTERN');
    expect(simplePrompt.length).toBeLessThan(fullPrompt.length);
  });
});
