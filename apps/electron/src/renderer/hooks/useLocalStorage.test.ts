import { describe, expect, it, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLocalStorage } from './useLocalStorage';

describe('useLocalStorage', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('should return initial value when localStorage is empty', () => {
    const { result } = renderHook(() => useLocalStorage('test-key', 'initial'));

    expect(result.current[0]).toBe('initial');
  });

  it('should return stored value from localStorage', () => {
    localStorage.setItem('test-key', JSON.stringify('stored-value'));

    const { result } = renderHook(() => useLocalStorage('test-key', 'initial'));

    expect(result.current[0]).toBe('stored-value');
  });

  it('should update localStorage when value changes', () => {
    const { result } = renderHook(() => useLocalStorage('test-key', 'initial'));

    act(() => {
      result.current[1]('updated');
    });

    expect(result.current[0]).toBe('updated');
    expect(localStorage.getItem('test-key')).toBe(JSON.stringify('updated'));
  });

  it('should work with numbers', () => {
    const { result } = renderHook(() => useLocalStorage('number-key', 0));

    act(() => {
      result.current[1](42);
    });

    expect(result.current[0]).toBe(42);
    expect(localStorage.getItem('number-key')).toBe('42');
  });

  it('should work with objects', () => {
    const initialObj = { name: 'John', age: 30 };
    const { result } = renderHook(() => useLocalStorage('object-key', initialObj));

    const updatedObj = { name: 'Jane', age: 25 };

    act(() => {
      result.current[1](updatedObj);
    });

    expect(result.current[0]).toEqual(updatedObj);
    expect(JSON.parse(localStorage.getItem('object-key')!)).toEqual(updatedObj);
  });

  it('should work with arrays', () => {
    const { result } = renderHook(() => useLocalStorage('array-key', [1, 2, 3]));

    act(() => {
      result.current[1]([4, 5, 6]);
    });

    expect(result.current[0]).toEqual([4, 5, 6]);
    expect(JSON.parse(localStorage.getItem('array-key')!)).toEqual([4, 5, 6]);
  });

  it('should work with booleans', () => {
    const { result } = renderHook(() => useLocalStorage('bool-key', false));

    act(() => {
      result.current[1](true);
    });

    expect(result.current[0]).toBe(true);
    expect(localStorage.getItem('bool-key')).toBe('true');
  });

  it('should accept function updater like useState', () => {
    const { result } = renderHook(() => useLocalStorage('counter-key', 0));

    act(() => {
      result.current[1](prev => prev + 1);
    });

    expect(result.current[0]).toBe(1);

    act(() => {
      result.current[1](prev => prev + 10);
    });

    expect(result.current[0]).toBe(11);
  });

  it('should handle corrupted localStorage data gracefully', () => {
    localStorage.setItem('corrupted-key', 'not-valid-json{');

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    const { result } = renderHook(() => useLocalStorage('corrupted-key', 'fallback'));

    expect(result.current[0]).toBe('fallback');
    expect(consoleSpy).toHaveBeenCalled();
    
    consoleSpy.mockRestore();
  });

  it('should handle localStorage.setItem errors', () => {
    const { result } = renderHook(() => useLocalStorage('test-key', 'initial'));

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });

    act(() => {
      result.current[1]('new-value');
    });

    expect(consoleSpy).toHaveBeenCalled();
    
    consoleSpy.mockRestore();
    setItemSpy.mockRestore();
  });

  it('should persist complex nested objects', () => {
    const complexObj = {
      user: {
        name: 'John',
        settings: {
          theme: 'dark',
          notifications: true,
        },
      },
      items: [1, 2, 3],
    };

    const { result } = renderHook(() => useLocalStorage('complex-key', complexObj));

    const updatedObj = {
      ...complexObj,
      user: {
        ...complexObj.user,
        settings: {
          ...complexObj.user.settings,
          theme: 'light',
        },
      },
    };

    act(() => {
      result.current[1](updatedObj);
    });

    expect(result.current[0]).toEqual(updatedObj);
    expect(JSON.parse(localStorage.getItem('complex-key')!)).toEqual(updatedObj);
  });

  it('should handle null values', () => {
    const { result } = renderHook(() => useLocalStorage<string | null>('null-key', null));

    expect(result.current[0]).toBeNull();

    act(() => {
      result.current[1]('value');
    });

    expect(result.current[0]).toBe('value');

    act(() => {
      result.current[1](null);
    });

    expect(result.current[0]).toBeNull();
    expect(localStorage.getItem('null-key')).toBe('null');
  });

  it('should allow multiple hooks with different keys', () => {
    const { result: result1 } = renderHook(() => useLocalStorage('key1', 'value1'));
    const { result: result2 } = renderHook(() => useLocalStorage('key2', 'value2'));

    expect(result1.current[0]).toBe('value1');
    expect(result2.current[0]).toBe('value2');

    act(() => {
      result1.current[1]('updated1');
    });

    act(() => {
      result2.current[1]('updated2');
    });

    expect(result1.current[0]).toBe('updated1');
    expect(result2.current[0]).toBe('updated2');
    expect(localStorage.getItem('key1')).toBe(JSON.stringify('updated1'));
    expect(localStorage.getItem('key2')).toBe(JSON.stringify('updated2'));
  });
});
