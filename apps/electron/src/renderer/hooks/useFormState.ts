import { useCallback, useEffect, useRef, useState } from 'react';

export interface UseFormStateOptions<T> {
  initial: T;
  /**
   * When provided, the form auto-resets to `initial` whenever this value
   * transitions falsy → truthy (typically the dialog's `isOpen`). Pass
   * `undefined` to disable auto-reset.
   */
  resetOn?: boolean;
}

export interface UseFormState<T> {
  values: T;
  /** Set a single field. */
  set: <K extends keyof T>(key: K, value: T[K]) => void;
  /** Patch multiple fields at once (object spread style). */
  patch: (patch: Partial<T>) => void;
  /** Replace the whole values object. */
  replace: (next: T) => void;
  /** Reset to the initial values passed at hook creation. */
  reset: () => void;
  /**
   * `true` when any field differs from the latest `initial` snapshot. The
   * snapshot updates on every `reset()` call, so dirtiness is "since last
   * reset", not "since the very first render".
   */
  isDirty: boolean;
}

/**
 * Lightweight form-state primitive shared by every dialog form.
 *
 * Replaces the per-field `useState` + `resetForm()` boilerplate that
 * every form modal used to roll by hand. Auto-resets when `resetOn`
 * transitions falsy → truthy (typically the dialog's `isOpen`) so the
 * caller doesn't have to wire reset effects manually.
 *
 * v1.6 Track E.3.
 */
export const useFormState = <T extends object>(options: UseFormStateOptions<T>): UseFormState<T> => {
  const { initial, resetOn } = options;

  // Snapshot of the initial values. Used both for `reset()` and for the
  // dirty check. Updated on every `reset()` so dirtiness tracks "since
  // last reset" rather than "since first render".
  const initialRef = useRef(initial);
  const [values, setValues] = useState<T>(initial);

  const set = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  const patch = useCallback((p: Partial<T>) => {
    setValues((prev) => ({ ...prev, ...p }));
  }, []);

  const replace = useCallback((next: T) => {
    setValues(next);
  }, []);

  const reset = useCallback(() => {
    initialRef.current = initial;
    setValues(initial);
  }, [initial]);

  // Auto-reset on resetOn transitioning falsy → truthy. The previous
  // value is kept in a ref so we don't fire on the initial render when
  // resetOn is already true.
  const prevResetOnRef = useRef(resetOn);
  useEffect(() => {
    if (resetOn === undefined) return;
    const prev = prevResetOnRef.current;
    prevResetOnRef.current = resetOn;
    if (!prev && resetOn) {
      initialRef.current = initial;
      setValues(initial);
    }
  }, [resetOn, initial]);

  const isDirty = !shallowEqual(values, initialRef.current);

  return { values, set, patch, replace, reset, isDirty };
};

const shallowEqual = <T extends object>(a: T, b: T): boolean => {
  const aKeys = Object.keys(a) as Array<keyof T>;
  const bKeys = Object.keys(b) as Array<keyof T>;
  if (aKeys.length !== bKeys.length) return false;
  for (const k of aKeys) if (a[k] !== b[k]) return false;
  return true;
};
