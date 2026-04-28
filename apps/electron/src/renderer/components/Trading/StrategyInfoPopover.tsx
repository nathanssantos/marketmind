import { Box, Flex, Spinner, Stack, Text } from '@chakra-ui/react';
import type { StrategyVisualizationData } from '@marketmind/types';
import { Badge, Popover, Table } from '@renderer/components/ui';
import { useStrategyVisualizationStore } from '@renderer/store/strategyVisualizationStore';
import { trpc } from '@renderer/services/trpc';
import { useQuery } from '@tanstack/react-query';
import { memo, useCallback, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

interface StrategyInfoPopoverProps {
  setupType: string;
  executionId: string;
  symbol: string;
  children: ReactNode;
}

const HOVER_DELAY = 150;

const CandlePatternTable = memo(({ data }: { data: StrategyVisualizationData }) => {
  const { t } = useTranslation();

  if (!data.patternCandles || data.patternCandles.length === 0) {
    return <Text color="fg.muted" fontSize="xs">{t('strategyInfo.noCandleData')}</Text>;
  }

  return (
    <Table.Root size="sm">
      <Table.Header>
        <Table.Row>
          <Table.ColumnHeader px={1} py={1}>#</Table.ColumnHeader>
          <Table.ColumnHeader px={1} py={1}>O</Table.ColumnHeader>
          <Table.ColumnHeader px={1} py={1}>H</Table.ColumnHeader>
          <Table.ColumnHeader px={1} py={1}>L</Table.ColumnHeader>
          <Table.ColumnHeader px={1} py={1}>C</Table.ColumnHeader>
          <Table.ColumnHeader px={1} py={1}>Vol</Table.ColumnHeader>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {data.patternCandles.map((candle) => (
          <Table.Row key={candle.offset}>
            <Table.Cell px={1} py={1} fontWeight="bold">{candle.offset}</Table.Cell>
            <Table.Cell px={1} py={1}>{candle.open.toFixed(2)}</Table.Cell>
            <Table.Cell px={1} py={1}>{candle.high.toFixed(2)}</Table.Cell>
            <Table.Cell px={1} py={1}>{candle.low.toFixed(2)}</Table.Cell>
            <Table.Cell px={1} py={1}>{candle.close.toFixed(2)}</Table.Cell>
            <Table.Cell px={1} py={1}>{(candle.volume / 1000).toFixed(1)}K</Table.Cell>
          </Table.Row>
        ))}
      </Table.Body>
    </Table.Root>
  );
});

CandlePatternTable.displayName = 'CandlePatternTable';

const IndicatorValues = memo(({ data }: { data: StrategyVisualizationData }) => {
  const { t } = useTranslation();
  const indicators = data.indicatorValues;

  if (!indicators || Object.keys(indicators).length === 0) {
    return null;
  }

  const indicatorsToShow = data.education?.candlePattern?.indicatorsToShow ?? [];
  const displayIndicators = indicatorsToShow.length > 0
    ? Object.entries(indicators).filter(([key]) =>
        indicatorsToShow.some(ind => key.toLowerCase().startsWith(ind.toLowerCase()))
      )
    : Object.entries(indicators).slice(0, 6);

  if (displayIndicators.length === 0) return null;

  return (
    <Box>
      <Text fontSize="xs" fontWeight="medium" mb={1}>{t('strategyInfo.indicators')}</Text>
      <Flex gap={2} flexWrap="wrap">
        {displayIndicators.map(([key, value]) => (
          <Badge key={key} size="xs" colorPalette="gray">
            {key}: {typeof value === 'number' ? value.toFixed(2) : '-'}
          </Badge>
        ))}
      </Flex>
    </Box>
  );
});

IndicatorValues.displayName = 'IndicatorValues';

const PerformanceStats = memo(({ data }: { data: StrategyVisualizationData }) => {
  const { t } = useTranslation();

  if (!data.performance) return null;

  const { totalTrades, winRate, avgRiskReward } = data.performance;

  return (
    <Flex gap={3} fontSize="xs">
      <Box>
        <Text color="fg.muted">{t('strategyInfo.trades')}</Text>
        <Text fontWeight="medium">{totalTrades}</Text>
      </Box>
      <Box>
        <Text color="fg.muted">{t('strategyInfo.winRate')}</Text>
        <Text fontWeight="medium" color={winRate >= 50 ? 'green.500' : 'red.500'}>
          {winRate.toFixed(1)}%
        </Text>
      </Box>
      <Box>
        <Text color="fg.muted">{t('strategyInfo.avgRR')}</Text>
        <Text fontWeight="medium">{avgRiskReward.toFixed(2)}</Text>
      </Box>
    </Flex>
  );
});

PerformanceStats.displayName = 'PerformanceStats';

const PopoverContent = memo(({ data, isLoading }: { data: StrategyVisualizationData | null; isLoading: boolean }) => {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <Flex p={4} justify="center" align="center">
        <Spinner size="sm" />
      </Flex>
    );
  }

  if (!data) {
    return (
      <Box p={4}>
        <Text color="fg.muted" fontSize="sm">{t('strategyInfo.noData')}</Text>
      </Box>
    );
  }

  return (
    <Stack gap={3} p={3} maxH="400px" overflowY="auto">
      <Box>
        <Flex justify="space-between" align="center" mb={1}>
          <Text fontWeight="semibold" fontSize="sm">{data.strategyName}</Text>
          {data.education?.origin && (
            <Badge size="sm" colorPalette="blue" px={2}>{data.education.origin.split(' - ')[0]}</Badge>
          )}
        </Flex>
        {data.education?.howItWorks?.summaryKey && (
          <Text fontSize="xs" color="fg.muted">
            {t(data.education.howItWorks.summaryKey)}
          </Text>
        )}
      </Box>

      {data.education?.howItWorks && (
        <Box>
          <Text fontSize="xs" fontWeight="medium" mb={1}>{t('strategyInfo.howItWorks')}</Text>
          <Stack gap={1}>
            <Text fontSize="xs" color="fg.muted">
              <Text as="span" fontWeight="medium">{t('strategyInfo.entry')}: </Text>
              {t(data.education.howItWorks.entryKey)}
            </Text>
            <Text fontSize="xs" color="fg.muted">
              <Text as="span" fontWeight="medium">{t('strategyInfo.exit')}: </Text>
              {t(data.education.howItWorks.exitKey)}
            </Text>
          </Stack>
        </Box>
      )}

      <Box>
        <Text fontSize="xs" fontWeight="medium" mb={1}>{t('strategyInfo.candlePattern')}</Text>
        <CandlePatternTable data={data} />
      </Box>

      <IndicatorValues data={data} />

      <PerformanceStats data={data} />
    </Stack>
  );
});

PopoverContent.displayName = 'PopoverContent';

export const StrategyInfoPopover = memo(({
  setupType,
  executionId,
  symbol,
  children,
}: StrategyInfoPopoverProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { setActiveStrategy, highlightCandlesFromData, clear } = useStrategyVisualizationStore();

  const { data, isLoading } = useQuery({
    queryKey: ['tradeVisualization', executionId],
    queryFn: () => trpc.setupDetection.getTradeVisualizationData.query({
      executionId,
      symbol,
    }),
    enabled: isOpen,
    staleTime: 10 * 60 * 1000,
  });

  const handleMouseEnter = useCallback(() => {
    hoverTimeoutRef.current = setTimeout(() => {
      setIsOpen(true);
    }, HOVER_DELAY);
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setIsOpen(false);
    clear();
  }, [clear]);

  const handleOpenChange = useCallback((details: { open: boolean }) => {
    if (details.open && data) {
      setActiveStrategy(setupType, executionId, data);
      if (data.triggerKlineIndex !== undefined) {
        highlightCandlesFromData(data, data.triggerKlineIndex);
      }
    } else {
      clear();
    }
  }, [data, setupType, executionId, setActiveStrategy, highlightCandlesFromData, clear]);

  return (
    <Box
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      display="inline-block"
    >
      <Popover
        trigger={<Box cursor="pointer">{children}</Box>}
        open={isOpen}
        onOpenChange={handleOpenChange}
        width="360px"
        positioning={{ placement: 'right-start' }}
      >
        <PopoverContent data={data ?? null} isLoading={isLoading} />
      </Popover>
    </Box>
  );
});

StrategyInfoPopover.displayName = 'StrategyInfoPopover';
