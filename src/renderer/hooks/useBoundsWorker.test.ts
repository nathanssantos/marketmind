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
});
