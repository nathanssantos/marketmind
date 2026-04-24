import { Box, Flex } from '@chakra-ui/react';
import { ChartCanvas } from '@renderer/components/Chart/ChartCanvas';
import { ErrorMessage, LoadingSpinner } from '@renderer/components/ui';
import { useKlinePagination } from '@renderer/hooks/useKlinePagination';
import { useKlineLiveStream } from '@renderer/hooks/useKlineLiveStream';
import type { MarketType, Interval } from '@marketmind/types';
import type { GridPanelConfig } from '@shared/types/layout';
import { memo, useMemo } from 'react';

interface ChartPanelContentProps {
  symbol: string;
  marketType: MarketType;
  panelConfig: GridPanelConfig;
}

function ChartPanelContentComponent({ symbol, marketType, panelConfig }: ChartPanelContentProps) {
  const {
    allKlines: paginatedKlines,
    isLoadingMore,
    hasMore,
    loadOlderKlines,
    isInitialLoading,
    error,
    refetch,
  } = useKlinePagination({
    symbol,
    interval: panelConfig.timeframe as Interval,
    marketType,
    enabled: !!symbol,
  });

  const marketData = useMemo(() => {
    if (paginatedKlines.length === 0) return null;
    return { symbol, interval: panelConfig.timeframe, klines: paginatedKlines };
  }, [paginatedKlines, symbol, panelConfig.timeframe]);

  const { displayKlines } = useKlineLiveStream({
    symbol,
    timeframe: panelConfig.timeframe,
    marketType,
    baseKlines: marketData?.klines,
    enabled: !!marketData,
    refetchKlines: refetch,
  });

  if (isInitialLoading) return <LoadingSpinner />;

  if (error) {return (
    <Flex align="center" justify="center" h="100%">
      <ErrorMessage title="Failed to load data" message={error.message} onRetry={() => window.location.reload()} />
    </Flex>
  );}

  if (!marketData) return <Box h="100%" />;

  return (
    <ChartCanvas
      klines={displayKlines}
      symbol={symbol}
      marketType={marketType}
      width="100%"
      height="100%"
      chartType={panelConfig.chartType}
      timeframe={panelConfig.timeframe}
      onNearLeftEdge={hasMore ? () => { void loadOlderKlines(); } : undefined}
      isLoadingMore={isLoadingMore}
    />
  );
}

export const ChartPanelContent = memo(ChartPanelContentComponent);
