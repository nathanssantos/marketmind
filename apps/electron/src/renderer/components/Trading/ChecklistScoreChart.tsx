import type { MarketType } from '@marketmind/types';
import { Box, Flex, Text, useToken } from '@chakra-ui/react';
import { MiniLineChart, type MiniLineChartReferenceLine, type MiniLineChartSeries } from '@renderer/components/ui';
import { trpc } from '@renderer/utils/trpc';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

const MAX_HISTORY_POINTS = 1000;
const SEED_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;
// Three guide lines on the L/S score chart: 25 / 50 / 75. The middle
// line is the "neutral" axis; outer lines mark the conviction zones
// (above 75 = strong; below 25 = weak). Earlier we shipped a single
// line at 40, which was an arbitrary threshold neither tied to the
// scale's midpoint nor to a meaningful trigger level.
const REFERENCE_LEVELS = [25, 50, 75] as const;
const CHART_HEIGHT = '140px';
const Y_DOMAIN: [number, number] = [0, 100];
const Y_TICKS = [0, 50, 100];
const BACKFILL_TRIGGER_THRESHOLD = 5;
const BACKFILL_TRIGGER_SPAN_MS = 24 * 60 * 60 * 1000;
// Re-emit a "live" point at most every SAME_VALUE_HEARTBEAT_MS even
// when the score is stable. Without this the chart line ends at the
// timestamp of the last value CHANGE — visually frozen mid-chart
// while the live badge shows a fresher number. Setting the heartbeat
// to 30s balances density (chart stays "alive" at the right edge)
// against memory (~120 points/hour, well under MAX_HISTORY_POINTS).
const SAME_VALUE_HEARTBEAT_MS = 30_000;

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
  // Exact dup (same timestamp + values): never add.
  if (last?.t === point.t && last?.long === point.long && last?.short === point.short) return history;
  // Same values, different time: collapse only if within the heartbeat
  // window. If the score has been stable for longer, emit a refresh
  // point so the chart line stays anchored near "now" instead of
  // ending at the last value-change timestamp. Without this, a stable
  // score for 10 minutes would freeze the visual line 10 minutes from
  // the right edge of the chart even though the badge shows the value
  // is current.
  if (
    last?.long === point.long
    && last?.short === point.short
    && last !== undefined
    && (point.t - last.t) < SAME_VALUE_HEARTBEAT_MS
  ) {
    return history;
  }
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
  const lastSeededDataRef = useRef<unknown>(null);
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
      lastSeededDataRef.current = null;
      backfilledKeyRef.current = null;
      setHistory([]);
    }
  }, [resetKey]);

  // Seed / re-seed from server. Earlier this gated on a per-resetKey
  // ref so the FIRST data delivery wins forever. That had a race on
  // timeframe switch: the previous interval's cached data was still
  // in `historyQuery.data` when resetKey flipped, so the chart got
  // seeded with stale points and locked there — subsequent refetches
  // for the new interval no-op'd. Now we gate on data identity
  // instead: every fresh server payload re-seeds the history,
  // preserving any LIVE-appended points that are newer than the
  // server's max timestamp (so we don't lose the live trail when a
  // refetch lands).
  useEffect(() => {
    if (!historyQuery.data) return;
    if (lastSeededDataRef.current === historyQuery.data) return;
    lastSeededDataRef.current = historyQuery.data;
    const serverPoints: HistoryPoint[] = historyQuery.data.map((p) => ({
      t: p.t,
      long: p.long,
      short: p.short,
    }));
    const serverMaxT = serverPoints[serverPoints.length - 1]?.t ?? 0;
    setHistory((prev) => {
      const livePoints = prev.filter((p) => p.t > serverMaxT);
      return [...serverPoints, ...livePoints];
    });
  }, [historyQuery.data]);

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

  // Live append: write a point whenever scores change AND a heartbeat
  // tick (every SAME_VALUE_HEARTBEAT_MS) so the line keeps extending
  // visually even when scores stay flat. Earlier we depended only on
  // [longScore, shortScore] — value-stable scores never re-fired the
  // effect, so the line was stuck at the last value-CHANGE timestamp.
  useEffect(() => {
    if (longScore == null && shortScore == null) return;
    const l = longScore ?? null;
    const s = shortScore ?? null;

    setHistory((prev) => mergePoint(prev, { t: Date.now(), long: l, short: s }));

    const heartbeatId = setInterval(() => {
      setHistory((prev) => mergePoint(prev, { t: Date.now(), long: l, short: s }));
    }, SAME_VALUE_HEARTBEAT_MS);
    return () => clearInterval(heartbeatId);
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

  const referenceLines = useMemo<MiniLineChartReferenceLine[]>(
    () => REFERENCE_LEVELS.map((y) => ({ y, color: referenceColor })),
    [referenceColor],
  );

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
