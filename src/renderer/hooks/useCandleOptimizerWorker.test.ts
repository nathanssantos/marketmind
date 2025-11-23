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

  it('should handle optimizeCandles call', () => {
    const { result } = renderHook(() => useCandleOptimizerWorker());
    
    const promise = result.current.optimizeCandles([]);
    
    expect(promise).toBeInstanceOf(Promise);
  });

  it('should handle optimizeCandles with detailedCount', () => {
    const { result } = renderHook(() => useCandleOptimizerWorker());
    
    const promise = result.current.optimizeCandles([], 100);
    
    expect(promise).toBeInstanceOf(Promise);
  });

  it('should handle terminate call', () => {
    const { result } = renderHook(() => useCandleOptimizerWorker());
    
    expect(() => result.current.terminate()).not.toThrow();
  });

  it('should return empty result after termination', async () => {
    const { result } = renderHook(() => useCandleOptimizerWorker());
    
    result.current.terminate();
    const optimized = await result.current.optimizeCandles([]);
    
    expect(optimized.detailed).toEqual([]);
    expect(optimized.simplified).toEqual([]);
    expect(optimized.timestampInfo.total).toBe(0);
  });

  it('should clear pending callbacks on unmount', () => {
    const { result, unmount } = renderHook(() => useCandleOptimizerWorker());
    
    result.current.optimizeCandles([]);
    
    expect(() => unmount()).not.toThrow();
  });
});
