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

  it('should handle calculateMovingAverages call', () => {
    const { result } = renderHook(() => useMovingAverageWorker());
    
    const promise = result.current.calculateMovingAverages([], []);
    
    expect(promise).toBeInstanceOf(Promise);
  });

  it('should handle terminate call', () => {
    const { result } = renderHook(() => useMovingAverageWorker());
    
    expect(() => result.current.terminate()).not.toThrow();
  });

  it('should return empty result after termination', async () => {
    const { result } = renderHook(() => useMovingAverageWorker());
    
    result.current.terminate();
    const averages = await result.current.calculateMovingAverages([], []);
    
    expect(averages).toEqual([]);
  });

  it('should clear pending callbacks on unmount', () => {
    const { result, unmount } = renderHook(() => useMovingAverageWorker());
    
    result.current.calculateMovingAverages([], []);
    
    expect(() => unmount()).not.toThrow();
  });
});
