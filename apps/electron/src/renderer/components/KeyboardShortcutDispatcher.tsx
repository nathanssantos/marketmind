import { useEffect } from 'react';
import {
  CHART_CANVAS_DATA_ATTR,
  isTypingTarget,
  matchesShortcut,
  useKeyboardShortcutStore,
} from '@renderer/services/keyboardShortcuts';

export const KeyboardShortcutDispatcher = (): null => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      const typing = isTypingTarget(target);

      const { shortcuts, helpOpen, setHelpOpen } = useKeyboardShortcutStore.getState();

      if (event.key === 'Escape' && helpOpen) {
        event.preventDefault();
        setHelpOpen(false);
        return;
      }

      const allShortcuts = Object.values(shortcuts);

      for (const shortcut of allShortcuts) {
        if (!matchesShortcut(event, shortcut.keys)) continue;

        if (typing && !shortcut.allowInTypingTarget) continue;

        if (shortcut.scope === 'chart-focus') {
          const active = document.activeElement;
          if (!active || !(active instanceof HTMLElement)) continue;
          if (!active.hasAttribute(CHART_CANVAS_DATA_ATTR)) continue;
        }

        if (shortcut.when && !shortcut.when()) continue;

        if (shortcut.preventDefault !== false) event.preventDefault();
        shortcut.action(event);
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return null;
};
