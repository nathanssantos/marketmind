import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { usePatternRelationshipsWorker } from './usePatternRelationshipsWorker';

describe('usePatternRelationshipsWorker', () => {
  it('should initialize hook without throwing', () => {
    expect(() => renderHook(() => usePatternRelationshipsWorker())).not.toThrow();
  });

  it('should return buildRelationships function', () => {
    const { result } = renderHook(() => usePatternRelationshipsWorker());
    expect(result.current.buildRelationships).toBeTypeOf('function');
  });

  it('should return terminate function', () => {
    const { result } = renderHook(() => usePatternRelationshipsWorker());
    expect(result.current.terminate).toBeTypeOf('function');
  });

  it('should cleanup on unmount', () => {
    const { unmount } = renderHook(() => usePatternRelationshipsWorker());
    expect(() => unmount()).not.toThrow();
  });

  it('should build relationships with empty patterns without throwing', async () => {
    const { result } = renderHook(() => usePatternRelationshipsWorker());
    const relationships = await result.current.buildRelationships([], false);
    expect(relationships).toEqual([]);
  });
});
