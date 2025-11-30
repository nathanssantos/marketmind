import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useBoundsWorker } from './useBoundsWorker';

describe('useBoundsWorker', () => {
  it('should initialize worker hook', () => {
    const { result } = renderHook(() => useBoundsWorker());
    
    expect(result.current.calculateBounds).toBeDefined();
    expect(result.current.terminate).toBeDefined();
    expect(typeof result.current.calculateBounds).toBe('function');
    expect(typeof result.current.terminate).toBe('function');
  });

  it('should cleanup on unmount', () => {
    const { unmount } = renderHook(() => useBoundsWorker());
    
    expect(() => unmount()).not.toThrow();
  });

  it('should handle calculateBounds call', () => {
    const { result } = renderHook(() => useBoundsWorker());
    
    const promise = result.current.calculateBounds([], 0, 10);
    
    expect(promise).toBeInstanceOf(Promise);
  });

  it('should handle terminate call', () => {
    const { result } = renderHook(() => useBoundsWorker());
    
    expect(() => result.current.terminate()).not.toThrow();
  });

  it('should return zero bounds after termination', async () => {
    const { result } = renderHook(() => useBoundsWorker());
    
    result.current.terminate();
    const bounds = await result.current.calculateBounds([], 0, 0);
    
    expect(bounds).toEqual({
      minPrice: 0,
      maxPrice: 0,
      minVolume: 0,
      maxVolume: 0,
    });
  });
});
