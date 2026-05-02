import { HStack, Text } from '@chakra-ui/react';
import { KlineOHLCRow } from '@renderer/components/Chart/ChartCanvas/KlineOHLCRow';
import { StreamHealthDot } from '@renderer/components/Chart/ChartCanvas/StreamHealthDot';
import { GridWindow } from '@renderer/components/ui';
import { useLayoutStore } from '@renderer/store/layoutStore';
import { makeChartKey, useChartHoverStore } from '@renderer/store/chartHoverStore';
import { useStreamHealth } from '@renderer/hooks/useStreamHealth';
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

  const handleFocus = useCallback((id: string) => setFocusedPanel(id), [setFocusedPanel]);
  const handleMinimize = useCallback((id: string) => setPanelWindowState(layoutId, id, 'minimized'), [setPanelWindowState, layoutId]);
  const handleMaximize = useCallback((id: string) => setPanelWindowState(layoutId, id, 'maximized'), [setPanelWindowState, layoutId]);
  const handleRestore = useCallback((id: string) => setPanelWindowState(layoutId, id, 'normal'), [setPanelWindowState, layoutId]);
  const handleClose = useCallback((id: string) => removePanel(layoutId, id), [removePanel, layoutId]);

  const hoveredKline = useChartHoverStore((s) => s.hoveredKlineByChart[makeChartKey(symbol, panelConfig.timeframe)]);

  const streamHealth = useStreamHealth({
    symbol,
    interval: panelConfig.timeframe,
    marketType,
    enabled: !!symbol,
  });

  const header = useMemo(
    () => (
      <HStack gap={2} align="center" overflow="hidden" minW={0} flexWrap="nowrap" whiteSpace="nowrap">
        <StreamHealthDot status={streamHealth.status} />
        <Text fontSize="xs" color="fg.muted" flexShrink={0}>{panelConfig.timeframe} {panelConfig.chartType}</Text>
        {hoveredKline && <KlineOHLCRow kline={hoveredKline} compact />}
      </HStack>
    ),
    [streamHealth.status, panelConfig.timeframe, panelConfig.chartType, hoveredKline],
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
