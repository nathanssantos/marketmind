import { ChartPanelHeader } from '@renderer/components/Chart/ChartCanvas/ChartPanelHeader';
import { GridWindow } from '@renderer/components/ui';
import { useLayoutStore } from '@renderer/store/layoutStore';
import type { ChartPanelConfig } from '@shared/types/layout';
import type { MarketType } from '@marketmind/types';
import { memo, useCallback, useMemo } from 'react';
import { ChartPanelContent } from './ChartPanelContent';

interface ChartGridPanelProps {
  panelConfig: ChartPanelConfig;
  symbol: string;
  marketType: MarketType;
  layoutId: string;
  isSinglePanel?: boolean;
}

function ChartGridPanelComponent({ panelConfig, symbol, marketType, layoutId, isSinglePanel }: ChartGridPanelProps) {
  const isFocused = useLayoutStore(s => s.focusedPanelId === panelConfig.id);
  const setFocusedPanel = useLayoutStore(s => s.setFocusedPanel);
  const setPanelWindowState = useLayoutStore(s => s.setPanelWindowState);
  const removePanel = useLayoutStore(s => s.removePanel);
  const gridEditMode = useLayoutStore(s => s.gridEditMode);

  const handleFocus = useCallback((id: string) => setFocusedPanel(id), [setFocusedPanel]);
  const handleMinimize = useCallback((id: string) => setPanelWindowState(layoutId, id, 'minimized'), [setPanelWindowState, layoutId]);
  const handleMaximize = useCallback((id: string) => setPanelWindowState(layoutId, id, 'maximized'), [setPanelWindowState, layoutId]);
  const handleRestore = useCallback((id: string) => setPanelWindowState(layoutId, id, 'normal'), [setPanelWindowState, layoutId]);
  const handleClose = useCallback((id: string) => removePanel(layoutId, id), [removePanel, layoutId]);

  // Header is its own memo'd component that subscribes to the per-tick
  // hover store + stream health internally. Keeping that wiring here
  // would re-render the whole ChartGridPanel (and feed a new `header`
  // ReactElement into GridWindow) on every kline tick, defeating the
  // `<ChartPanelContent>` memo's whole point. Stable props here →
  // GridWindow's memo skips reconciliation when only the header
  // updates.
  const header = useMemo(
    () => (
      <ChartPanelHeader
        symbol={symbol}
        timeframe={panelConfig.timeframe}
        chartType={panelConfig.chartType}
        marketType={marketType}
      />
    ),
    [symbol, panelConfig.timeframe, panelConfig.chartType, marketType],
  );

  return (
    <GridWindow
      id={panelConfig.id}
      windowState={panelConfig.windowState}
      isFocused={isFocused}
      showFocusBorder={!isSinglePanel}
      header={header}
      onFocus={handleFocus}
      onMinimize={handleMinimize}
      onMaximize={handleMaximize}
      onRestore={handleRestore}
      onClose={handleClose}
      showClose={gridEditMode}
    >
      <ChartPanelContent
        symbol={symbol}
        marketType={marketType}
        panelConfig={panelConfig}
      />
    </GridWindow>
  );
}

export const ChartGridPanel = memo(ChartGridPanelComponent);
