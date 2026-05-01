import { useEffect } from 'react';
import { useBacktestDialogStore } from '../store/backtestDialogStore';

export const useBacktestShortcut = () => {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.shiftKey && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        useBacktestDialogStore.getState().toggleBacktest();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
};
