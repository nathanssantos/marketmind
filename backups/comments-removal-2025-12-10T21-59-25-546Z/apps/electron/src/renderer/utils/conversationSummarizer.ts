import type { AIMessage } from '@marketmind/types';

export interface SummarizedConversation {
  summary: string;
  recentMessages: AIMessage[];
  totalMessagesSummarized: number;
}

const MESSAGES_TO_KEEP_FULL = 10;
const MIN_MESSAGES_FOR_SUMMARY = 15;

export const shouldSummarizeConversation = (messages: AIMessage[]): boolean => {
  return messages.length > MIN_MESSAGES_FOR_SUMMARY;
};

export const summarizeOldMessages = (messages: AIMessage[]): string => {
  if (messages.length === 0) return '';
  
  const topics: string[] = [];
  const keyPoints: string[] = [];
  
  messages.forEach((msg) => {
    if (msg.role === 'user') {
      const content = msg.content.toLowerCase();
      
      if (content.includes('analyze') || content.includes('chart')) {
        topics.push('chart analysis');
      }
      if (content.includes('buy') || content.includes('sell')) {
        topics.push('trading signals');
      }
      if (content.includes('support') || content.includes('resistance')) {
        topics.push('key levels');
      }
      if (content.includes('trend')) {
        topics.push('trend analysis');
      }
      if (content.includes('news')) {
        topics.push('market news');
      }
      
      if (msg.content.length > 50) {
        keyPoints.push(`${msg.content.substring(0, 100)  }...`);
      }
    }
  });
  
  const uniqueTopics = [...new Set(topics)];
  const topicsSummary = uniqueTopics.length > 0 
    ? `Topics discussed: ${uniqueTopics.join(', ')}.` 
    : 'General market discussion.';
  
  return `[Previous Conversation Summary - ${messages.length} messages]\n${topicsSummary}`;
};

export const summarizeConversation = (
  messages: AIMessage[]
): SummarizedConversation => {
  if (messages.length <= MESSAGES_TO_KEEP_FULL) {
    return {
      summary: '',
      recentMessages: messages,
      totalMessagesSummarized: 0,
    };
  }
  
  const splitIndex = messages.length - MESSAGES_TO_KEEP_FULL;
  const oldMessages = messages.slice(0, splitIndex);
  const recentMessages = messages.slice(splitIndex);
  
  const summary = summarizeOldMessages(oldMessages);
  
  return {
    summary,
    recentMessages,
    totalMessagesSummarized: oldMessages.length,
  };
};

export const buildOptimizedMessages = (
  messages: AIMessage[],
  includeImages: boolean = true
): AIMessage[] => {
  if (!shouldSummarizeConversation(messages)) {
    return messages;
  }
  
  const { summary, recentMessages } = summarizeConversation(messages);
  
  const optimizedMessages: AIMessage[] = [];
  
  if (summary) {
    optimizedMessages.push({
      id: 'summary',
      role: 'assistant',
      content: summary,
      openTime: Date.now(),
    });
  }
  
  recentMessages.forEach((msg) => {
    const optimizedMsg: AIMessage = {
      ...msg,
    };
    
    if (!includeImages && msg.images && msg.images.length > 0) {
      optimizedMsg.images = [];
      optimizedMsg.content = `[Previous message with ${msg.images.length} image(s)]\n\n${msg.content}`;
    }
    
    optimizedMessages.push(optimizedMsg);
  });
  
  return optimizedMessages;
};
