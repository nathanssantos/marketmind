import { Badge } from '@renderer/components/ui';
import { Flex, Stack, Text } from '@chakra-ui/react';
import { trpc } from '@renderer/utils/trpc';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AdxSection,
  AltcoinSeasonSection,
  FundingRatesSection,
  OrderBookSection,
} from './MarketIndicatorSections';
import {
  DEFAULT_HALF_INTERVAL,
  getRefreshIntervals,
  POPULAR_FUNDING_SYMBOLS,
  useContainerWidth,
} from './marketIndicatorUtils';

/**
 * Aggregate "Market Indicators" panel — surfaces the indicators that
 * don't (yet) have their own grid panel: Altcoin Season, ADX, Order
 * Book, Funding Rates. The 6 chart-driven indicators (Fear & Greed,
 * BTC Dominance, MVRV, BTC Production Cost, Open Interest, Long/Short
 * Ratio) are now individual `marketX` panels — see
 * `panels/individual/*Panel.tsx` and `grid/panel-registry.ts`. Older
 * stored layouts that still include this aggregate panel keep working;
 * they just see a smaller list now.
 */
const MarketIndicatorsTabComponent = () => {
  const { t } = useTranslation();
  const { ref: containerRef, hasWidth } = useContainerWidth();

  // The minimum watcher interval only changes when the user starts /
  // stops a watcher (mutation invalidates via auto-trading hooks).
  // Polling here was wasted bandwidth — the value never drifts on its
  // own. Long staleTime + no periodic refetch.
  const { data: watcherInterval } = trpc.autoTrading.getMinActiveWatcherInterval.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
  });

  const halfIntervalMs = watcherInterval?.halfIntervalMs ?? DEFAULT_HALF_INTERVAL;
  const REFRESH_INTERVALS = getRefreshIntervals(halfIntervalMs);

  // Funding rates / ADX / order-book analysis are backend computations;
  // altcoin season is an external API (alternative.me / glassnode).
  // None has a socket counterpart yet — keep polling at the slower
  // refresh cadence (≥5 minutes typically).
  const { data: fundingRates, isLoading: isFundingLoading } = trpc.autoTrading.getBatchFundingRates.useQuery(
    { symbols: POPULAR_FUNDING_SYMBOLS },
    { staleTime: REFRESH_INTERVALS.fundingRates, refetchInterval: REFRESH_INTERVALS.fundingRates }
  );

  const { data: altcoinSeason, isLoading: isAltcoinSeasonLoading } = trpc.autoTrading.getAltcoinSeasonIndex.useQuery(
    undefined,
    { staleTime: REFRESH_INTERVALS.altcoinSeason, refetchInterval: REFRESH_INTERVALS.altcoinSeason }
  );

  const { data: adxTrendStrength, isLoading: isAdxLoading } = trpc.autoTrading.getBtcAdxTrendStrength.useQuery(
    { interval: '12h' },
    { staleTime: REFRESH_INTERVALS.adxTrendStrength, refetchInterval: REFRESH_INTERVALS.adxTrendStrength }
  );

  const { data: orderBook, isLoading: isOrderBookLoading } = trpc.autoTrading.getOrderBookAnalysis.useQuery(
    { symbol: 'BTCUSDT', marketType: 'FUTURES' },
    { staleTime: REFRESH_INTERVALS.orderBook, refetchInterval: REFRESH_INTERVALS.orderBook }
  );

  return (
    <Stack gap={3} p={4} ref={containerRef}>
      <Flex align="center" gap={2}>
        <Text fontSize="sm" fontWeight="bold">
          {t('marketSidebar.indicators.title')}
        </Text>
        <Badge size="xs" variant="outline" colorPalette="gray">31d</Badge>
      </Flex>

      <AltcoinSeasonSection altcoinSeason={altcoinSeason} isLoading={isAltcoinSeasonLoading} hasWidth={hasWidth} />
      <AdxSection adxTrendStrength={adxTrendStrength} isLoading={isAdxLoading} hasWidth={hasWidth} />
      <OrderBookSection orderBook={orderBook} isLoading={isOrderBookLoading} />
      <FundingRatesSection fundingRates={fundingRates} isLoading={isFundingLoading} />
    </Stack>
  );
};

export const MarketIndicatorsTab = memo(MarketIndicatorsTabComponent);
