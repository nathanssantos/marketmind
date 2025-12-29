import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useStochasticWorker } from './useStochasticWorker';

describe('useStochasticWorker', () => {
  it('should initialize hook without throwing', () => {
    expect(() => renderHook(() => useStochasticWorker())).not.toThrow();
  });

  it('should return calculateStochastic function', () => {
    const { result } = renderHook(() => useStochasticWorker());
    expect(result.current.calculateStochastic).toBeTypeOf('function');
  });

  it('should return terminate function', () => {
    const { result } = renderHook(() => useStochasticWorker());
    expect(result.current.terminate).toBeTypeOf('function');
  });

  it('should cleanup on unmount', () => {
    const { unmount } = renderHook(() => useStochasticWorker());
    expect(() => unmount()).not.toThrow();
  });

  it('should terminate without throwing', () => {
    const { result } = renderHook(() => useStochasticWorker());
    expect(() => result.current.terminate()).not.toThrow();
  });
});
