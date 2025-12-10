import type { AIPattern, CalendarEvent, Kline, NewsArticle } from '@marketmind/types';
import React, { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { Timeframe } from '../components/Chart/TimeframeSelector';
import type { MovingAverageConfig } from '../components/Chart/useMovingAverageRenderer';

export interface ChartContextData {
  klines: Kline[];
  symbol: string;
  timeframe: Timeframe;
  chartType: 'kline' | 'line';
  showVolume: boolean;
  movingAverages: MovingAverageConfig[];
  news?: NewsArticle[] | undefined;
  events?: CalendarEvent[] | undefined;
  detectedPatterns?: AIPattern[];
}

interface ChartContextType {
  chartData: ChartContextData | null;
  setChartData: (data: ChartContextData) => void;
  detectedPatterns: AIPattern[];
  setDetectedPatterns: (patterns: AIPattern[]) => void;
}

const ChartContext = createContext<ChartContextType | undefined>(undefined);

export const ChartProvider = ({ children }: { children: ReactNode }) => {
  const [chartData, setChartData] = React.useState<ChartContextData | null>(null);
  const [detectedPatterns, setDetectedPatterns] = React.useState<AIPattern[]>([]);

  const value = useMemo(
    () => ({ chartData, setChartData, detectedPatterns, setDetectedPatterns }),
    [chartData, detectedPatterns]
  );

  return (
    <ChartContext.Provider value={value}>
      {children}
    </ChartContext.Provider>
  );
};

export const useChartContext = () => {
  const context = useContext(ChartContext);
  if (!context) {
    throw new Error('useChartContext must be used within ChartProvider');
  }
  return context;
};
