export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

export interface ConversationSummaryResult {
  summary: string;
  recentMessages: ConversationMessage[];
  totalMessagesSummarized: number;
}

const MESSAGES_TO_KEEP_FULL = 10;

export const summarizeOldMessages = (messages: ConversationMessage[]): string => {
  if (messages.length === 0) return '';

  const topics: string[] = [];
  const keyPoints: string[] = [];

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (msg?.role !== 'user') continue;

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

  const uniqueTopics = [...new Set(topics)];
  const topicsSummary =
    uniqueTopics.length > 0
      ? `Topics discussed: ${uniqueTopics.join(', ')}.`
      : 'General market discussion.';

  return `[Previous Conversation Summary - ${messages.length} messages]\n${topicsSummary}`;
};

export const summarizeConversation = (
  messages: ConversationMessage[],
  messagesToKeepFull: number = MESSAGES_TO_KEEP_FULL
): ConversationSummaryResult => {
  if (messages.length <= messagesToKeepFull) {
    return {
      summary: '',
      recentMessages: messages,
      totalMessagesSummarized: 0,
    };
  }

  const splitIndex = messages.length - messagesToKeepFull;
  const oldMessages = messages.slice(0, splitIndex);
  const recentMessages = messages.slice(splitIndex);

  const summary = summarizeOldMessages(oldMessages);

  return {
    summary,
    recentMessages,
    totalMessagesSummarized: oldMessages.length,
  };
};
