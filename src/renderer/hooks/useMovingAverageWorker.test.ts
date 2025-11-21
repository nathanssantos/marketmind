import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useMovingAverageWorker } from './useMovingAverageWorker';

describe('useMovingAverageWorker', () => {
  it('should initialize worker hook', () => {
    const { result } = renderHook(() => useMovingAverageWorker());
    
    expect(result.current.calculateMovingAverages).toBeDefined();
    expect(result.current.terminate).toBeDefined();
    expect(typeof result.current.calculateMovingAverages).toBe('function');
    expect(typeof result.current.terminate).toBe('function');
  });

  it('should cleanup on unmount', () => {
    const { unmount } = renderHook(() => useMovingAverageWorker());
    
    expect(() => unmount()).not.toThrow();
  });
});
