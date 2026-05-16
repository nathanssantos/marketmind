import type { MarketType } from '@marketmind/types';
import { Box, Flex, Text, useToken } from '@chakra-ui/react';
import { trpc } from '@renderer/utils/trpc';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ConfluenceNetScoreArea } from './ConfluenceNetScoreArea';

const MAX_HISTORY_POINTS = 1000;
const SEED_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;
const CHART_HEIGHT = '200px';
const BACKFILL_TRIGGER_THRESHOLD = 5;
const BACKFILL_TRIGGER_SPAN_MS = 24 * 60 * 60 * 1000;
// Re-emit a "live" point at most every SAME_VALUE_HEARTBEAT_MS even
// when the score is stable. Without this the chart line ends at the
// timestamp of the last value CHANGE — visually frozen mid-chart
// while the live badge shows a fresher number. Setting the heartbeat
// to 30s balances density (chart stays "alive" at the right edge)
// against memory (~120 points/hour, well under MAX_HISTORY_POINTS).
const SAME_VALUE_HEARTBEAT_MS = 30_000;
// Tolerance window when merging server-canonical points with locally
// appended live points: if a local point is within this many ms of
// any server point, drop the local copy (server timestamp is
// canonical for that window). Outside any server window, the local
// point survives — that's how transient peaks between server
// snapshots stay visible in the chart.
const SERVER_LOCAL_MERGE_TOLERANCE_MS = 5_000;

interface ConfluenceScoreChartProps {
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

export const ConfluenceScoreChart = memo(({
  resetKey,
  longScore,
  shortScore,
  profileId,
  symbol,
  interval,
  marketType,
}: ConfluenceScoreChartProps) => {
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
  // instead: every fresh server payload re-seeds the history.
  //
  // Merge-strategy: we MUST NOT just replace local history with
  // serverPoints + tail. The backend's write-through fires on each
  // `evaluateConfluence` call (every ~15s); local live-appends fire
  // every time longScore/shortScore change in React state, which
  // can be more frequent. So local state can hold transient peaks
  // that happened BETWEEN backend snapshots. If we replace and
  // filter by `t > serverMaxT`, those mid-window peaks vanish from
  // the chart on every refetch — the bug user reported as "vi
  // valor acima de 25% mas os picos não vão até lá".
  //
  // Instead: merge-dedupe with a 5s tolerance window. Server points
  // are canonical for any window they cover; local points outside
  // every server window survive the merge. This preserves the live
  // peaks indefinitely (until MAX_HISTORY_POINTS rolls them off).
  useEffect(() => {
    if (!historyQuery.data) return;
    if (lastSeededDataRef.current === historyQuery.data) return;
    lastSeededDataRef.current = historyQuery.data;
    const serverPoints: HistoryPoint[] = historyQuery.data.map((p) => ({
      t: p.t,
      long: p.long,
      short: p.short,
    }));
    setHistory((prev) => {
      // Sorted server timestamps for binary-search nearest-neighbor.
      const serverTimes = serverPoints.map((p) => p.t);
      const isCovered = (t: number): boolean => {
        if (serverTimes.length === 0) return false;
        let lo = 0;
        let hi = serverTimes.length - 1;
        while (lo <= hi) {
          const mid = (lo + hi) >>> 1;
          const dt = Math.abs(serverTimes[mid]! - t);
          if (dt <= SERVER_LOCAL_MERGE_TOLERANCE_MS) return true;
          if (serverTimes[mid]! < t) lo = mid + 1;
          else hi = mid - 1;
        }
        return false;
      };
      const livePoints = prev.filter((p) => !isCovered(p.t));
      const merged = [...serverPoints, ...livePoints].sort((a, b) => a.t - b.t);
      return merged.length > MAX_HISTORY_POINTS
        ? merged.slice(-MAX_HISTORY_POINTS)
        : merged;
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
  const neutralStrokeColor = tokens[5] ?? '';

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
            {t('confluence.section.collectingHistory')}
          </Text>
        </Flex>
      </Box>
    );
  }

  return (
    <Box mt={1} mx={1} mb={2}>
      <ConfluenceNetScoreArea
        data={history}
        isLoading={isInitialLoading}
        profitColor={profitColor}
        lossColor={lossColor}
        neutralStrokeColor={neutralStrokeColor}
        gridColor={gridColor}
        axisLabelColor={axisLabelColor}
        tooltipBg={panelBg}
        height={CHART_HEIGHT}
        gradientKey={resetKey}
        tooltipLabelFormatter={formatTooltipTime}
      />
    </Box>
  );
});

ConfluenceScoreChart.displayName = 'ConfluenceScoreChart';
