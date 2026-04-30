import { useEffect, useRef } from 'react';
import { perfMonitor } from '@renderer/utils/canvas/perfMonitor';

export const useDialogMount = (name: string, isOpen: boolean): void => {
  const openTsRef = useRef<number | null>(null);

  if (isOpen && openTsRef.current === null && perfMonitor.isEnabled()) {
    openTsRef.current = performance.now();
  }

  useEffect(() => {
    if (!isOpen) {
      openTsRef.current = null;
      return;
    }
    const start = openTsRef.current;
    if (start === null) return;
    perfMonitor.recordDialogMount(name, performance.now() - start);
    openTsRef.current = null;
  }, [name, isOpen]);
};
