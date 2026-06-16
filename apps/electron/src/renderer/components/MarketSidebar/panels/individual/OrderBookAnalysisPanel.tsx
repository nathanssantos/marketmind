import { Box, Flex, Stack, Text } from '@chakra-ui/react';
import { Badge } from '@renderer/components/ui';
import { trpc } from '@renderer/utils/trpc';
import { useTranslation } from 'react-i18next';
import { formatLargeNumber, getOrderBookPressureColor } from '../../tabs/marketIndicatorUtils';
import { MarketIndicatorPanelShell } from './MarketIndicatorPanelShell';

const REFRESH_MS = 60 * 1000;

const pressureLabel = (pressure: string): string =>
  pressure === 'BUYING' ? 'Buying Pressure' : pressure === 'SELLING' ? 'Selling Pressure' : 'Neutral';

export const OrderBookAnalysisPanel = () => {
  const { t } = useTranslation();
  const { data, isLoading } = trpc.autoTrading.getOrderBookAnalysis.useQuery(
    { symbol: 'BTCUSDT', marketType: 'FUTURES' },
    { staleTime: REFRESH_MS, refetchInterval: REFRESH_MS },
  );

  const bidVolume = data?.bidVolume ?? 0;
  const askVolume = data?.askVolume ?? 0;

  return (
    <MarketIndicatorPanelShell
      title={t('marketSidebar.indicators.orderBookPressure')}
      badges={
        data ? (
          <Flex align="center" gap={2} flexWrap="wrap">
            <Badge colorPalette={getOrderBookPressureColor(data.pressure)} size="xs" px={2}>
              {pressureLabel(data.pressure)}
            </Badge>
            <Badge colorPalette="gray" size="xs" px={2}>Ratio: {data.imbalanceRatio.toFixed(2)}</Badge>
          </Flex>
        ) : undefined
      }
      isLoading={isLoading}
      hasData={!!data}
    >
      <Stack h="100%" gap={3} justify="center">
        <Box>
          <Flex justify="space-between" fontSize="2xs" color="fg.muted" mb={1}>
            <Text>Bids ${formatLargeNumber(bidVolume)}</Text>
            <Text>Asks ${formatLargeNumber(askVolume)}</Text>
          </Flex>
          <Flex h="8px" borderRadius="full" overflow="hidden" bg="bg.muted">
            <Box flexGrow={bidVolume || 1} bg="trading.profit" />
            <Box flexGrow={askVolume || 1} bg="trading.loss" />
          </Flex>
        </Box>
        <Flex justify="space-between" fontSize="xs">
          <Text color="fg.muted">Spread</Text>
          <Text fontFamily="mono">{(data?.spreadPercent ?? 0).toFixed(4)}%</Text>
        </Flex>
        {data && (data.bidWalls.length > 0 || data.askWalls.length > 0) && (
          <Flex justify="space-between" fontSize="xs">
            <Text color="fg.muted">Walls</Text>
            <Text fontFamily="mono">{data.bidWalls.length} bid / {data.askWalls.length} ask</Text>
          </Flex>
        )}
      </Stack>
    </MarketIndicatorPanelShell>
  );
};

export default OrderBookAnalysisPanel;
