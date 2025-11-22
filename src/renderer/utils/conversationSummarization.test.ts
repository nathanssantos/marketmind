import { describe, expect, it } from 'vitest';
import type { ConversationMessage } from './conversationSummarization';
import { summarizeConversation, summarizeOldMessages } from './conversationSummarization';

describe('conversationSummarization', () => {
  const createMessage = (
    role: 'user' | 'assistant' | 'system',
    content: string,
    id = `msg-${Date.now()}`
  ): ConversationMessage => ({
    id,
    role,
    content,
    timestamp: Date.now(),
  });

  describe('summarizeOldMessages', () => {
    it('should return empty string for empty array', () => {
      const result = summarizeOldMessages([]);
      expect(result).toBe('');
    });

    it('should detect chart analysis topic', () => {
      const messages = [
        createMessage('user', 'Please analyze this chart'),
        createMessage('assistant', 'The chart shows...'),
      ];

      const result = summarizeOldMessages(messages);
      expect(result).toContain('chart analysis');
      expect(result).toContain('2 messages');
    });

    it('should detect trading signals topic', () => {
      const messages = [
        createMessage('user', 'Should I buy now?'),
        createMessage('assistant', 'Consider...'),
      ];

      const result = summarizeOldMessages(messages);
      expect(result).toContain('trading signals');
    });

    it('should detect sell signals', () => {
      const messages = [createMessage('user', 'When should I sell?')];

      const result = summarizeOldMessages(messages);
      expect(result).toContain('trading signals');
    });

    it('should detect key levels topic', () => {
      const messages = [createMessage('user', 'What are the support and resistance levels?')];

      const result = summarizeOldMessages(messages);
      expect(result).toContain('key levels');
    });

    it('should detect support without resistance', () => {
      const messages = [createMessage('user', 'Where is the support level?')];

      const result = summarizeOldMessages(messages);
      expect(result).toContain('key levels');
    });

    it('should detect resistance without support', () => {
      const messages = [createMessage('user', 'What is the resistance?')];

      const result = summarizeOldMessages(messages);
      expect(result).toContain('key levels');
    });

    it('should detect trend analysis topic', () => {
      const messages = [createMessage('user', 'What is the current trend?')];

      const result = summarizeOldMessages(messages);
      expect(result).toContain('trend analysis');
    });

    it('should detect market news topic', () => {
      const messages = [createMessage('user', 'What is the latest news?')];

      const result = summarizeOldMessages(messages);
      expect(result).toContain('market news');
    });

    it('should detect multiple topics', () => {
      const messages = [
        createMessage('user', 'Analyze the chart and show me support levels'),
        createMessage('assistant', 'Analysis...'),
        createMessage('user', 'What is the trend?'),
      ];

      const result = summarizeOldMessages(messages);
      expect(result).toContain('chart analysis');
      expect(result).toContain('key levels');
      expect(result).toContain('trend analysis');
    });

    it('should remove duplicate topics', () => {
      const messages = [
        createMessage('user', 'Analyze the chart'),
        createMessage('user', 'Analyze the chart again'),
        createMessage('user', 'One more chart analysis please'),
      ];

      const result = summarizeOldMessages(messages);
      const chartAnalysisCount = (result.match(/chart analysis/g) || []).length;
      expect(chartAnalysisCount).toBe(1);
    });

    it('should return general discussion when no topics detected', () => {
      const messages = [
        createMessage('user', 'Hello'),
        createMessage('assistant', 'Hi there!'),
      ];

      const result = summarizeOldMessages(messages);
      expect(result).toContain('General market discussion');
    });

    it('should only process user messages for topics', () => {
      const messages = [
        createMessage('assistant', 'I will analyze the chart'),
        createMessage('system', 'System message about chart'),
        createMessage('user', 'Thanks'),
      ];

      const result = summarizeOldMessages(messages);
      expect(result).toContain('General market discussion');
    });

    it('should handle messages with mixed case content', () => {
      const messages = [
        createMessage('user', 'ANALYZE THE CHART'),
        createMessage('user', 'Should I BUY?'),
      ];

      const result = summarizeOldMessages(messages);
      expect(result).toContain('chart analysis');
      expect(result).toContain('trading signals');
    });

    it('should include message count in summary', () => {
      const messages = [
        createMessage('user', 'Message 1'),
        createMessage('user', 'Message 2'),
        createMessage('user', 'Message 3'),
      ];

      const result = summarizeOldMessages(messages);
      expect(result).toContain('3 messages');
    });

    it('should handle long messages', () => {
      const longContent = 'A'.repeat(150);
      const messages = [createMessage('user', longContent)];

      const result = summarizeOldMessages(messages);
      expect(result).toBeTruthy();
      expect(result).toContain('1 messages');
    });
  });

  describe('summarizeConversation', () => {
    it('should not summarize when messages <= messagesToKeepFull', () => {
      const messages = [
        createMessage('user', 'Message 1'),
        createMessage('assistant', 'Response 1'),
      ];

      const result = summarizeConversation(messages, 10);

      expect(result.summary).toBe('');
      expect(result.recentMessages).toEqual(messages);
      expect(result.totalMessagesSummarized).toBe(0);
    });

    it('should summarize when messages > messagesToKeepFull', () => {
      const messages: ConversationMessage[] = [];
      for (let i = 0; i < 15; i++) {
        messages.push(createMessage('user', `Message ${i}`));
      }

      const result = summarizeConversation(messages, 10);

      expect(result.summary).toBeTruthy();
      expect(result.recentMessages).toHaveLength(10);
      expect(result.totalMessagesSummarized).toBe(5);
    });

    it('should keep the most recent messages', () => {
      const messages: ConversationMessage[] = [];
      for (let i = 0; i < 15; i++) {
        messages.push(createMessage('user', `Message ${i}`, `msg-${i}`));
      }

      const result = summarizeConversation(messages, 10);

      expect(result.recentMessages[0].id).toBe('msg-5');
      expect(result.recentMessages[9].id).toBe('msg-14');
    });

    it('should use custom messagesToKeepFull parameter', () => {
      const messages: ConversationMessage[] = [];
      for (let i = 0; i < 20; i++) {
        messages.push(createMessage('user', `Message ${i}`));
      }

      const result = summarizeConversation(messages, 5);

      expect(result.recentMessages).toHaveLength(5);
      expect(result.totalMessagesSummarized).toBe(15);
    });

    it('should use default messagesToKeepFull when not provided', () => {
      const messages: ConversationMessage[] = [];
      for (let i = 0; i < 15; i++) {
        messages.push(createMessage('user', `Message ${i}`));
      }

      const result = summarizeConversation(messages);

      expect(result.recentMessages).toHaveLength(10);
      expect(result.totalMessagesSummarized).toBe(5);
    });

    it('should handle exactly messagesToKeepFull messages', () => {
      const messages: ConversationMessage[] = [];
      for (let i = 0; i < 10; i++) {
        messages.push(createMessage('user', `Message ${i}`));
      }

      const result = summarizeConversation(messages, 10);

      expect(result.summary).toBe('');
      expect(result.recentMessages).toHaveLength(10);
      expect(result.totalMessagesSummarized).toBe(0);
    });

    it('should summarize old messages with detected topics', () => {
      const messages: ConversationMessage[] = [
        createMessage('user', 'Analyze the chart'),
        createMessage('assistant', 'The chart shows...'),
        createMessage('user', 'What are the support levels?'),
        createMessage('assistant', 'Support at...'),
        createMessage('user', 'Should I buy?'),
        createMessage('assistant', 'Consider...'),
        createMessage('user', 'What is the trend?'),
        createMessage('assistant', 'Trend analysis...'),
        createMessage('user', 'Old message 1'),
        createMessage('user', 'Old message 2'),
      ];

      for (let i = 0; i < 10; i++) {
        messages.push(createMessage('user', `Recent message ${i}`));
      }

      const result = summarizeConversation(messages, 10);

      expect(result.summary).toContain('chart analysis');
      expect(result.summary).toContain('key levels');
      expect(result.summary).toContain('trading signals');
      expect(result.summary).toContain('trend analysis');
      expect(result.totalMessagesSummarized).toBe(10);
    });

    it('should handle empty messages array', () => {
      const result = summarizeConversation([], 10);

      expect(result.summary).toBe('');
      expect(result.recentMessages).toEqual([]);
      expect(result.totalMessagesSummarized).toBe(0);
    });

    it('should preserve message order in recentMessages', () => {
      const messages: ConversationMessage[] = [];
      for (let i = 0; i < 15; i++) {
        messages.push(createMessage('user', `Message ${i}`, `msg-${i}`));
      }

      const result = summarizeConversation(messages, 10);

      for (let i = 0; i < result.recentMessages.length - 1; i++) {
        const current = result.recentMessages[i];
        const next = result.recentMessages[i + 1];
        const currentNum = parseInt(current.id.split('-')[1]);
        const nextNum = parseInt(next.id.split('-')[1]);
        expect(nextNum).toBeGreaterThan(currentNum);
      }
    });

    it('should handle messagesToKeepFull of 0', () => {
      const messages: ConversationMessage[] = [
        createMessage('user', 'Message 1'),
        createMessage('user', 'Message 2'),
      ];

      const result = summarizeConversation(messages, 0);

      expect(result.recentMessages).toHaveLength(0);
      expect(result.totalMessagesSummarized).toBe(2);
      expect(result.summary).toBeTruthy();
    });

    it('should handle messagesToKeepFull larger than messages length', () => {
      const messages: ConversationMessage[] = [
        createMessage('user', 'Message 1'),
        createMessage('user', 'Message 2'),
      ];

      const result = summarizeConversation(messages, 100);

      expect(result.summary).toBe('');
      expect(result.recentMessages).toEqual(messages);
      expect(result.totalMessagesSummarized).toBe(0);
    });
  });
});
