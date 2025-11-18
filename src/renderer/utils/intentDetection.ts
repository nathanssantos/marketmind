import type { AIMessage } from '@shared/types';
import optimizedPrompts from '../services/ai/prompts-optimized.json';

export type PromptMode = 'simple' | 'full';

const DETAILED_KEYWORDS = optimizedPrompts.intentKeywords.detailedAnalysis;
const SIMPLE_KEYWORDS = optimizedPrompts.intentKeywords.simpleQuestion;

export const detectIntentFromMessage = (message: string): PromptMode => {
  const lowerMessage = message.toLowerCase();
  
  const hasDetailedKeywords = DETAILED_KEYWORDS.some(keyword => 
    lowerMessage.includes(keyword.toLowerCase())
  );
  
  const hasSimpleKeywords = SIMPLE_KEYWORDS.some(keyword => 
    lowerMessage.includes(keyword.toLowerCase())
  );
  
  if (hasDetailedKeywords) {
    return 'full';
  }
  
  if (hasSimpleKeywords && !hasDetailedKeywords) {
    return 'simple';
  }
  
  if (message.length > 100) {
    return 'full';
  }
  
  return 'simple';
};

export const detectIntentFromConversation = (messages: AIMessage[]): PromptMode => {
  if (messages.length === 0) return 'simple';
  
  const recentMessages = messages.slice(-3);
  
  const hasChartAnalysisRequest = recentMessages.some(msg => 
    msg.role === 'user' && msg.images && msg.images.length > 0
  );
  
  if (hasChartAnalysisRequest) {
    return 'full';
  }
  
  const lastUserMessage = [...recentMessages]
    .reverse()
    .find(msg => msg.role === 'user');
  
  if (!lastUserMessage) return 'simple';
  
  return detectIntentFromMessage(lastUserMessage.content);
};

export const getSystemPrompt = (mode: PromptMode, type: 'chat' | 'chartAnalysis' = 'chat'): string => {
  if (type === 'chartAnalysis') {
    return mode === 'full' 
      ? optimizedPrompts.chartAnalysis.full.system 
      : optimizedPrompts.chartAnalysis.simple.system;
  }
  
  return mode === 'full'
    ? optimizedPrompts.chat.full.system
    : optimizedPrompts.chat.simple.system;
};
