import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useCandleOptimizerWorker } from './useCandleOptimizerWorker';

describe('useCandleOptimizerWorker', () => {
  it('should initialize worker hook', () => {
    const { result } = renderHook(() => useCandleOptimizerWorker());
    
    expect(result.current.optimizeCandles).toBeDefined();
    expect(result.current.terminate).toBeDefined();
    expect(typeof result.current.optimizeCandles).toBe('function');
    expect(typeof result.current.terminate).toBe('function');
  });

  it('should cleanup on unmount', () => {
    const { unmount } = renderHook(() => useCandleOptimizerWorker());
    
    expect(() => unmount()).not.toThrow();
  });
});
