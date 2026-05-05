import { Flex } from '@chakra-ui/react';
import { Badge } from '@renderer/components/ui';
import { trpc } from '@renderer/utils/trpc';
import { useTranslation } from 'react-i18next';
import { Line, LineChart, ResponsiveContainer, Tooltip } from 'recharts';
import {
  CHART_MARGIN,
  TOOLTIP_STYLE,
  formatTooltipDate,
  formatUsd,
} from '../../tabs/marketIndicatorUtils';
import { MarketIndicatorPanelShell } from './MarketIndicatorPanelShell';

const REFRESH_MS = 60 * 60 * 1000;

export const ProductionCostPanel = () => {
  const { t } = useTranslation();
  const { data, isLoading } = trpc.autoTrading.getBtcProductionCost.useQuery(
    undefined,
    { staleTime: REFRESH_MS, refetchInterval: REFRESH_MS },
  );

  const currentCost = data?.currentCost;
  const currentPrice = data?.currentPrice;
  const hasMetric = currentCost !== null && currentCost !== undefined
    && currentPrice !== null && currentPrice !== undefined;
  const hasHistory = !!data?.history && data.history.length > 0;
  const aboveCost = hasMetric && currentPrice >= currentCost;

  return (
    <MarketIndicatorPanelShell
      title={t('marketSidebar.indicators.btcProductionCost')}
      badges={
        hasMetric ? (
          <Flex align="center" gap={2} flexWrap="wrap">
            <Badge colorPalette="orange" size="xs" px={2}>Cost: {formatUsd(currentCost)}</Badge>
            <Badge colorPalette="blue" size="xs" px={2}>Price: {formatUsd(currentPrice)}</Badge>
            <Badge colorPalette={aboveCost ? 'green' : 'red'} size="xs" px={2}>
              {aboveCost ? 'Above Cost' : 'Below Cost'}
            </Badge>
          </Flex>
        ) : undefined
      }
      isLoading={isLoading}
      hasData={hasHistory}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data?.history ?? []} margin={CHART_MARGIN}>
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            labelFormatter={formatTooltipDate}
            formatter={(value) => [formatUsd(value as number), '']}
          />
          <Line type="monotone" dataKey="productionCost" stroke="var(--chakra-colors-orange-500)" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="btcPrice" stroke="var(--chakra-colors-blue-500)" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </MarketIndicatorPanelShell>
  );
};

export default ProductionCostPanel;
