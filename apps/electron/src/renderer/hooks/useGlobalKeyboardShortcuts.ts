import { useKeyboardShortcutStore } from '@renderer/services/keyboardShortcuts';
import { useKeyboardShortcut } from './useKeyboardShortcut';

export const useGlobalKeyboardShortcuts = (): void => {
  useKeyboardShortcut({
    id: 'global.help',
    keys: '?',
    scope: 'global',
    group: 'global',
    descriptionKey: 'shortcuts.global.help',
    description: 'Open keyboard shortcuts help',
    action: () => {
      const { helpOpen, setHelpOpen } = useKeyboardShortcutStore.getState();
      setHelpOpen(!helpOpen);
    },
  });
};
