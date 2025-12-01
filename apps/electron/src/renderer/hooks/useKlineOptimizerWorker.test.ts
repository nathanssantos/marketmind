import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useKlineOptimizerWorker } from './useKlineOptimizerWorker';

describe('useKlineOptimizerWorker', () => {
  it('should initialize worker hook', () => {
    const { result } = renderHook(() => useKlineOptimizerWorker());
    
    expect(result.current.optimizeKlines).toBeDefined();
    expect(result.current.terminate).toBeDefined();
    expect(typeof result.current.optimizeKlines).toBe('function');
    expect(typeof result.current.terminate).toBe('function');
  });

  it('should cleanup on unmount', () => {
    const { unmount } = renderHook(() => useKlineOptimizerWorker());
    
    expect(() => unmount()).not.toThrow();
  });

  it('should handle optimizeKlines call', () => {
    const { result } = renderHook(() => useKlineOptimizerWorker());
    
    const promise = result.current.optimizeKlines([]);
    
    expect(promise).toBeInstanceOf(Promise);
  });

  it('should handle optimizeKlines with detailedCount', () => {
    const { result } = renderHook(() => useKlineOptimizerWorker());
    
    const promise = result.current.optimizeKlines([], 100);
    
    expect(promise).toBeInstanceOf(Promise);
  });

  it('should handle terminate call', () => {
    const { result } = renderHook(() => useKlineOptimizerWorker());
    
    expect(() => result.current.terminate()).not.toThrow();
  });

  it('should return empty result after termination', async () => {
    const { result } = renderHook(() => useKlineOptimizerWorker());
    
    result.current.terminate();
    const optimized = await result.current.optimizeKlines([]);
    
    expect(optimized.detailed).toEqual([]);
    expect(optimized.simplified).toEqual([]);
  });

  it('should clear pending callbacks on unmount', () => {
    const { result, unmount } = renderHook(() => useKlineOptimizerWorker());
    
    result.current.optimizeKlines([]);
    
    expect(() => unmount()).not.toThrow();
  });
});
