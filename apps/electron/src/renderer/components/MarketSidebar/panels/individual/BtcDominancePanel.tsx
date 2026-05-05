import { Flex } from '@chakra-ui/react';
import { Badge } from '@renderer/components/ui';
import { trpc } from '@renderer/utils/trpc';
import { useTranslation } from 'react-i18next';
import { Area, AreaChart, ResponsiveContainer, Tooltip } from 'recharts';
import {
  CHART_MARGIN,
  TOOLTIP_STYLE,
  formatTooltipDate,
} from '../../tabs/marketIndicatorUtils';
import { MarketIndicatorPanelShell } from './MarketIndicatorPanelShell';

const REFRESH_MS = 5 * 60 * 1000;

export const BtcDominancePanel = () => {
  const { t } = useTranslation();
  const { data, isLoading } = trpc.autoTrading.getBtcDominance.useQuery(
    undefined,
    { staleTime: REFRESH_MS, refetchInterval: REFRESH_MS },
  );

  const hasMetric = data && data.current !== null;
  const hasHistory = !!data?.history && data.history.length > 0;

  return (
    <MarketIndicatorPanelShell
      title={t('marketSidebar.indicators.btcDominance')}
      badges={
        hasMetric ? (
          <Flex align="center" gap={2}>
            <Badge colorPalette="orange" size="xs" px={2}>{data.current!.toFixed(1)}%</Badge>
            {data.change24h !== null && (
              <Badge size="xs" px={2} colorPalette={data.change24h >= 0 ? 'green' : 'red'}>
                24h: {data.change24h >= 0 ? '+' : ''}{data.change24h.toFixed(2)}%
              </Badge>
            )}
          </Flex>
        ) : undefined
      }
      isLoading={isLoading}
      hasData={hasHistory}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data?.history ?? []} margin={CHART_MARGIN}>
          <defs>
            <linearGradient id="dominanceGradientPanel" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--chakra-colors-orange-500)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="var(--chakra-colors-orange-500)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            labelFormatter={formatTooltipDate}
            formatter={(value) => [`${(value as number).toFixed(2)}%`, 'Dominance']}
          />
          <Area type="monotone" dataKey="dominance" stroke="var(--chakra-colors-orange-500)" strokeWidth={2} fill="url(#dominanceGradientPanel)" />
        </AreaChart>
      </ResponsiveContainer>
    </MarketIndicatorPanelShell>
  );
};

export default BtcDominancePanel;
