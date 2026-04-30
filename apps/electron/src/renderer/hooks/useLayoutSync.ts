import type { ChartType, MarketType } from '@marketmind/types';
import type { Timeframe } from '@renderer/components/Chart/TimeframeSelector';
import { useLayoutStore } from '@renderer/store/layoutStore';
import { useSetupStore } from '@renderer/store/setupStore';
import { useChartPref } from '@renderer/store/preferencesStore';
import { DEFAULT_TIMEFRAME } from '@renderer/constants/defaults';
import { useCallback } from 'react';

export interface LayoutSyncResult {
  effectiveSymbol: string;
  effectiveMarketType: MarketType;
  effectiveTimeframe: Timeframe;
  effectiveChartType: ChartType;
  handleSymbolChange: (symbol: string, marketType?: MarketType) => void;
  handleTimeframeChange: (timeframe: Timeframe) => void;
  handleChartTypeChange: (chartType: ChartType) => void;
  handleMarketTypeChange: (marketType: MarketType) => void;
}

export const useLayoutSync = (): LayoutSyncResult => {
  const [symbol, setSymbol] = useChartPref('symbol', 'BTCUSDT');
  const [marketType, setMarketType] = useChartPref<MarketType>('marketType', 'FUTURES');
  const [chartType, setChartType] = useChartPref<ChartType>('chartType', 'kline');
  const [timeframe, setTimeframe] = useChartPref<Timeframe>('timeframe', DEFAULT_TIMEFRAME);

  const focusedPanel = useLayoutStore(s => s.getFocusedPanel());
  const activeLayout = useLayoutStore(s => s.getActiveLayout());
  const activeTab = useLayoutStore(s => s.getActiveTab());
  const setPanelTimeframe = useLayoutStore(s => s.setPanelTimeframe);
  const setPanelChartType = useLayoutStore(s => s.setPanelChartType);
  const updateTabSymbol = useLayoutStore(s => s.updateTabSymbol);
  const clearDetectedSetups = useSetupStore(s => s.clearDetectedSetups);

  const effectiveSymbol = activeTab?.symbol ?? symbol;
  const effectiveMarketType = activeTab?.marketType ?? marketType;
  const effectiveTimeframe = (focusedPanel?.timeframe ?? timeframe) as Timeframe;
  // Coerce legacy persisted chart types (tick/volume/footprint, removed in v1.3)
  // to 'kline'. Stored prefs from older builds may still contain those values.
  const rawChartType = focusedPanel?.chartType ?? chartType;
  const effectiveChartType: ChartType = rawChartType === 'line' ? 'line' : 'kline';

  const handleSymbolChange = useCallback((newSymbol: string, newMarketType?: MarketType): void => {
    clearDetectedSetups();
    if (activeTab) updateTabSymbol(activeTab.id, newSymbol, newMarketType ?? activeTab.marketType);
    setSymbol(newSymbol);
    if (newMarketType) setMarketType(newMarketType);
  }, [activeTab, updateTabSymbol, setSymbol, setMarketType, clearDetectedSetups]);

  const handleTimeframeChange = useCallback((tf: Timeframe) => {
    if (focusedPanel && activeLayout) setPanelTimeframe(activeLayout.id, focusedPanel.id, tf);
    else setTimeframe(tf);
  }, [focusedPanel, activeLayout, setPanelTimeframe, setTimeframe]);

  const handleChartTypeChange = useCallback((ct: ChartType) => {
    if (focusedPanel && activeLayout) setPanelChartType(activeLayout.id, focusedPanel.id, ct);
    else setChartType(ct);
  }, [focusedPanel, activeLayout, setPanelChartType, setChartType]);

  const handleMarketTypeChange = useCallback((mt: MarketType) => {
    setMarketType(mt);
    if (activeTab) updateTabSymbol(activeTab.id, activeTab.symbol, mt);
  }, [setMarketType, activeTab, updateTabSymbol]);

  return {
    effectiveSymbol,
    effectiveMarketType,
    effectiveTimeframe,
    effectiveChartType,
    handleSymbolChange,
    handleTimeframeChange,
    handleChartTypeChange,
    handleMarketTypeChange,
  };
};
