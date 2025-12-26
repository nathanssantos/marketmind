import { createContext, useContext, type ReactNode } from 'react';
import type { MarketType } from '@marketmind/types';

interface GlobalActionsContextType {
  openSettings: () => void;
  focusChatInput: () => void;
  showKeyboardShortcuts: () => void;
  openSymbolSelector: () => void;
  navigateToSymbol: (symbol: string, marketType?: MarketType) => void;
}

const GlobalActionsContext = createContext<GlobalActionsContextType | null>(null);

export const useGlobalActions = (): GlobalActionsContextType => {
  const context = useContext(GlobalActionsContext);
  if (!context) {
    throw new Error('useGlobalActions must be used within GlobalActionsProvider');
  }
  return context;
};

export const useGlobalActionsOptional = (): GlobalActionsContextType | null => useContext(GlobalActionsContext);

interface GlobalActionsProviderProps {
  children: ReactNode;
  actions: GlobalActionsContextType;
}

export const GlobalActionsProvider = ({ children, actions }: GlobalActionsProviderProps) => (
  <GlobalActionsContext.Provider value={actions}>
    {children}
  </GlobalActionsContext.Provider>
);
