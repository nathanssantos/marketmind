import type { MutableRefObject } from 'react';
import { useEffect, useRef } from 'react';
import { usePreferencesStore } from '@renderer/store/preferencesStore';

export type PrefCategory = 'chart' | 'ui' | 'trading' | 'layout';

export interface PrefDescriptor<T = unknown> {
  category: PrefCategory;
  defaultValue: T;
}

export type PrefDescriptors<T extends Record<string, unknown>> = {
  [K in keyof T]: PrefDescriptor<T[K]>;
};

const readSnapshot = <T extends Record<string, unknown>>(
  descriptors: PrefDescriptors<T>,
): T => {
  const state = usePreferencesStore.getState();
  const out = {} as Record<string, unknown>;
  for (const key in descriptors) {
    const descriptor = descriptors[key];
    const stored = state[descriptor.category][key];
    out[key] = stored !== undefined ? stored : descriptor.defaultValue;
  }
  return out as T;
};

export const usePrefSnapshot = <T extends Record<string, unknown>>(
  descriptors: PrefDescriptors<T>,
  onChange?: () => void,
): MutableRefObject<T> => {
  const descriptorsRef = useRef(descriptors);
  descriptorsRef.current = descriptors;

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const ref = useRef<T>(readSnapshot(descriptors));

  useEffect(() => {
    const unsubscribe = usePreferencesStore.subscribe((state) => {
      const descs = descriptorsRef.current;
      const current = ref.current;
      let changed = false;
      let next: Record<string, unknown> | null = null;

      for (const key in descs) {
        const descriptor = descs[key];
        const stored = state[descriptor.category][key];
        const value = stored !== undefined ? stored : descriptor.defaultValue;
        if (!Object.is((current as Record<string, unknown>)[key], value)) {
          next ??= { ...(current as Record<string, unknown>) };
          next[key] = value;
          changed = true;
        }
      }

      if (changed && next) {
        ref.current = next as T;
        onChangeRef.current?.();
      }
    });
    return unsubscribe;
  }, []);

  return ref;
};
