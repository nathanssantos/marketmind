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
});
