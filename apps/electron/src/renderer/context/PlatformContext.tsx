import { createContext, useContext, type ReactNode } from 'react';
import type { PlatformAdapter } from '../adapters/types';

const PlatformContext = createContext<PlatformAdapter | null>(null);

interface PlatformProviderProps {
  adapter: PlatformAdapter;
  children: ReactNode;
}

export const PlatformProvider = ({ adapter, children }: PlatformProviderProps) => (
  <PlatformContext.Provider value={adapter}>
    {children}
  </PlatformContext.Provider>
);

export const usePlatform = (): PlatformAdapter => {
  const context = useContext(PlatformContext);
  if (!context) {
    throw new Error('usePlatform must be used within a PlatformProvider');
  }
  return context;
};

export const usePlatformOptional = (): PlatformAdapter | null => {
  return useContext(PlatformContext);
};
