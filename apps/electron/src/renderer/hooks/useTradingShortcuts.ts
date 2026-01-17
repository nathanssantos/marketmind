import { useUIStore } from '@/renderer/store/uiStore';
import { useEffect, useState } from 'react';

export interface TradingShortcutsConfig {
  onLongEntry: (price: number) => void;
  onShortEntry: (price: number) => void;
  enabled: boolean;
}

export const useTradingShortcuts = (config: TradingShortcutsConfig) => {
  const [shiftPressed, setShiftPressed] = useState(false);
  const [altPressed, setAltPressed] = useState(false);
  const enableShiftAltOrderEntry = useUIStore((state) => state.enableShiftAltOrderEntry);

  const featureEnabled = config.enabled && enableShiftAltOrderEntry;

  useEffect(() => {
    if (!featureEnabled) {
      setShiftPressed(false);
      setAltPressed(false);
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setShiftPressed(true);
      if (e.key === 'Alt' || e.key === 'Option') setAltPressed(true);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setShiftPressed(false);
      if (e.key === 'Alt' || e.key === 'Option') setAltPressed(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      setShiftPressed(false);
      setAltPressed(false);
    };
  }, [featureEnabled]);

  return {
    shiftPressed: featureEnabled && shiftPressed,
    altPressed: featureEnabled && altPressed,
  };
};
