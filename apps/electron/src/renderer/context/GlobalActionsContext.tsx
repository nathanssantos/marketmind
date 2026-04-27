import { createContext, useContext, type ReactNode } from 'react';
import type { ChartType, MarketType } from '@marketmind/types';
import type { Timeframe } from '../components/Chart/TimeframeSelector';
import type { SettingsTab } from '../components/Settings/constants';

interface GlobalActionsContextType {
  openSettings: (tab?: SettingsTab) => void;
  openSymbolSelector: () => void;
  navigateToSymbol: (symbol: string, marketType?: MarketType) => void;
  closeAll: () => void;
  setTimeframe: (tf: Timeframe) => void;
  setChartType: (type: ChartType) => void;
  setMarketType: (marketType: MarketType) => void;
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
