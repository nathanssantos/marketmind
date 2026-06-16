import { Flex } from '@chakra-ui/react';
import { Badge } from '@renderer/components/ui';
import { trpc } from '@renderer/utils/trpc';
import { useTranslation } from 'react-i18next';
import { Area, AreaChart, ReferenceLine, ResponsiveContainer, Tooltip, YAxis } from 'recharts';
import {
  CHART_MARGIN,
  TOOLTIP_STYLE,
  formatTooltipDate,
  getAltSeasonColor,
} from '../../tabs/marketIndicatorUtils';
import { MarketIndicatorPanelShell } from './MarketIndicatorPanelShell';

const REFRESH_MS = 5 * 60 * 1000;

export const AltcoinSeasonPanel = () => {
  const { t } = useTranslation();
  const { data, isLoading } = trpc.autoTrading.getAltcoinSeasonIndex.useQuery(
    undefined,
    { staleTime: REFRESH_MS, refetchInterval: REFRESH_MS },
  );

  const hasHistory = !!data?.history && data.history.length > 0;
  const color = getAltSeasonColor(data?.seasonType ?? '');
  const seasonLabel =
    data?.seasonType === 'ALT_SEASON' ? 'Alt Season' : data?.seasonType === 'BTC_SEASON' ? 'BTC Season' : 'Neutral';

  return (
    <MarketIndicatorPanelShell
      title={t('marketSidebar.indicators.altcoinSeason')}
      badges={
        data ? (
          <Flex align="center" gap={2} flexWrap="wrap">
            <Badge colorPalette={color} size="xs" px={2}>{seasonLabel}</Badge>
            <Badge colorPalette="gray" size="xs" px={2}>Index: {data.altSeasonIndex.toFixed(0)}%</Badge>
            {data.change24h !== null && (
              <Badge size="xs" px={2} colorPalette={data.change24h >= 0 ? 'green' : 'red'}>
                24h: {data.change24h >= 0 ? '+' : ''}{data.change24h.toFixed(1)}
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
            <linearGradient id="altSeasonGradientPanel" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={`var(--chakra-colors-${color}-500)`} stopOpacity={0.3} />
              <stop offset="95%" stopColor={`var(--chakra-colors-${color}-500)`} stopOpacity={0} />
            </linearGradient>
          </defs>
          <YAxis domain={[0, 100]} hide />
          <ReferenceLine y={50} stroke="var(--chakra-colors-gray-500)" strokeDasharray="3 3" strokeOpacity={0.5} />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            labelFormatter={formatTooltipDate}
            formatter={(value) => [`${(value as number).toFixed(0)}%`, 'Index']}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={`var(--chakra-colors-${color}-500)`}
            strokeWidth={2}
            fill="url(#altSeasonGradientPanel)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </MarketIndicatorPanelShell>
  );
};

export default AltcoinSeasonPanel;
