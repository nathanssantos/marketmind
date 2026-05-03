import { Box } from '@chakra-ui/react';
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
import { Skeleton } from './skeleton';

const DEFAULT_HEIGHT = '140px';
const DEFAULT_MARGIN = { top: 4, right: 4, bottom: 0, left: -28 } as const;
const DEFAULT_AXIS_FONT_SIZE = 9;
const DEFAULT_TOOLTIP_FONT_SIZE = '11px';
const DEFAULT_TOOLTIP_PADDING = '4px 8px';
const DEFAULT_REFERENCE_STROKE_WIDTH = 0.5;
const DEFAULT_REFERENCE_DASH = '2 4';
const DEFAULT_REFERENCE_OPACITY = 0.5;
const DEFAULT_LINE_STROKE_WIDTH = 1.5;
const DEFAULT_GRID_DASH = '2 4';
const DEFAULT_Y_AXIS_WIDTH = 32;

export interface MiniLineChartSeries {
  dataKey: string;
  name: string;
  color: string;
}

export interface MiniLineChartReferenceLine {
  y: number;
  color: string;
}

export interface MiniLineChartProps<T> {
  data: T[];
  series: MiniLineChartSeries[];
  xKey: string;
  height?: string | number;
  isLoading?: boolean;
  yDomain?: [number, number];
  yTicks?: number[];
  referenceLines?: MiniLineChartReferenceLine[];
  gridColor: string;
  axisLabelColor: string;
  tooltipBg: string;
  tooltipLabelFormatter?: (value: unknown) => string;
  tooltipValueFormatter?: (value: unknown, name: unknown) => [string, string];
}

export const MiniLineChart = <T,>({
  data,
  series,
  xKey,
  height = DEFAULT_HEIGHT,
  isLoading,
  yDomain,
  yTicks,
  referenceLines,
  gridColor,
  axisLabelColor,
  tooltipBg,
  tooltipLabelFormatter,
  tooltipValueFormatter,
}: MiniLineChartProps<T>) => {
  if (isLoading) return <Skeleton height={height} />;
  if (data.length < 2) return null;

  return (
    <Box h={height}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={DEFAULT_MARGIN}>
          <CartesianGrid strokeDasharray={DEFAULT_GRID_DASH} stroke={gridColor} />
          <XAxis dataKey={xKey} hide />
          <YAxis
            domain={yDomain}
            ticks={yTicks}
            tick={{ fill: axisLabelColor, fontSize: DEFAULT_AXIS_FONT_SIZE }}
            axisLine={false}
            tickLine={false}
            width={DEFAULT_Y_AXIS_WIDTH}
          />
          <Tooltip
            contentStyle={{
              background: tooltipBg,
              border: 'none',
              fontSize: DEFAULT_TOOLTIP_FONT_SIZE,
              padding: DEFAULT_TOOLTIP_PADDING,
            }}
            labelFormatter={tooltipLabelFormatter}
            formatter={tooltipValueFormatter}
          />
          {referenceLines?.map((rl, i) => (
            <ReferenceLine
              key={`ref-${i}-${rl.y}`}
              y={rl.y}
              stroke={rl.color}
              strokeWidth={DEFAULT_REFERENCE_STROKE_WIDTH}
              strokeDasharray={DEFAULT_REFERENCE_DASH}
              opacity={DEFAULT_REFERENCE_OPACITY}
            />
          ))}
          {series.map((s) => (
            <Line
              key={s.dataKey}
              type="monotone"
              dataKey={s.dataKey}
              name={s.name}
              stroke={s.color}
              strokeWidth={DEFAULT_LINE_STROKE_WIDTH}
              dot={false}
              isAnimationActive={false}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </Box>
  );
};
