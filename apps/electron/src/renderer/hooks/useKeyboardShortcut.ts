import { useEffect, useRef } from 'react';
import {
  type ShortcutDefinition,
  useKeyboardShortcutStore,
} from '@renderer/services/keyboardShortcuts';

export const useKeyboardShortcut = (def: ShortcutDefinition | null): void => {
  const register = useKeyboardShortcutStore((s) => s.register);
  const actionRef = useRef(def?.action);
  const whenRef = useRef(def?.when);

  useEffect(() => {
    actionRef.current = def?.action;
    whenRef.current = def?.when;
  });

  useEffect(() => {
    if (!def) return;

    const wrapped: ShortcutDefinition = {
      ...def,
      action: (e) => actionRef.current?.(e),
      when: whenRef.current ? () => whenRef.current?.() ?? false : undefined,
    };

    return register(wrapped);
  }, [def?.id, def?.keys, def?.scope, register]); // eslint-disable-line react-hooks/exhaustive-deps
};
