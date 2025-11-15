import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AIMessage, AIProviderType, AIAnalysisResponse } from '@shared/types';

export interface Conversation {
  id: string;
  title: string;
  messages: AIMessage[];
  createdAt: number;
  updatedAt: number;
}

export interface AISettings {
  provider: AIProviderType;
  apiKey: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

interface AIState {
  conversations: Conversation[];
  activeConversationId: string | null;
  settings: AISettings | null;
  isLoading: boolean;
  error: string | null;
  lastAnalysis: AIAnalysisResponse | null;

  setSettings: (settings: AISettings) => void;
  updateSettings: (partialSettings: Partial<AISettings>) => void;
  clearSettings: () => void;

  createConversation: (title?: string) => string;
  deleteConversation: (id: string) => void;
  setActiveConversation: (id: string | null) => void;
  updateConversationTitle: (id: string, title: string) => void;

  addMessage: (conversationId: string, message: Omit<AIMessage, 'id' | 'timestamp'>) => void;
  updateMessage: (conversationId: string, messageId: string, content: string) => void;
  deleteMessage: (conversationId: string, messageId: string) => void;
  clearMessages: (conversationId: string) => void;

  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setLastAnalysis: (analysis: AIAnalysisResponse | null) => void;

  getActiveConversation: () => Conversation | null;
  getConversationMessages: (id: string) => AIMessage[];

  exportConversation: (id: string) => string;
  importConversation: (data: string) => void;

  clearAll: () => void;
}

const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

const generateTitle = (messages: AIMessage[]): string => {
  if (messages.length === 0) return 'New Conversation';
  
  const firstUserMessage = messages.find(m => m.role === 'user');
  if (!firstUserMessage) return 'New Conversation';
  
  const preview = firstUserMessage.content.slice(0, 50);
  return preview.length < firstUserMessage.content.length 
    ? `${preview}...` 
    : preview;
};

export const useAIStore = create<AIState>()(
  persist(
    (set, get) => ({
      conversations: [],
      activeConversationId: null,
      settings: null,
      isLoading: false,
      error: null,
      lastAnalysis: null,

      setSettings: (settings) => set({ settings }),
      
      updateSettings: (partialSettings) => set((state) => ({
        settings: state.settings 
          ? { ...state.settings, ...partialSettings }
          : null,
      })),

      clearSettings: () => set({ settings: null }),

      createConversation: (title) => {
        const id = generateId();
        const now = Date.now();
        
        const conversation: Conversation = {
          id,
          title: title || 'New Conversation',
          messages: [],
          createdAt: now,
          updatedAt: now,
        };

        set((state) => ({
          conversations: [...state.conversations, conversation],
          activeConversationId: id,
        }));

        return id;
      },

      deleteConversation: (id) => set((state) => ({
        conversations: state.conversations.filter(c => c.id !== id),
        activeConversationId: state.activeConversationId === id 
          ? null 
          : state.activeConversationId,
      })),

      setActiveConversation: (id) => set({ activeConversationId: id }),

      updateConversationTitle: (id, title) => set((state) => ({
        conversations: state.conversations.map(c =>
          c.id === id ? { ...c, title, updatedAt: Date.now() } : c
        ),
      })),

      addMessage: (conversationId, message) => set((state) => {
        const conversations = state.conversations.map(c => {
          if (c.id !== conversationId) return c;

          const newMessage: AIMessage = {
            ...message,
            id: generateId(),
            timestamp: Date.now(),
          };

          const updatedMessages = [...c.messages, newMessage];
          
          const title = c.title === 'New Conversation' 
            ? generateTitle(updatedMessages)
            : c.title;

          return {
            ...c,
            messages: updatedMessages,
            title,
            updatedAt: Date.now(),
          };
        });

        return { conversations };
      }),

      updateMessage: (conversationId, messageId, content) => set((state) => ({
        conversations: state.conversations.map(c => {
          if (c.id !== conversationId) return c;

          return {
            ...c,
            messages: c.messages.map(m =>
              m.id === messageId ? { ...m, content } : m
            ),
            updatedAt: Date.now(),
          };
        }),
      })),

      deleteMessage: (conversationId, messageId) => set((state) => ({
        conversations: state.conversations.map(c => {
          if (c.id !== conversationId) return c;

          return {
            ...c,
            messages: c.messages.filter(m => m.id !== messageId),
            updatedAt: Date.now(),
          };
        }),
      })),

      clearMessages: (conversationId) => set((state) => ({
        conversations: state.conversations.map(c => {
          if (c.id !== conversationId) return c;

          return {
            ...c,
            messages: [],
            title: 'New Conversation',
            updatedAt: Date.now(),
          };
        }),
      })),

      setLoading: (loading) => set({ isLoading: loading }),
      
      setError: (error) => set({ error }),
      
      setLastAnalysis: (analysis) => set({ lastAnalysis: analysis }),

      getActiveConversation: () => {
        const state = get();
        if (!state.activeConversationId) return null;
        
        return state.conversations.find(c => c.id === state.activeConversationId) || null;
      },

      getConversationMessages: (id) => {
        const conversation = get().conversations.find(c => c.id === id);
        return conversation?.messages || [];
      },

      exportConversation: (id) => {
        const conversation = get().conversations.find(c => c.id === id);
        if (!conversation) throw new Error('Conversation not found');
        
        return JSON.stringify(conversation, null, 2);
      },

      importConversation: (data) => {
        try {
          const conversation = JSON.parse(data) as Conversation;
          
          const newId = generateId();
          const importedConversation: Conversation = {
            ...conversation,
            id: newId,
            title: `${conversation.title} (Imported)`,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };

          set((state) => ({
            conversations: [...state.conversations, importedConversation],
            activeConversationId: newId,
          }));
        } catch (error) {
          throw new Error('Invalid conversation data');
        }
      },

      clearAll: () => set({
        conversations: [],
        activeConversationId: null,
        isLoading: false,
        error: null,
        lastAnalysis: null,
      }),
    }),
    {
      name: 'marketmind-ai-storage',
      partialize: (state) => ({
        conversations: state.conversations,
        activeConversationId: state.activeConversationId,
        settings: state.settings,
      }),
    }
  )
);
