import { describe, expect, it } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useDebounce } from './useDebounce';

describe('useDebounce', () => {
  it('should return initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('initial', 100));

    expect(result.current).toBe('initial');
  });

  it('should debounce value changes', async () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'initial', delay: 100 } }
    );

    expect(result.current).toBe('initial');

    rerender({ value: 'updated', delay: 100 });
    expect(result.current).toBe('initial');

    await waitFor(
      () => {
        expect(result.current).toBe('updated');
      },
      { timeout: 200 }
    );
  });

  it('should reset timer on rapid value changes', async () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 'initial', delay: 100 } }
    );

    rerender({ value: 'update1', delay: 100 });
    await new Promise(resolve => setTimeout(resolve, 50));
    
    rerender({ value: 'update2', delay: 100 });
    await new Promise(resolve => setTimeout(resolve, 50));
    
    rerender({ value: 'update3', delay: 100 });
    expect(result.current).toBe('initial');

    await waitFor(
      () => {
        expect(result.current).toBe('update3');
      },
      { timeout: 200 }
    );
  });

  it('should work with numbers', async () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: 0, delay: 100 } }
    );

    expect(result.current).toBe(0);

    rerender({ value: 42, delay: 100 });

    await waitFor(
      () => {
        expect(result.current).toBe(42);
      },
      { timeout: 200 }
    );
  });

  it('should work with objects', async () => {
    const initialObj = { name: 'John', age: 30 };
    const updatedObj = { name: 'Jane', age: 25 };

    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: initialObj, delay: 100 } }
    );

    expect(result.current).toBe(initialObj);

    rerender({ value: updatedObj, delay: 100 });

    await waitFor(
      () => {
        expect(result.current).toBe(updatedObj);
      },
      { timeout: 200 }
    );
  });

  it('should work with arrays', async () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: [1, 2, 3], delay: 100 } }
    );

    expect(result.current).toEqual([1, 2, 3]);

    rerender({ value: [4, 5, 6], delay: 100 });

    await waitFor(
      () => {
        expect(result.current).toEqual([4, 5, 6]);
      },
      { timeout: 200 }
    );
  });
});
