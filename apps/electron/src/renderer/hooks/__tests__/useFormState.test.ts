import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useFormState } from '../useFormState';

interface Form {
  name: string;
  count: number;
  enabled: boolean;
}

const initial: Form = { name: '', count: 0, enabled: false };

describe('useFormState', () => {
  it('starts with the initial values and isDirty=false', () => {
    const { result } = renderHook(() => useFormState({ initial }));
    expect(result.current.values).toEqual(initial);
    expect(result.current.isDirty).toBe(false);
  });

  it('set() updates a single field and flips isDirty', () => {
    const { result } = renderHook(() => useFormState({ initial }));
    act(() => result.current.set('name', 'hello'));
    expect(result.current.values).toEqual({ ...initial, name: 'hello' });
    expect(result.current.isDirty).toBe(true);
  });

  it('patch() merges multiple fields at once', () => {
    const { result } = renderHook(() => useFormState({ initial }));
    act(() => result.current.patch({ name: 'x', count: 7 }));
    expect(result.current.values).toEqual({ name: 'x', count: 7, enabled: false });
    expect(result.current.isDirty).toBe(true);
  });

  it('replace() swaps the whole values object', () => {
    const { result } = renderHook(() => useFormState({ initial }));
    act(() => result.current.replace({ name: 'a', count: 1, enabled: true }));
    expect(result.current.values).toEqual({ name: 'a', count: 1, enabled: true });
  });

  it('reset() returns to initial and clears isDirty', () => {
    const { result } = renderHook(() => useFormState({ initial }));
    act(() => result.current.set('name', 'x'));
    expect(result.current.isDirty).toBe(true);
    act(() => result.current.reset());
    expect(result.current.values).toEqual(initial);
    expect(result.current.isDirty).toBe(false);
  });

  it('auto-resets when resetOn transitions falsy → truthy', () => {
    let resetOn = false;
    const { result, rerender } = renderHook(() => useFormState({ initial, resetOn }));
    act(() => result.current.set('name', 'dirty'));
    expect(result.current.values.name).toBe('dirty');

    // Transition false → true: should auto-reset
    resetOn = true;
    rerender();
    expect(result.current.values).toEqual(initial);
    expect(result.current.isDirty).toBe(false);
  });

  it('does not auto-reset on truthy → falsy', () => {
    let resetOn = true;
    const { result, rerender } = renderHook(() => useFormState({ initial, resetOn }));
    act(() => result.current.set('name', 'still-here'));
    resetOn = false;
    rerender();
    expect(result.current.values.name).toBe('still-here');
  });

  it('does not auto-reset on initial render when resetOn starts true', () => {
    const { result } = renderHook(() => useFormState({ initial, resetOn: true }));
    act(() => result.current.set('name', 'manual'));
    expect(result.current.values.name).toBe('manual');
  });
});
