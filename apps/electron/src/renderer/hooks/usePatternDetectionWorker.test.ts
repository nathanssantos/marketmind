import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { usePatternDetectionWorker } from './usePatternDetectionWorker';

describe('usePatternDetectionWorker', () => {
  it('should initialize hook without throwing', () => {
    expect(() => renderHook(() => usePatternDetectionWorker())).not.toThrow();
  });

  it('should return void', () => {
    const { result } = renderHook(() => usePatternDetectionWorker());
    expect(result.current).toBeUndefined();
  });

  it('should cleanup on unmount', () => {
    const { unmount } = renderHook(() => usePatternDetectionWorker());
    expect(() => unmount()).not.toThrow();
  });
});
