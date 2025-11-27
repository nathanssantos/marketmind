import type { AIStudy, CalendarEvent, Candle, NewsArticle } from '@shared/types';
import React, { createContext, useContext, type ReactNode } from 'react';
import type { Timeframe } from '../components/Chart/TimeframeSelector';
import type { MovingAverageConfig } from '../components/Chart/useMovingAverageRenderer';

export interface ChartContextData {
  candles: Candle[];
  symbol: string;
  timeframe: Timeframe;
  chartType: 'candlestick' | 'line';
  showVolume: boolean;
  movingAverages: MovingAverageConfig[];
  news?: NewsArticle[] | undefined;
  events?: CalendarEvent[] | undefined;
  detectedStudies?: AIStudy[];
}

interface ChartContextType {
  chartData: ChartContextData | null;
  setChartData: (data: ChartContextData) => void;
  detectedStudies: AIStudy[];
  setDetectedStudies: (studies: AIStudy[]) => void;
}

const ChartContext = createContext<ChartContextType | undefined>(undefined);

export const ChartProvider = ({ children }: { children: ReactNode }) => {
  const [chartData, setChartData] = React.useState<ChartContextData | null>(null);
  const [detectedStudies, setDetectedStudies] = React.useState<AIStudy[]>([]);

  return (
    <ChartContext.Provider value={{ chartData, setChartData, detectedStudies, setDetectedStudies }}>
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
