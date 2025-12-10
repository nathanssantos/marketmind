import { Box, Text, useToken } from '@chakra-ui/react';
import type { BacktestEquityPoint } from '@marketmind/types';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface EquityCurveChartProps {
  equityCurve: BacktestEquityPoint[];
  initialCapital: number;
  currency?: string;
}

export const EquityCurveChart = ({
  equityCurve,
  initialCapital,
  currency = 'USDT',
}: EquityCurveChartProps) => {
  const [chartPrimary, chartSecondary, chartNegative, chartGrid, chartTextMuted] = useToken(
    'colors',
    ['chart.line.default', 'fg.muted', 'red.500', 'chart.grid', 'chart.axis.label']
  );

  const chartData = equityCurve.map((point) => ({
    time: new Date(point.time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    equity: point.equity,
    initialCapital,
    drawdown: -point.drawdown, // Negative for display
  }));

  const formatCurrency = (value: number) => {
    return `${currency} ${value.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const CustomTooltip = ({
    active,
    payload,
  }: {
    active?: boolean;
    payload?: Array<{ value: number; payload: { time: string; drawdown: number } }>;
  }) => {
    if (active && payload && payload.length >= 1) {
      const equity = payload[0]?.value ?? 0;
      const drawdown = Math.abs(payload[0]?.payload.drawdown ?? 0);
      const pnl = equity - initialCapital;
      const pnlPercent = ((pnl / initialCapital) * 100).toFixed(2);

      return (
        <Box p={2} bg="bg.panel" borderRadius="md" borderWidth="1px" borderColor="border">
          <Text fontSize="xs" fontWeight="medium" mb={1}>
            {payload[0]?.payload.time}
          </Text>
          <Box fontSize="2xs" gap={0.5}>
            <Text style={{ color: chartPrimary }}>
              Equity: {formatCurrency(equity)}
            </Text>
            <Text color={pnl >= 0 ? 'green.500' : 'red.500'}>
              PnL: {pnl >= 0 ? '+' : ''}
              {formatCurrency(pnl)} ({pnl >= 0 ? '+' : ''}
              {pnlPercent}%)
            </Text>
            {drawdown > 0 && (
              <Text color="red.500">Drawdown: -{formatCurrency(drawdown)}</Text>
            )}
          </Box>
        </Box>
      );
    }
    return null;
  };

  if (chartData.length === 0) {
    return (
      <Box p={4} textAlign="center" bg="bg.muted" borderRadius="md">
        <Text fontSize="xs" color="fg.muted">
          No equity data available
        </Text>
      </Box>
    );
  }

  return (
    <Box h="300px">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} />
          <XAxis dataKey="time" style={{ fontSize: '10px', fill: chartTextMuted }} />
          <YAxis
            yAxisId="equity"
            orientation="left"
            tickFormatter={(value) => `${currency} ${value.toLocaleString()}`}
            style={{ fontSize: '10px', fill: chartTextMuted }}
          />
          <YAxis
            yAxisId="drawdown"
            orientation="right"
            tickFormatter={(value) => `${value.toLocaleString()}`}
            style={{ fontSize: '10px', fill: chartTextMuted }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: '11px' }} />
          <defs>
            <linearGradient id="colorEquity" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={chartPrimary} stopOpacity={0.3} />
              <stop offset="95%" stopColor={chartPrimary} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorDrawdown" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={chartNegative} stopOpacity={0.3} />
              <stop offset="95%" stopColor={chartNegative} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            yAxisId="equity"
            type="monotone"
            dataKey="equity"
            stroke={chartPrimary}
            fillOpacity={1}
            fill="url(#colorEquity)"
            name="Equity"
          />
          <Line
            yAxisId="equity"
            type="monotone"
            dataKey="initialCapital"
            stroke={chartSecondary}
            strokeDasharray="5 5"
            dot={false}
            name="Initial Capital"
          />
          <Area
            yAxisId="drawdown"
            type="monotone"
            dataKey="drawdown"
            stroke={chartNegative}
            fillOpacity={0.5}
            fill="url(#colorDrawdown)"
            name="Drawdown"
          />
        </AreaChart>
      </ResponsiveContainer>
    </Box>
  );
};
