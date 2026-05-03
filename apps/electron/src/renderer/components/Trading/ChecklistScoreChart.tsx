import type { MarketType } from '@marketmind/types';
import { Box, Flex, Text, useToken } from '@chakra-ui/react';
import { MiniLineChart, type MiniLineChartReferenceLine, type MiniLineChartSeries } from '@renderer/components/ui';
import { trpc } from '@renderer/utils/trpc';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

const MAX_HISTORY_POINTS = 1000;
const SEED_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;
const REFERENCE_LEVEL = 40;
const CHART_HEIGHT = '140px';
const Y_DOMAIN: [number, number] = [0, 100];
const Y_TICKS = [0, 50, 100];
const BACKFILL_TRIGGER_THRESHOLD = 5;
const BACKFILL_TRIGGER_SPAN_MS = 24 * 60 * 60 * 1000;

interface ChecklistScoreChartProps {
  resetKey: string;
  longScore: number | null | undefined;
  shortScore: number | null | undefined;
  profileId: string | null | undefined;
  symbol: string;
  interval: string;
  marketType: MarketType;
}

interface HistoryPoint {
  t: number;
  long: number | null;
  short: number | null;
}

const mergePoint = (history: HistoryPoint[], point: HistoryPoint): HistoryPoint[] => {
  const last = history[history.length - 1];
  if (last && last.t === point.t && last.long === point.long && last.short === point.short) return history;
  if (last && last.long === point.long && last.short === point.short) return history;
  const next = [...history, point];
  return next.length > MAX_HISTORY_POINTS ? next.slice(-MAX_HISTORY_POINTS) : next;
};

const formatTooltipTime = (t: unknown): string => new Date(Number(t)).toLocaleTimeString();
const formatTooltipValue = (value: unknown, name: unknown): [string, string] => [
  `${Math.round(Number(value))}%`,
  String(name),
];

export const ChecklistScoreChart = memo(({
  resetKey,
  longScore,
  shortScore,
  profileId,
  symbol,
  interval,
  marketType,
}: ChecklistScoreChartProps) => {
  const { t } = useTranslation();
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const lastResetKeyRef = useRef(resetKey);
  const seededKeyRef = useRef<string | null>(null);
  const backfilledKeyRef = useRef<string | null>(null);

  const queryEnabled = Boolean(profileId) && Boolean(symbol) && Boolean(interval);
  const sinceMs = useMemo(() => Date.now() - SEED_LOOKBACK_MS, [resetKey]);

  const historyQuery = trpc.trading.getScoreHistory.useQuery(
    { profileId: profileId ?? '', symbol, interval, marketType, sinceMs },
    { enabled: queryEnabled, staleTime: 60_000, refetchOnWindowFocus: false },
  );

  const backfillMutation = trpc.trading.backfillScoreHistory.useMutation({
    onSettled: () => historyQuery.refetch(),
  });

  useEffect(() => {
    if (lastResetKeyRef.current !== resetKey) {
      lastResetKeyRef.current = resetKey;
      seededKeyRef.current = null;
      backfilledKeyRef.current = null;
      setHistory([]);
    }
  }, [resetKey]);

  useEffect(() => {
    if (!historyQuery.data) return;
    if (seededKeyRef.current === resetKey) return;
    seededKeyRef.current = resetKey;
    setHistory(historyQuery.data.map((p) => ({ t: p.t, long: p.long, short: p.short })));
  }, [historyQuery.data, resetKey]);

  useEffect(() => {
    if (!queryEnabled || !profileId) return;
    if (!historyQuery.data) return;
    if (backfilledKeyRef.current === resetKey) return;
    if (backfillMutation.isPending) return;
    const points = historyQuery.data;
    const oldestT = points[0]?.t;
    const isSparse =
      points.length < BACKFILL_TRIGGER_THRESHOLD ||
      (oldestT != null && Date.now() - oldestT < BACKFILL_TRIGGER_SPAN_MS);
    if (!isSparse) return;
    backfilledKeyRef.current = resetKey;
    backfillMutation.mutate({ profileId, symbol, interval, marketType });
  }, [historyQuery.data, queryEnabled, profileId, symbol, interval, marketType, resetKey, backfillMutation]);

  useEffect(() => {
    if (longScore == null && shortScore == null) return;
    const l = longScore ?? null;
    const s = shortScore ?? null;
    setHistory((prev) => mergePoint(prev, { t: Date.now(), long: l, short: s }));
  }, [longScore, shortScore]);

  const tokens = useToken('colors', [
    'trading.profit',
    'trading.loss',
    'chart.grid',
    'chart.axis.label',
    'bg.surface',
    'fg.muted',
  ]);
  const profitColor = tokens[0] ?? '';
  const lossColor = tokens[1] ?? '';
  const gridColor = tokens[2] ?? '';
  const axisLabelColor = tokens[3] ?? '';
  const panelBg = tokens[4] ?? '';
  const referenceColor = tokens[5] ?? '';

  const series = useMemo<MiniLineChartSeries[]>(() => [
    { dataKey: 'long', name: 'L', color: profitColor },
    { dataKey: 'short', name: 'S', color: lossColor },
  ], [profitColor, lossColor]);

  const referenceLines = useMemo<MiniLineChartReferenceLine[]>(() => [
    { y: REFERENCE_LEVEL, color: referenceColor },
  ], [referenceColor]);

  const isInitialLoading =
    queryEnabled && (historyQuery.isLoading || backfillMutation.isPending) && history.length === 0;

  // After the backfill mutation settled and we still have <2 points,
  // surface a small hint instead of a blank space — saves the user from
  // wondering why the chart they enabled didn't appear. Live polling
  // will fill it within a couple of refetch ticks.
  const showCollectingHint =
    queryEnabled &&
    !isInitialLoading &&
    history.length < 2 &&
    backfilledKeyRef.current === resetKey;

  if (showCollectingHint) {
    return (
      <Box mt={1} mx={1} mb={2} h={CHART_HEIGHT}>
        <Flex h="100%" align="center" justify="center">
          <Text fontSize="2xs" color="fg.muted">
            {t('checklist.section.collectingHistory')}
          </Text>
        </Flex>
      </Box>
    );
  }

  return (
    <Box mt={1} mx={1} mb={2}>
      <MiniLineChart
        data={history}
        series={series}
        xKey="t"
        height={CHART_HEIGHT}
        isLoading={isInitialLoading}
        yDomain={Y_DOMAIN}
        yTicks={Y_TICKS}
        referenceLines={referenceLines}
        gridColor={gridColor}
        axisLabelColor={axisLabelColor}
        tooltipBg={panelBg}
        tooltipLabelFormatter={formatTooltipTime}
        tooltipValueFormatter={formatTooltipValue}
      />
    </Box>
  );
});

ChecklistScoreChart.displayName = 'ChecklistScoreChart';
