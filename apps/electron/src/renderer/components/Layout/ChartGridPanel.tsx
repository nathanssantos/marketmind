import { HStack } from '@chakra-ui/react';
import { Badge, GridWindow } from '@renderer/components/ui';
import { useLayoutStore } from '@renderer/store/layoutStore';
import type { GridPanelConfig } from '@shared/types/layout';
import type { MarketType } from '@marketmind/types';
import { memo, useCallback } from 'react';
import { ChartPanelContent } from './ChartPanelContent';

interface ChartGridPanelProps {
  panelConfig: GridPanelConfig;
  symbol: string;
  marketType: MarketType;
  layoutId: string;
}

function ChartGridPanelComponent({ panelConfig, symbol, marketType, layoutId }: ChartGridPanelProps) {
  const focusedPanelId = useLayoutStore(s => s.focusedPanelId);
  const setFocusedPanel = useLayoutStore(s => s.setFocusedPanel);
  const setPanelWindowState = useLayoutStore(s => s.setPanelWindowState);
  const removePanel = useLayoutStore(s => s.removePanel);

  const handleFocus = useCallback((id: string) => setFocusedPanel(id), [setFocusedPanel]);
  const handleMinimize = useCallback((id: string) => setPanelWindowState(layoutId, id, 'minimized'), [setPanelWindowState, layoutId]);
  const handleMaximize = useCallback((id: string) => setPanelWindowState(layoutId, id, 'maximized'), [setPanelWindowState, layoutId]);
  const handleRestore = useCallback((id: string) => setPanelWindowState(layoutId, id, 'normal'), [setPanelWindowState, layoutId]);
  const handleClose = useCallback((id: string) => removePanel(layoutId, id), [removePanel, layoutId]);

  const header = (
    <HStack gap={1}>
      <Badge size="sm" variant="subtle">{panelConfig.timeframe}</Badge>
      <Badge size="sm" variant="outline">{panelConfig.chartType}</Badge>
    </HStack>
  );

  return (
    <GridWindow
      id={panelConfig.id}
      windowState={panelConfig.windowState}
      isFocused={focusedPanelId === panelConfig.id}
      header={header}
      onFocus={handleFocus}
      onMinimize={handleMinimize}
      onMaximize={handleMaximize}
      onRestore={handleRestore}
      onClose={handleClose}
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
