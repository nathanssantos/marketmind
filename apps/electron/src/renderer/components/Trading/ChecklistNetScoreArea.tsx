import { Box } from '@chakra-ui/react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Skeleton } from '@renderer/components/ui';
import { useMemo } from 'react';

/**
 * Net-score area chart for the checklist sidebar.
 *
 * Replaces the two-line `L%` / `S%` chart with a single `net = long − short`
 * area that's tinted green above the zero axis (long bias) and red below
 * (short bias). The user-facing question this answers is "which direction
 * is the setup pointing right now and by how much?" — phrased in one
 * unambiguous quantity instead of two competing ones. Both lines were
 * fundamentally answering the same question via mutual exclusion (you
 * only enter one side at a time), so collapsing them to a signed scalar
 * is information-preserving for the decision the trader actually makes.
 *
 * Trade-off the user accepted before signoff: "L 60% / S 60%" collapses
 * to net=0, indistinguishable from "L 0% / S 0%". The current tooltip
 * preserves the absolute L/S figures so that nuance is still inspectable
 * on hover; the live ScoreBadgePair above the chart shows the same on
 * the right edge in real time.
 */

const DEFAULT_HEIGHT = '140px';
const Y_DOMAIN: [number, number] = [-100, 100];
const Y_TICKS = [-100, -50, 0, 50, 100];
const REFERENCE_LEVELS = [-50, 0, 50] as const;
const MARGIN = { top: 4, right: 4, bottom: 0, left: -28 } as const;
const AXIS_FONT_SIZE = 9;
const TOOLTIP_FONT_SIZE = '11px';
const TOOLTIP_PADDING = '4px 8px';
const REFERENCE_STROKE_WIDTH = 0.5;
const REFERENCE_DASH = '2 4';
const REFERENCE_OPACITY = 0.5;
const GRID_DASH = '2 4';
const Y_AXIS_WIDTH = 32;
const AREA_STROKE_WIDTH = 1.5;

const GRADIENT_ID_PREFIX = 'checklist-net-score-gradient';

interface ChecklistNetScoreAreaProps {
  data: Array<{ t: number; long: number | null; short: number | null }>;
  isLoading?: boolean;
  profitColor: string;
  lossColor: string;
  neutralStrokeColor: string;
  gridColor: string;
  axisLabelColor: string;
  tooltipBg: string;
  height?: string | number;
  /**
   * Unique suffix for the SVG gradient `<linearGradient id>`. Two
   * instances of this component on the same page would collide on the
   * default id; the caller passes a profile/resetKey so each instance
   * gets its own gradient.
   */
  gradientKey: string;
  tooltipLabelFormatter?: (value: unknown) => string;
}

const formatNet = (value: unknown, original: { long: number | null; short: number | null }): string => {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  const sign = n > 0 ? '+' : '';
  const long = original.long ?? 0;
  const short = original.short ?? 0;
  return `${sign}${Math.round(n)}% (L ${Math.round(long)}% · S ${Math.round(short)}%)`;
};

export const ChecklistNetScoreArea = ({
  data,
  isLoading,
  profitColor,
  lossColor,
  neutralStrokeColor,
  gridColor,
  axisLabelColor,
  tooltipBg,
  height = DEFAULT_HEIGHT,
  gradientKey,
  tooltipLabelFormatter,
}: ChecklistNetScoreAreaProps) => {
  const transformed = useMemo(
    () =>
      data.map((p) => ({
        t: p.t,
        long: p.long,
        short: p.short,
        net: p.long != null && p.short != null ? p.long - p.short : null,
      })),
    [data],
  );

  if (isLoading) return <Skeleton height={height} />;
  if (transformed.length < 2) return null;

  const gradientId = `${GRADIENT_ID_PREFIX}-${gradientKey}`;

  return (
    <Box h={height}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={transformed} margin={MARGIN}>
          <defs>
            {/*
              Vertical gradient mapped onto the Area fill: top of the
              chart (-100..+100 domain → y=0 is at 50% screen height)
              is profit-tinted, bottom is loss-tinted, both fade to
              transparent as they approach the midpoint. With
              `baseValue={0}`, recharts already only fills between the
              value line and y=0 — the gradient just colors the two
              halves correctly without a per-point stroke trick.
            */}
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={profitColor} stopOpacity={0.55} />
              <stop offset="50%" stopColor={profitColor} stopOpacity={0.05} />
              <stop offset="50%" stopColor={lossColor} stopOpacity={0.05} />
              <stop offset="100%" stopColor={lossColor} stopOpacity={0.55} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray={GRID_DASH} stroke={gridColor} />
          <XAxis dataKey="t" hide />
          <YAxis
            domain={Y_DOMAIN}
            ticks={Y_TICKS}
            tick={{ fill: axisLabelColor, fontSize: AXIS_FONT_SIZE }}
            axisLine={false}
            tickLine={false}
            width={Y_AXIS_WIDTH}
          />
          <Tooltip
            contentStyle={{
              background: tooltipBg,
              border: 'none',
              fontSize: TOOLTIP_FONT_SIZE,
              padding: TOOLTIP_PADDING,
            }}
            labelFormatter={tooltipLabelFormatter}
            formatter={(value, _name, item) => {
              const payload = item?.payload as { long: number | null; short: number | null };
              return [formatNet(value, payload), 'Net'];
            }}
          />
          {REFERENCE_LEVELS.map((y) => (
            <ReferenceLine
              key={`ref-${y}`}
              y={y}
              stroke={y === 0 ? neutralStrokeColor : gridColor}
              strokeWidth={y === 0 ? 1 : REFERENCE_STROKE_WIDTH}
              strokeDasharray={y === 0 ? undefined : REFERENCE_DASH}
              opacity={y === 0 ? 0.7 : REFERENCE_OPACITY}
            />
          ))}
          <Area
            type="monotone"
            dataKey="net"
            stroke={neutralStrokeColor}
            strokeWidth={AREA_STROKE_WIDTH}
            fill={`url(#${gradientId})`}
            baseValue={0}
            isAnimationActive={false}
            connectNulls
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </Box>
  );
};
