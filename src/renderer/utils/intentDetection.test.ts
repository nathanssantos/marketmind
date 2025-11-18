import { describe, expect, it } from 'vitest';
import type { AIMessage } from '../../shared/types';
import {
    detectIntentFromConversation,
    detectIntentFromMessage,
    getSystemPrompt,
} from './intentDetection';

describe('intentDetection', () => {
  describe('detectIntentFromMessage', () => {
    it('should detect full mode for detailed analysis keywords', () => {
      expect(detectIntentFromMessage('Can you analyze this chart?')).toBe('full');
      expect(detectIntentFromMessage('Show me technical indicators')).toBe('full');
      expect(detectIntentFromMessage('What are the support and resistance levels?')).toBe('full');
      expect(detectIntentFromMessage('Give me a detailed analysis')).toBe('full');
    });

    it('should detect simple mode for simple questions', () => {
      expect(detectIntentFromMessage('What is BTC price?')).toBe('simple');
      expect(detectIntentFromMessage('How do I use this?')).toBe('simple');
      expect(detectIntentFromMessage('Explain moving averages')).toBe('simple');
    });

    it('should detect full mode for long messages', () => {
      const longMessage = 'A'.repeat(150);
      expect(detectIntentFromMessage(longMessage)).toBe('full');
    });

    it('should default to simple mode for ambiguous messages', () => {
      expect(detectIntentFromMessage('Hello')).toBe('simple');
      expect(detectIntentFromMessage('Thanks')).toBe('simple');
    });
  });

  describe('detectIntentFromConversation', () => {
    it('should return simple for empty conversation', () => {
      expect(detectIntentFromConversation([])).toBe('simple');
    });

    it('should detect full mode when user sends chart image', () => {
      const messages: AIMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: 'Check this out',
          images: ['data:image/png;base64,abc123'],
          timestamp: Date.now(),
        },
      ];

      expect(detectIntentFromConversation(messages)).toBe('full');
    });

    it('should use last user message intent', () => {
      const messages: AIMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: 'Analyze the chart',
          timestamp: Date.now(),
        },
        {
          id: 'msg-2',
          role: 'assistant',
          content: 'Here is the analysis',
          timestamp: Date.now(),
        },
        {
          id: 'msg-3',
          role: 'user',
          content: 'What is the price?',
          timestamp: Date.now(),
        },
      ];

      expect(detectIntentFromConversation(messages)).toBe('simple');
    });

    it('should consider only recent messages', () => {
      const messages: AIMessage[] = Array.from({ length: 10 }, (_, i) => ({
        id: `msg-${i}`,
        role: i % 2 === 0 ? ('user' as const) : ('assistant' as const),
        content: i === 8 ? 'Quick question' : 'Some message',
        timestamp: Date.now(),
      }));

      expect(detectIntentFromConversation(messages)).toBe('simple');
    });
  });

  describe('getSystemPrompt', () => {
    it('should return chat prompts by default', () => {
      const simplePrompt = getSystemPrompt('simple');
      const fullPrompt = getSystemPrompt('full');

      expect(simplePrompt).toContain('AI assistant');
      expect(fullPrompt).toContain('AI assistant');
    });

    it('should return chart analysis prompts when specified', () => {
      const simplePrompt = getSystemPrompt('simple', 'chartAnalysis');
      const fullPrompt = getSystemPrompt('full', 'chartAnalysis');

      expect(simplePrompt).toContain('technical analyst');
      expect(fullPrompt).toContain('technical analyst');
    });

    it('should return different prompts for simple vs full', () => {
      const simplePrompt = getSystemPrompt('simple', 'chat');
      const fullPrompt = getSystemPrompt('full', 'chat');

      expect(simplePrompt).not.toBe(fullPrompt);
    });
  });
});
