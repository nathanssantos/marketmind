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
import { lttbDownsample } from './lttbDownsample';

/**
 * Net-score area chart for the confluence sidebar.
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

const DEFAULT_HEIGHT = '200px';
// Y axis is clipped to ±50 rather than the score's full ±100 range.
// In normal trading the net score lives between roughly -30 and +30;
// allocating the full ±100 wasted ~70% of the vertical space on values
// that essentially never occur. Clipping at ±50 doubles the visual
// resolution for the band where the actual signal lives, and any
// rare spike past ±50 visually pegs the chart's top/bottom edge —
// itself a useful "this is an extreme reading" cue. The bipolar
// gradient still anchors on y=0 (the neutral pivot) — half visible
// height each side.
const Y_DOMAIN: [number, number] = [-50, 50];
const Y_TICKS = [-50, -25, 0, 25, 50];
const REFERENCE_LEVELS = [-25, 0, 25] as const;
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

const GRADIENT_ID_PREFIX = 'confluence-net-score-gradient';

/**
 * Visible-point cap. The history machinery in ConfluenceScoreChart keeps
 * up to 1000 raw samples for fidelity (server seed + 30s heartbeats +
 * live appends); rendering all 1000 in a ~400px-wide chart turns into
 * the jagged, illegible mess the user reported on 2026-05-15. LTTB
 * downsampling collapses to this cap while preserving the visual
 * envelope (peaks, troughs, transitions). 100 points across 7 days of
 * history puts a point roughly every ~100min — comfortable for the eye
 * without erasing the conviction-zone crossings the chart is for.
 */
const VISIBLE_POINT_CAP = 100;

interface ConfluenceNetScoreAreaProps {
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

export const ConfluenceNetScoreArea = ({
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
}: ConfluenceNetScoreAreaProps) => {
  const transformed = useMemo(() => {
    const full = data.map((p) => ({
      t: p.t,
      long: p.long,
      short: p.short,
      net: p.long != null && p.short != null ? p.long - p.short : null,
    }));
    // LTTB downsample for readability — see VISIBLE_POINT_CAP comment.
    // Drives off `net` (the visual y) so the algorithm picks the points
    // that define the envelope, not the absolute long/short scores.
    return lttbDownsample(
      full,
      VISIBLE_POINT_CAP,
      (p) => p.t,
      (p) => p.net ?? 0,
    );
  }, [data]);

  if (isLoading) return <Skeleton height={height} />;
  if (transformed.length < 2) return null;

  const gradientId = `${GRADIENT_ID_PREFIX}-${gradientKey}`;

  return (
    <Box h={height}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={transformed} margin={MARGIN}>
          <defs>
            {/*
              Vertical gradient mapped onto the Area fill. The y-axis
              is REVERSED below (oscillator convention — oversold at
              the bottom, overbought at the top), so the gradient
              stops are flipped accordingly:
                - top of screen (visual 0%)   → short bias → loss-tinted
                - bottom of screen (visual 100%) → long bias → profit-tinted
              The middle (50%) fades both to near-zero so the neutral
              pivot is clean. With `baseValue={0}` recharts only fills
              between the data line and y=0 — the gradient just colors
              the two halves correctly without a per-point stroke trick.
            */}
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={lossColor} stopOpacity={0.55} />
              <stop offset="50%" stopColor={lossColor} stopOpacity={0.05} />
              <stop offset="50%" stopColor={profitColor} stopOpacity={0.05} />
              <stop offset="100%" stopColor={profitColor} stopOpacity={0.55} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray={GRID_DASH} stroke={gridColor} />
          <XAxis dataKey="t" hide />
          {/*
            `reversed` flips the visual orientation: positive net (long
            bias) renders at the BOTTOM, negative (short bias) at the
            TOP — matching the convention every oscillator on this
            screen uses (oversold at bottom = buy signal, overbought
            at top = sell signal). The `net = long − short` math is
            unchanged, only the rendering inverts.
          */}
          <YAxis
            domain={Y_DOMAIN}
            ticks={Y_TICKS}
            tick={{ fill: axisLabelColor, fontSize: AXIS_FONT_SIZE }}
            axisLine={false}
            tickLine={false}
            width={Y_AXIS_WIDTH}
            reversed
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
