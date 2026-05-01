import { describe, expect, it, beforeEach } from 'vitest';
import {
  formatShortcutKeys,
  isTypingTarget,
  matchesShortcut,
  useKeyboardShortcutStore,
} from './keyboardShortcuts';

describe('keyboard shortcut registry', () => {
  beforeEach(() => {
    useKeyboardShortcutStore.setState({ shortcuts: {}, helpOpen: false });
  });

  it('register adds a shortcut and returns an unregister fn', () => {
    const { register } = useKeyboardShortcutStore.getState();
    const unregister = register({
      id: 'test.foo',
      keys: 'Mod+K',
      scope: 'global',
      group: 'global',
      description: 'Foo',
      action: () => {},
    });
    expect(useKeyboardShortcutStore.getState().shortcuts['test.foo']).toBeDefined();
    unregister();
    expect(useKeyboardShortcutStore.getState().shortcuts['test.foo']).toBeUndefined();
  });

  it('re-registering the same id with the same keys is a no-op overwrite', () => {
    const { register } = useKeyboardShortcutStore.getState();
    const a = () => {};
    const b = () => {};
    register({ id: 'x', keys: '?', scope: 'global', group: 'global', description: 'x', action: a });
    register({ id: 'x', keys: '?', scope: 'global', group: 'global', description: 'x', action: b });
    expect(useKeyboardShortcutStore.getState().shortcuts['x']?.action).toBe(b);
  });
});

describe('matchesShortcut', () => {
  const evt = (overrides: Partial<KeyboardEventInit>) => new KeyboardEvent('keydown', overrides);

  it('matches plain keys', () => {
    expect(matchesShortcut(evt({ key: 'ArrowLeft' }), 'ArrowLeft')).toBe(true);
    expect(matchesShortcut(evt({ key: 'ArrowRight' }), 'ArrowLeft')).toBe(false);
  });

  it('matches single-letter keys case-insensitively', () => {
    expect(matchesShortcut(evt({ key: 'a' }), 'A')).toBe(true);
    expect(matchesShortcut(evt({ key: 'A', shiftKey: false }), 'A')).toBe(true);
  });

  it('Mod is metaKey on darwin and ctrlKey elsewhere', () => {
    const isMac = /Mac|iPad|iPhone/.test(navigator.platform);
    const correct = isMac
      ? evt({ key: 'k', metaKey: true })
      : evt({ key: 'k', ctrlKey: true });
    const wrong = isMac
      ? evt({ key: 'k', ctrlKey: true })
      : evt({ key: 'k', metaKey: true });
    expect(matchesShortcut(correct, 'Mod+K')).toBe(true);
    expect(matchesShortcut(wrong, 'Mod+K')).toBe(false);
  });

  it('rejects when modifiers do not match', () => {
    expect(matchesShortcut(evt({ key: 'ArrowLeft', shiftKey: true }), 'ArrowLeft')).toBe(false);
    expect(matchesShortcut(evt({ key: 'ArrowLeft' }), 'Shift+ArrowLeft')).toBe(false);
  });

  it('? matches both literal and shift+slash', () => {
    expect(matchesShortcut(evt({ key: '?' }), '?')).toBe(true);
    expect(matchesShortcut(evt({ key: '/', shiftKey: true }), '?')).toBe(true);
  });
});

describe('isTypingTarget', () => {
  it('returns true for INPUT, TEXTAREA, SELECT, contenteditable', () => {
    const i = document.createElement('input');
    const ta = document.createElement('textarea');
    const sel = document.createElement('select');
    const ce = document.createElement('div');
    ce.contentEditable = 'true';
    expect(isTypingTarget(i)).toBe(true);
    expect(isTypingTarget(ta)).toBe(true);
    expect(isTypingTarget(sel)).toBe(true);
    expect(isTypingTarget(ce)).toBe(true);
  });

  it('returns false for non-typing elements + null', () => {
    expect(isTypingTarget(document.createElement('div'))).toBe(false);
    expect(isTypingTarget(document.createElement('button'))).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});

describe('formatShortcutKeys', () => {
  it('formats arrow keys + modifiers', () => {
    const formatted = formatShortcutKeys('Mod+ArrowLeft');
    expect(formatted).toMatch(/(⌘|Ctrl)\s\+\s←/);
  });

  it('formats ? as ?', () => {
    expect(formatShortcutKeys('?')).toBe('?');
  });

  it('uppercases single-letter keys', () => {
    expect(formatShortcutKeys('Mod+k')).toMatch(/K$/);
  });
});
