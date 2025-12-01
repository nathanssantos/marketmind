import { useEffect } from 'react';

type KeyHandler = (event: KeyboardEvent) => void;

interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  alt?: boolean;
  handler: KeyHandler;
  description?: string;
}

const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;

export const useKeyboardShortcut = (shortcuts: KeyboardShortcut[]) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      for (const shortcut of shortcuts) {
        const ctrlKey = shortcut.ctrl && event.ctrlKey;
        const metaKey = shortcut.meta && event.metaKey;
        const shiftKey = shortcut.shift ? event.shiftKey : !event.shiftKey;
        const altKey = shortcut.alt ? event.altKey : !event.altKey;

        const keyMatches = event.key.toLowerCase() === shortcut.key.toLowerCase();
        
        const modifierMatches = 
          (!shortcut.ctrl && !shortcut.meta) || 
          (isMac ? (shortcut.meta && metaKey) : (shortcut.ctrl && ctrlKey));

        if (keyMatches && modifierMatches && shiftKey && altKey) {
          event.preventDefault();
          shortcut.handler(event);
          break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts]);
};

export const getModifierKey = (): string => isMac ? 'Cmd' : 'Ctrl';

export const formatShortcut = (shortcut: KeyboardShortcut): string => {
  const parts: string[] = [];
  
  if (shortcut.ctrl || shortcut.meta) {
    parts.push(getModifierKey());
  }
  
  if (shortcut.shift) {
    parts.push('Shift');
  }
  
  if (shortcut.alt) {
    parts.push('Alt');
  }
  
  parts.push(shortcut.key.toUpperCase());
  
  return parts.join(' + ');
};
