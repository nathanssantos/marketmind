export interface ConversationWorkerRequest {
  type: 'summarize';
  messages: Array<{
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
  }>;
  messagesToKeepFull?: number;
}

export interface ConversationWorkerResponse {
  type: 'summaryResult';
  summary: string;
  recentMessages: Array<{
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
  }>;
  totalMessagesSummarized: number;
}

const MESSAGES_TO_KEEP_FULL = 10;
const MIN_MESSAGES_FOR_SUMMARY = 15;

const summarizeOldMessages = (
  messages: ConversationWorkerRequest['messages']
): string => {
  if (messages.length === 0) return '';

  const topics: string[] = [];
  const keyPoints: string[] = [];

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (!msg || msg.role !== 'user') continue;

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
      keyPoints.push(msg.content.substring(0, 100) + '...');
    }
  }

  const uniqueTopics = [...new Set(topics)];
  const topicsSummary =
    uniqueTopics.length > 0
      ? `Topics discussed: ${uniqueTopics.join(', ')}.`
      : 'General market discussion.';

  return `[Previous Conversation Summary - ${messages.length} messages]\n${topicsSummary}`;
};

const summarizeConversation = (
  messages: ConversationWorkerRequest['messages'],
  messagesToKeepFull: number = MESSAGES_TO_KEEP_FULL
): Omit<ConversationWorkerResponse, 'type'> => {
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

self.onmessage = (event: MessageEvent<ConversationWorkerRequest>) => {
  const { type, messages, messagesToKeepFull } = event.data;

  if (type !== 'summarize') return;

  if (messages.length <= MIN_MESSAGES_FOR_SUMMARY) {
    const response: ConversationWorkerResponse = {
      type: 'summaryResult',
      summary: '',
      recentMessages: messages,
      totalMessagesSummarized: 0,
    };
    self.postMessage(response);
    return;
  }

  const result = summarizeConversation(messages, messagesToKeepFull);

  const response: ConversationWorkerResponse = {
    type: 'summaryResult',
    ...result,
  };

  self.postMessage(response);
};

export {};
