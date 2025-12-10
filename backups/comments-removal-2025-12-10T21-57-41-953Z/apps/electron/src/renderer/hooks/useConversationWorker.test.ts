import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useConversationWorker } from './useConversationWorker';

describe('useConversationWorker', () => {
  it('should initialize worker hook', () => {
    const { result } = renderHook(() => useConversationWorker());
    
    expect(result.current.summarizeConversation).toBeDefined();
    expect(result.current.terminate).toBeDefined();
    expect(typeof result.current.summarizeConversation).toBe('function');
    expect(typeof result.current.terminate).toBe('function');
  });

  it('should cleanup on unmount', () => {
    const { unmount } = renderHook(() => useConversationWorker());
    
    expect(() => unmount()).not.toThrow();
  });

  it('should handle summarizeConversation call', () => {
    const { result } = renderHook(() => useConversationWorker());
    
    const promise = result.current.summarizeConversation([]);
    
    expect(promise).toBeInstanceOf(Promise);
  });

  it('should handle terminate call', () => {
    const { result } = renderHook(() => useConversationWorker());
    
    expect(() => result.current.terminate()).not.toThrow();
  });

  it('should return empty result after termination', async () => {
    const { result } = renderHook(() => useConversationWorker());
    
    result.current.terminate();
    const summary = await result.current.summarizeConversation([]);
    
    expect(summary.summary).toBe('');
    expect(summary.recentMessages).toEqual([]);
    expect(summary.totalMessagesSummarized).toBe(0);
  });

  it('should clear pending callbacks on unmount', () => {
    const { result, unmount } = renderHook(() => useConversationWorker());
    
    result.current.summarizeConversation([]);
    
    expect(() => unmount()).not.toThrow();
  });
});
