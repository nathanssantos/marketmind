import type { AIMessage } from '@marketmind/types';
import { create } from 'zustand';

const MAX_MESSAGES_PER_CONVERSATION = 100;
const MAX_STORED_CONVERSATIONS = 50;

export interface Conversation {
  id: string;
  title: string;
  messages: AIMessage[];
  createdAt: number;
  updatedAt: number;
  symbol?: string;
  patternDataId?: string;
}

const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

const generateTitle = (messages: AIMessage[]): string => {
  if (messages.length === 0) return 'New Conversation';

  const firstUserMessage = messages.find((m) => m.role === 'user');
  if (!firstUserMessage) return 'New Conversation';

  const preview = firstUserMessage.content.slice(0, 50);
  return preview.length < firstUserMessage.content.length
    ? `${preview}...`
    : preview;
};

interface ConversationState {
  conversations: Conversation[];
  activeConversationId: string | null;
  messages: AIMessage[];

  createConversation: (title?: string, symbol?: string) => string;
  startNewConversation: (symbol?: string) => string;
  deleteConversation: (id: string) => void;
  setActiveConversation: (id: string | null) => void;
  setActiveConversationBySymbol: (symbol: string) => void;
  restoreActiveConversation: () => void;
  updateConversationTitle: (id: string, title: string) => void;
  updateConversationPatternDataId: (
    id: string,
    patternDataId: string | undefined
  ) => void;

  addMessage: (
    conversationId: string,
    message: Omit<AIMessage, 'id' | 'openTime'>
  ) => void;
  updateMessage: (
    conversationId: string,
    messageId: string,
    content: string
  ) => void;
  deleteMessage: (conversationId: string, messageId: string) => void;
  clearMessages: (conversationId: string) => void;

  getActiveConversation: () => Conversation | null;
  getConversationMessages: (id: string) => AIMessage[];
  getConversationsBySymbol: (symbol: string) => Conversation[];

  exportConversation: (id: string) => string;
  importConversation: (data: string) => void;

  clearAll: () => void;
  loadFromStorage: (data: Partial<ConversationState>) => void;
  getStorageData: () => Pick<
    ConversationState,
    'conversations' | 'activeConversationId'
  >;
}

export const useConversationStore = create<ConversationState>((set, get) => ({
  conversations: [],
  activeConversationId: null,
  messages: [],

  createConversation: (title, symbol) => {
    const id = generateId();
    const now = Date.now();

    const conversation: Conversation = {
      id,
      title: title || 'New Conversation',
      messages: [],
      createdAt: now,
      updatedAt: now,
      ...(symbol ? { symbol } : {}),
    };

    set((state) => ({
      conversations: [...state.conversations, conversation],
      activeConversationId: id,
    }));

    return id;
  },

  startNewConversation: (symbol) => {
    const newId = get().createConversation(undefined, symbol);
    set({
      activeConversationId: newId,
      messages: [],
    });
    return newId;
  },

  deleteConversation: (id) =>
    set((state) => {
      const wasActive = state.activeConversationId === id;
      return {
        conversations: state.conversations.filter((c) => c.id !== id),
        activeConversationId: wasActive ? null : state.activeConversationId,
        messages: wasActive ? [] : state.messages,
      };
    }),

  setActiveConversation: (id) => {
    const state = get();
    const conversation = state.conversations.find((c) => c.id === id);
    set({
      activeConversationId: id,
      messages: conversation?.messages || [],
    });
  },

  setActiveConversationBySymbol: (symbol) => {
    const state = get();
    const conversationForSymbol = state.conversations
      .filter((c) => c.symbol === symbol)
      .sort((a, b) => b.updatedAt - a.updatedAt)[0];

    if (conversationForSymbol) {
      set({
        activeConversationId: conversationForSymbol.id,
        messages: conversationForSymbol.messages,
      });
    } else {
      const newId = get().createConversation(undefined, symbol);
      set({
        activeConversationId: newId,
        messages: [],
      });
    }
  },

  restoreActiveConversation: () => {
    const state = get();
    if (!state.activeConversationId) return;

    const conversation = state.conversations.find(
      (c) => c.id === state.activeConversationId
    );
    if (conversation) {
      set({ messages: conversation.messages });
    }
  },

  updateConversationTitle: (id, title) =>
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === id ? { ...c, title, updatedAt: Date.now() } : c
      ),
    })),

  updateConversationPatternDataId: (id, patternDataId) =>
    set((state) => ({
      conversations: state.conversations.map((c) => {
        if (c.id !== id) return c;
        const updated: Conversation = { ...c, updatedAt: Date.now() };
        if (patternDataId !== undefined) {
          updated.patternDataId = patternDataId;
        } else {
          delete updated.patternDataId;
        }
        return updated;
      }),
    })),

  addMessage: (conversationId, message) =>
    set((state) => {
      const conversations = state.conversations.map((c) => {
        if (c.id !== conversationId) return c;

        const newMessage: AIMessage = {
          ...message,
          id: generateId(),
          openTime: Date.now(),
        };

        let updatedMessages = [...c.messages, newMessage];

        if (updatedMessages.length > MAX_MESSAGES_PER_CONVERSATION) {
          updatedMessages = updatedMessages.slice(-MAX_MESSAGES_PER_CONVERSATION);
        }

        const title =
          c.title === 'New Conversation'
            ? generateTitle(updatedMessages)
            : c.title;

        return {
          ...c,
          messages: updatedMessages,
          title,
          updatedAt: Date.now(),
        };
      });

      let limitedConversations = conversations;
      if (limitedConversations.length > MAX_STORED_CONVERSATIONS) {
        limitedConversations = limitedConversations
          .sort((a, b) => b.updatedAt - a.updatedAt)
          .slice(0, MAX_STORED_CONVERSATIONS);
      }

      return { conversations: limitedConversations };
    }),

  updateMessage: (conversationId, messageId, content) =>
    set((state) => ({
      conversations: state.conversations.map((c) => {
        if (c.id !== conversationId) return c;

        return {
          ...c,
          messages: c.messages.map((m) =>
            m.id === messageId ? { ...m, content } : m
          ),
          updatedAt: Date.now(),
        };
      }),
    })),

  deleteMessage: (conversationId, messageId) =>
    set((state) => ({
      conversations: state.conversations.map((c) => {
        if (c.id !== conversationId) return c;

        return {
          ...c,
          messages: c.messages.filter((m) => m.id !== messageId),
          updatedAt: Date.now(),
        };
      }),
    })),

  clearMessages: (conversationId) =>
    set((state) => ({
      conversations: state.conversations.map((c) => {
        if (c.id !== conversationId) return c;

        return {
          ...c,
          messages: [],
          title: 'New Conversation',
          updatedAt: Date.now(),
        };
      }),
    })),

  getActiveConversation: () => {
    const state = get();
    if (!state.activeConversationId) return null;

    return (
      state.conversations.find((c) => c.id === state.activeConversationId) ||
      null
    );
  },

  getConversationMessages: (id) => {
    const conversation = get().conversations.find((c) => c.id === id);
    return conversation?.messages || [];
  },

  getConversationsBySymbol: (symbol) => {
    return get()
      .conversations.filter((c) => c.symbol === symbol)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  },

  exportConversation: (id) => {
    const conversation = get().conversations.find((c) => c.id === id);
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
    } catch {
      throw new Error('Invalid conversation data');
    }
  },

  clearAll: () =>
    set({
      conversations: [],
      activeConversationId: null,
      messages: [],
    }),

  loadFromStorage: (data) => set(data),

  getStorageData: () => {
    const state = get();
    return {
      conversations: state.conversations,
      activeConversationId: state.activeConversationId,
    };
  },
}));
