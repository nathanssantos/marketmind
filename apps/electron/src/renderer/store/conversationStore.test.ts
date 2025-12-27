import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useConversationStore } from './conversationStore';

describe('conversationStore', () => {
  beforeEach(() => {
    act(() => {
      useConversationStore.setState({
        conversations: [],
        activeConversationId: null,
        messages: [],
      });
    });
  });

  afterEach(() => {
    act(() => {
      useConversationStore.getState().clearAll();
    });
  });

  it('should have empty initial state', () => {
    const { result } = renderHook(() => useConversationStore());
    expect(result.current.conversations).toHaveLength(0);
    expect(result.current.activeConversationId).toBeNull();
    expect(result.current.messages).toHaveLength(0);
  });

  it('should create conversation', () => {
    const { result } = renderHook(() => useConversationStore());
    let id: string;
    act(() => {
      id = result.current.createConversation('Test Conversation', 'BTCUSDT');
    });
    expect(result.current.conversations).toHaveLength(1);
    expect(result.current.conversations[0].title).toBe('Test Conversation');
    expect(result.current.conversations[0].symbol).toBe('BTCUSDT');
    expect(result.current.activeConversationId).toBe(id!);
  });

  it('should start new conversation', () => {
    const { result } = renderHook(() => useConversationStore());
    act(() => {
      result.current.startNewConversation('ETHUSDT');
    });
    expect(result.current.conversations).toHaveLength(1);
    expect(result.current.conversations[0].symbol).toBe('ETHUSDT');
    expect(result.current.messages).toHaveLength(0);
  });

  it('should delete conversation', () => {
    const { result } = renderHook(() => useConversationStore());
    let id: string;
    act(() => {
      id = result.current.createConversation('Test');
      result.current.deleteConversation(id);
    });
    expect(result.current.conversations).toHaveLength(0);
    expect(result.current.activeConversationId).toBeNull();
  });

  it('should set active conversation', () => {
    const { result } = renderHook(() => useConversationStore());
    let id1: string, id2: string;
    act(() => {
      id1 = result.current.createConversation('First');
      id2 = result.current.createConversation('Second');
    });
    expect(result.current.activeConversationId).toBe(id2!);
    act(() => {
      result.current.setActiveConversation(id1!);
    });
    expect(result.current.activeConversationId).toBe(id1!);
  });

  it('should add message to conversation', () => {
    const { result } = renderHook(() => useConversationStore());
    let id: string;
    act(() => {
      id = result.current.createConversation('Test');
      result.current.addMessage(id, { role: 'user', content: 'Hello' });
    });
    const conversation = result.current.conversations.find(c => c.id === id!);
    expect(conversation?.messages).toHaveLength(1);
    expect(conversation?.messages[0].role).toBe('user');
    expect(conversation?.messages[0].content).toBe('Hello');
  });

  it('should update conversation title from first message', () => {
    const { result } = renderHook(() => useConversationStore());
    let id: string;
    act(() => {
      id = result.current.createConversation();
      result.current.addMessage(id, { role: 'user', content: 'Analyze BTCUSDT' });
    });
    const conversation = result.current.conversations.find(c => c.id === id!);
    expect(conversation?.title).toBe('Analyze BTCUSDT');
  });

  it('should update message', () => {
    const { result } = renderHook(() => useConversationStore());
    let convId: string;
    act(() => {
      convId = result.current.createConversation('Test');
      result.current.addMessage(convId, { role: 'user', content: 'Original' });
    });
    const messageId = result.current.conversations.find(c => c.id === convId!)?.messages[0].id;
    act(() => {
      result.current.updateMessage(convId!, messageId!, 'Updated');
    });
    const conversation = result.current.conversations.find(c => c.id === convId!);
    expect(conversation?.messages[0].content).toBe('Updated');
  });

  it('should delete message', () => {
    const { result } = renderHook(() => useConversationStore());
    let convId: string;
    act(() => {
      convId = result.current.createConversation('Test');
      result.current.addMessage(convId, { role: 'user', content: 'Message' });
    });
    const messageId = result.current.conversations.find(c => c.id === convId!)?.messages[0].id;
    act(() => {
      result.current.deleteMessage(convId!, messageId!);
    });
    const conversation = result.current.conversations.find(c => c.id === convId!);
    expect(conversation?.messages).toHaveLength(0);
  });

  it('should clear messages', () => {
    const { result } = renderHook(() => useConversationStore());
    let id: string;
    act(() => {
      id = result.current.createConversation('Test');
      result.current.addMessage(id, { role: 'user', content: 'Message' });
      result.current.clearMessages(id);
    });
    const conversation = result.current.conversations.find(c => c.id === id!);
    expect(conversation?.messages).toHaveLength(0);
    expect(conversation?.title).toBe('New Conversation');
  });

  it('should export and import conversation', () => {
    const { result } = renderHook(() => useConversationStore());
    let id: string;
    act(() => {
      id = result.current.createConversation('Export Test', 'BTCUSDT');
      result.current.addMessage(id, { role: 'user', content: 'Hello' });
    });
    let exported: string;
    act(() => {
      exported = result.current.exportConversation(id!);
    });
    act(() => {
      result.current.clearAll();
      result.current.importConversation(exported!);
    });
    expect(result.current.conversations).toHaveLength(1);
    expect(result.current.conversations[0].title).toBe('Export Test (Imported)');
  });

  it('should get active conversation', () => {
    const { result } = renderHook(() => useConversationStore());
    let id: string;
    act(() => {
      id = result.current.createConversation('Active Test');
    });
    const active = result.current.getActiveConversation();
    expect(active?.id).toBe(id!);
    expect(active?.title).toBe('Active Test');
  });

  it('should get conversations by symbol', () => {
    const { result } = renderHook(() => useConversationStore());
    act(() => {
      result.current.createConversation('BTC 1', 'BTCUSDT');
      result.current.createConversation('ETH 1', 'ETHUSDT');
      result.current.createConversation('BTC 2', 'BTCUSDT');
    });
    const btcConversations = result.current.getConversationsBySymbol('BTCUSDT');
    expect(btcConversations).toHaveLength(2);
  });

  it('should clear all conversations', () => {
    const { result } = renderHook(() => useConversationStore());
    act(() => {
      result.current.createConversation('Test 1');
      result.current.createConversation('Test 2');
      result.current.clearAll();
    });
    expect(result.current.conversations).toHaveLength(0);
    expect(result.current.activeConversationId).toBeNull();
    expect(result.current.messages).toHaveLength(0);
  });

  it('should update conversation pattern data id', () => {
    const { result } = renderHook(() => useConversationStore());
    let id: string;
    act(() => {
      id = result.current.createConversation('Test');
      result.current.updateConversationPatternDataId(id, 'pattern-123');
    });
    const conversation = result.current.conversations.find(c => c.id === id!);
    expect(conversation?.patternDataId).toBe('pattern-123');
  });
});
