import { Box } from '@chakra-ui/react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceArea,
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
const MARGIN = { top: 4, right: 4, bottom: 0, left: -28 } as const;
const AXIS_FONT_SIZE = 9;
const TOOLTIP_FONT_SIZE = '11px';
const TOOLTIP_PADDING = '4px 8px';
const THRESHOLD_STROKE_WIDTH = 1;
const GRID_DASH = '2 4';
const Y_AXIS_WIDTH = 32;
const AREA_STROKE_WIDTH = 1.5;
// Neutral-band fill stays subtle on purpose — the band is the "no
// entry" zone but the trader is staring at the SCORE LINE, not the
// band. Anything > 0.04 starts competing for visual weight with the
// gradient. The line is what answers "should I enter?"; the band
// only contextualizes "is the line in the dead zone?".
const NEUTRAL_BAND_OPACITY = 0.03;
const NEUTRAL_BAND_FILL_VAR = 'var(--chakra-colors-fg-muted)';

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
  /**
   * Absolute net-score at which a long-bias entry zone is marked.
   * Rendered as a solid horizontal line at `+longThreshold` with a tag.
   */
  longThreshold: number;
  /**
   * Absolute net-score (positive number) at which a short-bias entry
   * zone is marked. Rendered as a solid line at `-shortThreshold` —
   * the chart shows the negative side because `net = long − short`,
   * so a short-favored reading is negative.
   */
  shortThreshold: number;
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
  longThreshold,
  shortThreshold,
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
    const sampled = lttbDownsample(
      full,
      VISIBLE_POINT_CAP,
      (p) => p.t,
      (p) => p.net ?? 0,
    );
    // Side-specific fills. Reason for the split: recharts maps a gradient
    // to the FILL PATH's bounding box (objectBoundingBox), not the chart's
    // coordinate system. With a single bipolar fill from data line to
    // baseValue=0, when the line spikes one direction the fill's bbox is
    // small and the gradient's "neutral middle" lands at the zero line
    // physically — but the saturated EDGE of the gradient also gets
    // pulled closer to zero, painting (say) green a few pixels above
    // the zero line just because the bbox is asymmetric. Two areas with
    // SEPARATE gradients (each clamped to one side of zero) keep the
    // saturation tied to how far the data is from zero, not the bbox
    // size — which is the visual property the trader is reading.
    return sampled.map((p) => ({
      ...p,
      netPositive: p.net != null && p.net > 0 ? p.net : null,
      netNegative: p.net != null && p.net < 0 ? p.net : null,
    }));
  }, [data]);

  if (isLoading) return <Skeleton height={height} />;
  if (transformed.length < 2) return null;

  const profitGradientId = `${GRADIENT_ID_PREFIX}-profit-${gradientKey}`;
  const lossGradientId = `${GRADIENT_ID_PREFIX}-loss-${gradientKey}`;

  return (
    <Box h={height}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={transformed} margin={MARGIN}>
          <defs>
            {/*
              Two separate gradients — one per side of zero. Each gets
              mapped to its own Area's fill bounding box (which only
              covers one side of the zero line), so the saturation
              edge stays at the data extreme and the transparent end
              stays at the zero line — instead of being yanked toward
              the bbox midpoint as a single bipolar gradient would.
              The y-axis is REVERSED, so:
                - positive net renders BELOW zero visually → profit gradient
                  fades from transparent (top of fill, near zero) to
                  saturated (bottom of fill, far from zero)
                - negative net renders ABOVE zero visually → loss gradient
                  fades from saturated (top of fill, far from zero) to
                  transparent (bottom of fill, near zero)
            */}
            <linearGradient id={profitGradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={profitColor} stopOpacity={0.05} />
              <stop offset="100%" stopColor={profitColor} stopOpacity={0.55} />
            </linearGradient>
            <linearGradient id={lossGradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={lossColor} stopOpacity={0.55} />
              <stop offset="100%" stopColor={lossColor} stopOpacity={0.05} />
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
          {/*
            Dead-zone band between the short threshold (negative) and
            the long threshold (positive). Subtle neutral fill — the
            band is contextual, not the focal element. With
            ifOverflow="hidden" recharts clips the rect to the y-axis
            domain, so users with thresholds beyond ±50 don't see
            visual artifacts at the chart edges.
          */}
          <ReferenceArea
            y1={-shortThreshold}
            y2={longThreshold}
            fill={NEUTRAL_BAND_FILL_VAR}
            fillOpacity={NEUTRAL_BAND_OPACITY}
            ifOverflow="hidden"
            stroke="none"
          />
          {/* Long entry threshold (positive y). Profit-tinted, solid. */}
          <ReferenceLine
            y={longThreshold}
            stroke={profitColor}
            strokeWidth={THRESHOLD_STROKE_WIDTH}
            opacity={0.7}
          />
          {/*
            Short entry threshold — drawn at NEGATIVE shortThreshold
            because `net = long − short`, so a short-favored reading
            is below zero.
          */}
          <ReferenceLine
            y={-shortThreshold}
            stroke={lossColor}
            strokeWidth={THRESHOLD_STROKE_WIDTH}
            opacity={0.7}
          />
          {/* Neutral pivot — kept for orientation, distinct from the bands above. */}
          <ReferenceLine
            y={0}
            stroke={neutralStrokeColor}
            strokeWidth={1}
            opacity={0.5}
          />
          {/*
            Three-layer rendering for the bipolar shape:
              1. `netPositive` area — green fill on the long-bias side,
                 stroke=none so it doesn't try to connect across zero
                 crossings (which would draw a flat segment at y=0).
              2. `netNegative` area — same, mirrored, red fill.
              3. `net` area — full data with transparent fill, just the
                 continuous stroke. `connectNulls` here is the original
                 LTTB-downsampled series, so the line stays smooth
                 across zero crossings without the fills competing.
          */}
          <Area
            type="monotone"
            dataKey="netPositive"
            stroke="none"
            fill={`url(#${profitGradientId})`}
            baseValue={0}
            isAnimationActive={false}
            connectNulls={false}
            dot={false}
            activeDot={false}
          />
          <Area
            type="monotone"
            dataKey="netNegative"
            stroke="none"
            fill={`url(#${lossGradientId})`}
            baseValue={0}
            isAnimationActive={false}
            connectNulls={false}
            dot={false}
            activeDot={false}
          />
          <Area
            type="monotone"
            dataKey="net"
            stroke={neutralStrokeColor}
            strokeWidth={AREA_STROKE_WIDTH}
            fill="transparent"
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
