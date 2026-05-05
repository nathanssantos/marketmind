import { Flex } from '@chakra-ui/react';
import { Badge } from '@renderer/components/ui';
import { trpc } from '@renderer/utils/trpc';
import { useTranslation } from 'react-i18next';
import { Area, AreaChart, ReferenceLine, ResponsiveContainer, Tooltip, YAxis } from 'recharts';
import {
  CHART_MARGIN,
  FEAR_GREED_LEVELS,
  TOOLTIP_STYLE,
  formatTooltipDate,
  getFearGreedColor,
} from '../../tabs/marketIndicatorUtils';
import { MarketIndicatorPanelShell } from './MarketIndicatorPanelShell';

const REFRESH_MS = 60 * 60 * 1000;

export const FearGreedPanel = () => {
  const { t } = useTranslation();
  const { data, isLoading } = trpc.autoTrading.getFearGreedIndex.useQuery(
    undefined,
    { staleTime: REFRESH_MS, refetchInterval: REFRESH_MS },
  );

  const current = data?.current;
  const history = data?.history;
  const color = getFearGreedColor(current?.value ?? 50);

  return (
    <MarketIndicatorPanelShell
      title={t('marketSidebar.indicators.fearGreed')}
      badges={
        current ? (
          <Flex gap={2}>
            <Badge colorPalette={color} size="xs" px={2}>
              {current.value} - {current.valueClassification}
            </Badge>
          </Flex>
        ) : undefined
      }
      isLoading={isLoading}
      hasData={!!history && history.length > 0}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={history ?? []} margin={CHART_MARGIN}>
          <defs>
            <linearGradient id="fearGreedGradientPanel" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={`var(--chakra-colors-${color}-500)`} stopOpacity={0.3} />
              <stop offset="95%" stopColor={`var(--chakra-colors-${color}-500)`} stopOpacity={0} />
            </linearGradient>
          </defs>
          <YAxis domain={[0, 100]} hide />
          {FEAR_GREED_LEVELS.slice(0, -1).map((level) => (
            <ReferenceLine
              key={level.max}
              y={level.max}
              stroke={`var(--chakra-colors-${level.color}-500)`}
              strokeDasharray="3 3"
              strokeOpacity={0.35}
            />
          ))}
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            labelFormatter={formatTooltipDate}
            formatter={(value) => [value, 'Fear & Greed']}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={`var(--chakra-colors-${color}-500)`}
            strokeWidth={2}
            fill="url(#fearGreedGradientPanel)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </MarketIndicatorPanelShell>
  );
};

export default FearGreedPanel;
