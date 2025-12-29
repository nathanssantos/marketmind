import type { PlatformAdapter } from './types';
import { createElectronAdapter } from './electron';

let cachedAdapter: PlatformAdapter | null = null;

const isElectronEnvironment = (): boolean => {
  return typeof window !== 'undefined' &&
         typeof window.electron !== 'undefined' &&
         window.electron !== null;
};

export const createPlatformAdapter = async (): Promise<PlatformAdapter> => {
  if (cachedAdapter) return cachedAdapter;

  if (isElectronEnvironment()) {
    cachedAdapter = createElectronAdapter();
  } else {
    const { createWebAdapter } = await import('./web');
    cachedAdapter = createWebAdapter();
  }

  return cachedAdapter;
};

export const getPlatformAdapter = (): PlatformAdapter | null => {
  return cachedAdapter;
};

export const resetPlatformAdapter = (): void => {
  cachedAdapter = null;
};
