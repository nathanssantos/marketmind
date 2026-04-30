import { create } from 'zustand';

export type ShortcutScope =
  | 'global'
  | 'chart-focus'
  | 'when-condition';

export type ShortcutGroupId = 'chart' | 'drawing' | 'trading' | 'global';

export interface ShortcutDefinition {
  id: string;
  keys: string;
  scope: ShortcutScope;
  group: ShortcutGroupId;
  description: string;
  descriptionKey?: string;
  action: (event: KeyboardEvent) => void;
  when?: () => boolean;
  preventDefault?: boolean;
  hidden?: boolean;
}

interface KeyboardShortcutState {
  shortcuts: Record<string, ShortcutDefinition>;
  helpOpen: boolean;
  register: (def: ShortcutDefinition) => () => void;
  unregister: (id: string) => void;
  setHelpOpen: (open: boolean) => void;
}

export const useKeyboardShortcutStore = create<KeyboardShortcutState>((set, get) => ({
  shortcuts: {},
  helpOpen: false,
  register: (def) => {
    const existing = get().shortcuts[def.id];
    if (existing && existing.keys !== def.keys) {
      console.warn(`[shortcuts] id "${def.id}" re-registered with different keys (${existing.keys} → ${def.keys})`);
    }
    set((s) => ({ shortcuts: { ...s.shortcuts, [def.id]: def } }));
    return () => get().unregister(def.id);
  },
  unregister: (id) => set((s) => {
    const next = { ...s.shortcuts };
    delete next[id];
    return { shortcuts: next };
  }),
  setHelpOpen: (open) => set({ helpOpen: open }),
}));

const isMac = typeof navigator !== 'undefined' && /Mac|iPad|iPhone/.test(navigator.platform);

export const formatShortcutKeys = (keys: string): string => {
  return keys
    .split('+')
    .map((part) => {
      if (part === 'Mod') return isMac ? '⌘' : 'Ctrl';
      if (part === 'Shift') return '⇧';
      if (part === 'Alt') return isMac ? '⌥' : 'Alt';
      if (part === 'Ctrl') return 'Ctrl';
      if (part === 'ArrowLeft') return '←';
      if (part === 'ArrowRight') return '→';
      if (part === 'ArrowUp') return '↑';
      if (part === 'ArrowDown') return '↓';
      if (part === 'Escape') return 'Esc';
      if (part === 'Backspace') return '⌫';
      if (part === 'Delete') return 'Del';
      if (part === ' ') return 'Space';
      if (part.length === 1) return part.toUpperCase();
      return part;
    })
    .join(' + ');
};

export const matchesShortcut = (event: KeyboardEvent, keys: string): boolean => {
  const parts = keys.split('+');
  const key = parts[parts.length - 1];
  if (key === undefined) return false;

  const needsMod = parts.includes('Mod');
  const needsShift = parts.includes('Shift');
  const needsAlt = parts.includes('Alt');
  const needsCtrl = parts.includes('Ctrl');

  const modPressed = isMac ? event.metaKey : event.ctrlKey;

  if (needsMod !== modPressed) return false;
  if (needsAlt !== event.altKey) return false;
  if (needsCtrl && !event.ctrlKey) return false;

  if (key === '?') {
    return event.key === '?' || event.key === '/';
  }

  if (needsShift !== event.shiftKey) return false;

  if (key.length === 1) return event.key.toLowerCase() === key.toLowerCase();
  return event.key === key;
};

export const isTypingTarget = (target: EventTarget | null): boolean => {
  if (!target) return false;
  const el = target as { tagName?: string; isContentEditable?: boolean; contentEditable?: string };
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (el.isContentEditable === true) return true;
  if (el.contentEditable === 'true' || el.contentEditable === 'plaintext-only') return true;
  return false;
};

export const CHART_CANVAS_DATA_ATTR = 'data-chart-keyboard-target';
