import { Box, useToken } from '@chakra-ui/react';
import { memo, useEffect, useRef, useState } from 'react';
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

const MAX_HISTORY_POINTS = 60;
// Auxiliary horizontal threshold — at 40% the user has a meaningful
// share of the checklist passing without it being a strong signal yet.
// Two ReferenceLines (one in long color, one in short color) drawn at
// the same y so the user sees "where 40% sits" against either series.
const REFERENCE_LEVEL = 40;

interface ChecklistScoreChartProps {
  /** Composite key (symbol + interval + marketType) — when this changes the history resets. */
  resetKey: string;
  longScore: number | null | undefined;
  shortScore: number | null | undefined;
}

interface HistoryPoint {
  t: number;
  long: number | null;
  short: number | null;
}

/**
 * Tracks the rolling L / S checklist score over time and renders a small
 * Recharts line chart below the score row. History lives in component
 * state — capped at 60 points (15 s × 60 = 15 min at the current
 * refetchInterval) so the chart stays cheap to render and doesn't
 * accumulate forever. Reset on `resetKey` change so flipping symbol /
 * interval doesn't blend two unrelated series.
 */
export const ChecklistScoreChart = memo(({ resetKey, longScore, shortScore }: ChecklistScoreChartProps) => {
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const lastResetKeyRef = useRef(resetKey);

  useEffect(() => {
    if (lastResetKeyRef.current !== resetKey) {
      lastResetKeyRef.current = resetKey;
      setHistory([]);
    }
  }, [resetKey]);

  useEffect(() => {
    if (longScore == null && shortScore == null) return;
    const last = history[history.length - 1];
    const l = longScore ?? null;
    const s = shortScore ?? null;
    // Skip if the last sample has the exact same scores — keeps the
    // history tight when nothing meaningful changed between polls.
    if (last && last.long === l && last.short === s) return;
    setHistory((prev) => {
      const next = [...prev, { t: Date.now(), long: l, short: s }];
      return next.length > MAX_HISTORY_POINTS ? next.slice(-MAX_HISTORY_POINTS) : next;
    });
  }, [longScore, shortScore, history]);

  const [profitColor, lossColor, gridColor, axisLabelColor, panelBg] = useToken('colors', [
    'trading.profit',
    'trading.loss',
    'chart.grid',
    'chart.axis.label',
    'bg.surface',
  ]);

  if (history.length < 2) return null;

  return (
    <Box mt={1} mx={1} h="80px">
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
            stroke={profitColor}
            strokeWidth={0.5}
            strokeDasharray="2 4"
            opacity={0.6}
            label={{ value: `L ${REFERENCE_LEVEL}%`, position: 'insideRight', fill: profitColor, fontSize: 8, dy: -4 }}
          />
          <ReferenceLine
            y={REFERENCE_LEVEL}
            stroke={lossColor}
            strokeWidth={0.5}
            strokeDasharray="2 4"
            opacity={0.6}
            label={{ value: `S ${REFERENCE_LEVEL}%`, position: 'insideLeft', fill: lossColor, fontSize: 8, dy: -4 }}
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
