import { HStack, Text } from '@chakra-ui/react';
import { KlineOHLCRow } from '@renderer/components/Chart/ChartCanvas/KlineOHLCRow';
import { StreamHealthDot } from '@renderer/components/Chart/ChartCanvas/StreamHealthDot';
import { makeChartKey, useChartHoverStore } from '@renderer/store/chartHoverStore';
import { useStreamHealth } from '@renderer/hooks/useStreamHealth';
import type { ChartType, MarketType } from '@marketmind/types';
import { memo } from 'react';

interface ChartPanelHeaderProps {
  symbol: string;
  // Matches `useStreamHealth`'s contract — keep string here so we don't
  // double-narrow upstream `panelConfig.timeframe` (also typed as
  // string).
  timeframe: string;
  chartType: ChartType;
  marketType: MarketType;
}

// Extracted from ChartGridPanel to isolate the per-tick re-renders that
// `useChartHoverStore` triggers (live klines and mouse-hover updates the
// store on every kline message; previously the whole panel — including
// `<ChartPanelContent>` — entered React's reconciliation phase on each
// tick. `ChartPanelContent` is memo-wrapped so the canvas itself
// wouldn't re-paint, but the per-tick reconciliation still showed up
// in the React profiler and burned ~kHz of layout work for the OHLC
// row's Chakra HStack tree).
function ChartPanelHeaderComponent({ symbol, timeframe, chartType, marketType }: ChartPanelHeaderProps) {
  const hoverKey = makeChartKey(symbol, timeframe);
  const hoveredKline = useChartHoverStore((s) => s.hoveredKlineByChart[hoverKey] ?? null);
  const currentKline = useChartHoverStore((s) => s.currentKlineByChart[hoverKey] ?? null);
  const headerKline = hoveredKline ?? currentKline;

  const streamHealth = useStreamHealth({
    symbol,
    interval: timeframe,
    marketType,
    enabled: !!symbol,
  });

  return (
    <HStack gap={2} align="center" overflow="hidden" minW={0} flexWrap="nowrap" whiteSpace="nowrap">
      <StreamHealthDot status={streamHealth.status} />
      <Text fontSize="xs" color="fg.muted" flexShrink={0}>{timeframe} {chartType}</Text>
      {headerKline && <KlineOHLCRow kline={headerKline} compact />}
    </HStack>
  );
}

export const ChartPanelHeader = memo(ChartPanelHeaderComponent);
