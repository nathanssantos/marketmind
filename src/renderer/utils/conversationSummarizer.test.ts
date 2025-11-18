import { describe, expect, it } from 'vitest';
import type { AIMessage } from '../../shared/types';
import {
    buildOptimizedMessages,
    shouldSummarizeConversation,
    summarizeConversation,
    summarizeOldMessages,
} from './conversationSummarizer';

describe('conversationSummarizer', () => {
  describe('shouldSummarizeConversation', () => {
    it('should return false for conversations with few messages', () => {
      const messages: AIMessage[] = Array.from({ length: 10 }, (_, i) => ({
        id: `msg-${i}`,
        role: 'user',
        content: 'Test message',
        timestamp: Date.now(),
      }));

      expect(shouldSummarizeConversation(messages)).toBe(false);
    });

    it('should return true for conversations with many messages', () => {
      const messages: AIMessage[] = Array.from({ length: 20 }, (_, i) => ({
        id: `msg-${i}`,
        role: 'user',
        content: 'Test message',
        timestamp: Date.now(),
      }));

      expect(shouldSummarizeConversation(messages)).toBe(true);
    });
  });

  describe('summarizeOldMessages', () => {
    it('should return empty string for empty messages', () => {
      expect(summarizeOldMessages([])).toBe('');
    });

    it('should identify topics from messages', () => {
      const messages: AIMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: 'Can you analyze this chart?',
          timestamp: Date.now(),
        },
        {
          id: 'msg-2',
          role: 'user',
          content: 'What are the support and resistance levels?',
          timestamp: Date.now(),
        },
      ];

      const summary = summarizeOldMessages(messages);
      expect(summary).toContain('chart analysis');
      expect(summary).toContain('key levels');
    });

    it('should include message count in summary', () => {
      const messages: AIMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: 'Test',
          timestamp: Date.now(),
        },
        {
          id: 'msg-2',
          role: 'assistant',
          content: 'Response',
          timestamp: Date.now(),
        },
      ];

      const summary = summarizeOldMessages(messages);
      expect(summary).toContain('2 messages');
    });
  });

  describe('summarizeConversation', () => {
    it('should not summarize short conversations', () => {
      const messages: AIMessage[] = Array.from({ length: 5 }, (_, i) => ({
        id: `msg-${i}`,
        role: 'user',
        content: 'Test message',
        timestamp: Date.now(),
      }));

      const result = summarizeConversation(messages);
      expect(result.summary).toBe('');
      expect(result.recentMessages).toHaveLength(5);
      expect(result.totalMessagesSummarized).toBe(0);
    });

    it('should keep last 10 messages and summarize older ones', () => {
      const messages: AIMessage[] = Array.from({ length: 20 }, (_, i) => ({
        id: `msg-${i}`,
        role: 'user',
        content: 'Test message',
        timestamp: Date.now(),
      }));

      const result = summarizeConversation(messages);
      expect(result.recentMessages).toHaveLength(10);
      expect(result.totalMessagesSummarized).toBe(10);
      expect(result.summary).toBeTruthy();
    });
  });

  describe('buildOptimizedMessages', () => {
    it('should return original messages if no summarization needed', () => {
      const messages: AIMessage[] = Array.from({ length: 5 }, (_, i) => ({
        id: `msg-${i}`,
        role: 'user',
        content: 'Test message',
        timestamp: Date.now(),
      }));

      const result = buildOptimizedMessages(messages);
      expect(result).toHaveLength(5);
    });

    it('should include summary message for long conversations', () => {
      const messages: AIMessage[] = Array.from({ length: 20 }, (_, i) => ({
        id: `msg-${i}`,
        role: 'user',
        content: 'Test message',
        timestamp: Date.now(),
      }));

      const result = buildOptimizedMessages(messages);
      expect(result.length).toBe(11);
      expect(result[0]?.id).toBe('summary');
      expect(result[0]?.role).toBe('assistant');
    });

    it('should strip images when includeImages is false and conversation is long', () => {
      const messages: AIMessage[] = Array.from({ length: 20 }, (_, i) => ({
        id: `msg-${i}`,
        role: 'user',
        content: 'Look at this chart',
        images: i === 19 ? ['data:image/png;base64,abc123'] : undefined,
        timestamp: Date.now(),
      }));

      const result = buildOptimizedMessages(messages, false);
      const messageWithImage = result.find(m => m.content.includes('Previous message'));
      expect(messageWithImage).toBeDefined();
      expect(messageWithImage?.images).toHaveLength(0);
    });
  });
});
