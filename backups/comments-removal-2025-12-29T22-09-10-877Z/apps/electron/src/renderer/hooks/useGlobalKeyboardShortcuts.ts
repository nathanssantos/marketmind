import { useEffect } from 'react';

interface GlobalKeyboardShortcutsProps {
  onToggleVolume?: () => void;
  onToggleGrid?: () => void;
  onToggleChartType?: () => void;
  onToggleMA?: (index: number) => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onResetZoom?: () => void;
  onPanLeft?: () => void;
  onPanRight?: () => void;
  onOpenSettings?: () => void;
  onShowShortcuts?: () => void;
  onOpenSymbolSelector?: () => void;
}

const isMac = typeof navigator !== 'undefined' && navigator.platform.toUpperCase().indexOf('MAC') >= 0;

export const useGlobalKeyboardShortcuts = (props: GlobalKeyboardShortcutsProps) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const { key, ctrlKey, metaKey } = event;
      const modKey = isMac ? metaKey : ctrlKey;

      const target = event.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || 
                     target.tagName === 'TEXTAREA' || 
                     target.isContentEditable;

      if (key === 'Escape') {
        return;
      }

      if (modKey && key === ',') {
        event.preventDefault();
        props.onOpenSettings?.();
        return;
      }

      if (modKey && key === '/') {
        event.preventDefault();
        props.onShowShortcuts?.();
        return;
      }

      if (modKey && key === 'p') {
        event.preventDefault();
        props.onOpenSymbolSelector?.();
        return;
      }

      if (isInput) return;

      switch (key.toLowerCase()) {
        case 'm':
          event.preventDefault();
          props.onToggleVolume?.();
          break;
        case 'g':
          event.preventDefault();
          props.onToggleGrid?.();
          break;
        case 't':
          event.preventDefault();
          props.onToggleChartType?.();
          break;
        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
          event.preventDefault();
          props.onToggleMA?.(parseInt(key) - 1);
          break;
        case '+':
        case '=':
          event.preventDefault();
          props.onZoomIn?.();
          break;
        case '-':
          event.preventDefault();
          props.onZoomOut?.();
          break;
        case '0':
          event.preventDefault();
          props.onResetZoom?.();
          break;
        case 'arrowleft':
          event.preventDefault();
          props.onPanLeft?.();
          break;
        case 'arrowright':
          event.preventDefault();
          props.onPanRight?.();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [props]);
};
