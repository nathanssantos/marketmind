import { Flex } from '@chakra-ui/react';
import { Badge } from '@renderer/components/ui';
import { trpc } from '@renderer/utils/trpc';
import { useTranslation } from 'react-i18next';
import { Area, AreaChart, ReferenceLine, ResponsiveContainer, Tooltip, YAxis } from 'recharts';
import {
  CHART_MARGIN,
  TOOLTIP_STYLE,
  formatTooltipDate,
  getMvrvColor,
} from '../../tabs/marketIndicatorUtils';
import { MarketIndicatorPanelShell } from './MarketIndicatorPanelShell';

const REFRESH_MS = 60 * 60 * 1000;

export const MvrvPanel = () => {
  const { t } = useTranslation();
  const { data, isLoading } = trpc.autoTrading.getMvrvRatio.useQuery(
    undefined,
    { staleTime: REFRESH_MS, refetchInterval: REFRESH_MS },
  );

  const hasMetric = data && data.current !== null;
  const hasHistory = !!data?.history && data.history.length > 0;
  const color = getMvrvColor(data?.current ?? null);

  return (
    <MarketIndicatorPanelShell
      title={t('marketSidebar.indicators.mvrv')}
      badges={
        hasMetric ? (
          <Flex align="center" gap={2}>
            <Badge colorPalette={color} size="xs" px={2}>{data.current!.toFixed(2)}</Badge>
            <Badge colorPalette="gray" size="xs" px={2}>
              {data.current! >= 3.5 ? 'Overheated' : data.current! >= 1 ? 'Above Realized' : 'Below Realized'}
            </Badge>
          </Flex>
        ) : undefined
      }
      isLoading={isLoading}
      hasData={hasHistory}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data?.history ?? []} margin={CHART_MARGIN}>
          <defs>
            <linearGradient id="mvrvGradientPanel" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={`var(--chakra-colors-${color}-500)`} stopOpacity={0.3} />
              <stop offset="95%" stopColor={`var(--chakra-colors-${color}-500)`} stopOpacity={0} />
            </linearGradient>
          </defs>
          <YAxis hide />
          <ReferenceLine y={1} stroke="var(--chakra-colors-gray-500)" strokeDasharray="3 3" strokeOpacity={0.5} />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            labelFormatter={formatTooltipDate}
            formatter={(value) => [(value as number).toFixed(2), 'MVRV']}
          />
          <Area type="monotone" dataKey="value" stroke={`var(--chakra-colors-${color}-500)`} strokeWidth={2} fill="url(#mvrvGradientPanel)" />
        </AreaChart>
      </ResponsiveContainer>
    </MarketIndicatorPanelShell>
  );
};

export default MvrvPanel;
