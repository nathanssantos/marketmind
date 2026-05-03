import type { MarketType } from '@marketmind/types';
import { Box, useToken } from '@chakra-ui/react';
import { Skeleton } from '@renderer/components/ui';
import { trpc } from '@renderer/utils/trpc';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const MAX_HISTORY_POINTS = 1000;
const SEED_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;
const REFERENCE_LEVEL = 40;
const CHART_HEIGHT = '140px';

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

export const ChecklistScoreChart = memo(({
  resetKey,
  longScore,
  shortScore,
  profileId,
  symbol,
  interval,
  marketType,
}: ChecklistScoreChartProps) => {
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const lastResetKeyRef = useRef(resetKey);
  const seededKeyRef = useRef<string | null>(null);

  const queryEnabled = Boolean(profileId) && Boolean(symbol) && Boolean(interval);
  const sinceMs = useMemo(() => Date.now() - SEED_LOOKBACK_MS, [resetKey]);

  const historyQuery = trpc.trading.getScoreHistory.useQuery(
    { profileId: profileId ?? '', symbol, interval, marketType, sinceMs },
    { enabled: queryEnabled, staleTime: 60_000, refetchOnWindowFocus: false },
  );

  useEffect(() => {
    if (lastResetKeyRef.current !== resetKey) {
      lastResetKeyRef.current = resetKey;
      seededKeyRef.current = null;
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
    if (longScore == null && shortScore == null) return;
    const l = longScore ?? null;
    const s = shortScore ?? null;
    setHistory((prev) => mergePoint(prev, { t: Date.now(), long: l, short: s }));
  }, [longScore, shortScore]);

  const [profitColor, lossColor, gridColor, axisLabelColor, panelBg, referenceColor] = useToken('colors', [
    'trading.profit',
    'trading.loss',
    'chart.grid',
    'chart.axis.label',
    'bg.surface',
    'fg.muted',
  ]);

  const isInitialLoading = queryEnabled && historyQuery.isLoading && history.length === 0;

  if (isInitialLoading) {
    return (
      <Box mt={1} mx={1} mb={2}>
        <Skeleton height={CHART_HEIGHT} />
      </Box>
    );
  }

  if (history.length < 2) return null;

  return (
    <Box mt={1} mx={1} mb={2} h={CHART_HEIGHT}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={history} margin={{ top: 4, right: 4, bottom: 0, left: -28 }}>
          <CartesianGrid strokeDasharray="2 4" stroke={gridColor} />
          <XAxis dataKey="t" hide />
          <YAxis
            domain={[0, 100]}
            ticks={[0, 50, 100]}
            tick={{ fill: axisLabelColor, fontSize: 9 }}
            axisLine={false}
            tickLine={false}
            width={32}
          />
          <Tooltip
            contentStyle={{ background: panelBg, border: 'none', fontSize: '11px', padding: '4px 8px' }}
            labelFormatter={(t) => new Date(Number(t)).toLocaleTimeString()}
            formatter={(value, name) => [`${Math.round(Number(value))}%`, String(name)]}
          />
          <ReferenceLine
            y={REFERENCE_LEVEL}
            stroke={referenceColor}
            strokeWidth={0.5}
            strokeDasharray="2 4"
            opacity={0.5}
          />
          <Line
            type="monotone"
            dataKey="long"
            name="L"
            stroke={profitColor}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="short"
            name="S"
            stroke={lossColor}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </Box>
  );
});

ChecklistScoreChart.displayName = 'ChecklistScoreChart';
