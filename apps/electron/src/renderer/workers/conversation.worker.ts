import {
    summarizeConversation,
    type ConversationMessage,
    type ConversationSummaryResult,
} from '../utils/conversationSummarization';

export interface ConversationWorkerRequest {
  type: 'summarize';
  messages: ConversationMessage[];
  messagesToKeepFull?: number;
}

export interface ConversationWorkerResponse extends ConversationSummaryResult {
  type: 'summaryResult';
}

const MIN_MESSAGES_FOR_SUMMARY = 15;

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

export { };

