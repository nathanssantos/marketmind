import { Flex, Stack, Text } from '@chakra-ui/react';
import { Badge } from '@renderer/components/ui';
import { trpc } from '@renderer/utils/trpc';
import { useTranslation } from 'react-i18next';
import { Area, AreaChart, ReferenceLine, ResponsiveContainer, Tooltip, YAxis } from 'recharts';
import {
  CHART_MARGIN,
  TOOLTIP_STYLE,
  formatTooltipDate,
} from '../../tabs/marketIndicatorUtils';
import { MarketIndicatorPanelShell } from './MarketIndicatorPanelShell';

const REFRESH_MS = 5 * 60 * 1000;

export const LongShortPanel = () => {
  const { t } = useTranslation();
  const { data, isLoading } = trpc.autoTrading.getLongShortRatio.useQuery(
    { symbol: 'BTCUSDT', period: '1h' },
    { staleTime: REFRESH_MS, refetchInterval: REFRESH_MS },
  );

  const hasGlobal = !!data?.global;
  const hasHistory = !!data?.globalHistory && data.globalHistory.length > 0;

  return (
    <MarketIndicatorPanelShell
      title={`${t('marketSidebar.indicators.longShortRatio')} (BTC)`}
      badges={
        hasGlobal ? (
          <Flex align="center" gap={2}>
            <Badge size="xs" px={2} colorPalette="green">Long: {(data.global!.longAccount * 100).toFixed(0)}%</Badge>
            <Badge size="xs" px={2} colorPalette="red">Short: {(data.global!.shortAccount * 100).toFixed(0)}%</Badge>
          </Flex>
        ) : undefined
      }
      isLoading={isLoading}
      hasData={hasHistory}
    >
      <Stack h="100%" gap={1}>
        <Flex flex={1} minH={0}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data?.globalHistory ?? []} margin={CHART_MARGIN}>
              <defs>
                <linearGradient id="lsGradientPanel" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--chakra-colors-green-500)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--chakra-colors-green-500)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <YAxis domain={[0, 1]} hide />
              <ReferenceLine y={0.5} stroke="var(--chakra-colors-gray-500)" strokeDasharray="3 3" strokeOpacity={0.5} />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                labelFormatter={formatTooltipDate}
                formatter={(value) => [`${((value as number) * 100).toFixed(1)}%`, 'Long']}
              />
              <Area type="monotone" dataKey="longAccount" stroke="var(--chakra-colors-green-500)" strokeWidth={2} fill="url(#lsGradientPanel)" />
            </AreaChart>
          </ResponsiveContainer>
        </Flex>
        {data?.topTraders && (
          <Text fontSize="2xs" color="fg.muted" flexShrink={0}>
            {t('marketSidebar.indicators.topTraders')}: {(data.topTraders.longAccount * 100).toFixed(1)}% / {(data.topTraders.shortAccount * 100).toFixed(1)}%
          </Text>
        )}
      </Stack>
    </MarketIndicatorPanelShell>
  );
};

export default LongShortPanel;
