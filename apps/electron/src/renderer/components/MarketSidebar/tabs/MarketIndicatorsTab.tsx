import { Badge } from '@renderer/components/ui';
import { Flex, Stack, Text } from '@chakra-ui/react';
import { trpc } from '@renderer/utils/trpc';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BtcDominanceSection,
  FearGreedSection,
  LongShortSection,
  MvrvSection,
  OpenInterestSection,
  ProductionCostSection,
} from './MarketIndicatorCharts';
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

const MarketIndicatorsTabComponent = () => {
  const { t } = useTranslation();
  const { ref: containerRef, hasWidth } = useContainerWidth();

  const { data: watcherInterval } = trpc.autoTrading.getMinActiveWatcherInterval.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  const halfIntervalMs = watcherInterval?.halfIntervalMs ?? DEFAULT_HALF_INTERVAL;
  const REFRESH_INTERVALS = getRefreshIntervals(halfIntervalMs);

  const { data: fundingRates, isLoading: isFundingLoading } = trpc.autoTrading.getBatchFundingRates.useQuery(
    { symbols: POPULAR_FUNDING_SYMBOLS },
    { staleTime: REFRESH_INTERVALS.fundingRates, refetchInterval: REFRESH_INTERVALS.fundingRates }
  );

  const { data: fearGreed, isLoading: isFearGreedLoading } = trpc.autoTrading.getFearGreedIndex.useQuery(
    undefined,
    { staleTime: REFRESH_INTERVALS.fearGreed, refetchInterval: REFRESH_INTERVALS.fearGreed }
  );

  const { data: btcDominance, isLoading: isBtcDominanceLoading } = trpc.autoTrading.getBtcDominance.useQuery(
    undefined,
    { staleTime: REFRESH_INTERVALS.btcDominance, refetchInterval: REFRESH_INTERVALS.btcDominance }
  );

  const { data: mvrv, isLoading: isMvrvLoading } = trpc.autoTrading.getMvrvRatio.useQuery(
    undefined,
    { staleTime: REFRESH_INTERVALS.onChain, refetchInterval: REFRESH_INTERVALS.onChain }
  );

  const { data: btcProductionCost, isLoading: isProductionCostLoading } = trpc.autoTrading.getBtcProductionCost.useQuery(
    undefined,
    { staleTime: REFRESH_INTERVALS.onChain, refetchInterval: REFRESH_INTERVALS.onChain }
  );

  const { data: openInterest, isLoading: isOpenInterestLoading } = trpc.autoTrading.getOpenInterest.useQuery(
    { symbol: 'BTCUSDT' },
    { staleTime: REFRESH_INTERVALS.openInterest, refetchInterval: REFRESH_INTERVALS.openInterest }
  );

  const { data: longShortRatio, isLoading: isLongShortLoading } = trpc.autoTrading.getLongShortRatio.useQuery(
    { symbol: 'BTCUSDT', period: '1h' },
    { staleTime: REFRESH_INTERVALS.longShortRatio, refetchInterval: REFRESH_INTERVALS.longShortRatio }
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

      <FearGreedSection fearGreed={fearGreed} isLoading={isFearGreedLoading} hasWidth={hasWidth} />
      <BtcDominanceSection btcDominance={btcDominance} isLoading={isBtcDominanceLoading} hasWidth={hasWidth} />
      <MvrvSection mvrv={mvrv} isLoading={isMvrvLoading} hasWidth={hasWidth} />
      <ProductionCostSection btcProductionCost={btcProductionCost} isLoading={isProductionCostLoading} hasWidth={hasWidth} />
      <OpenInterestSection openInterest={openInterest} isLoading={isOpenInterestLoading} hasWidth={hasWidth} />
      <LongShortSection longShortRatio={longShortRatio} isLoading={isLongShortLoading} hasWidth={hasWidth} />
      <AltcoinSeasonSection altcoinSeason={altcoinSeason} isLoading={isAltcoinSeasonLoading} hasWidth={hasWidth} />
      <AdxSection adxTrendStrength={adxTrendStrength} isLoading={isAdxLoading} hasWidth={hasWidth} />
      <OrderBookSection orderBook={orderBook} isLoading={isOrderBookLoading} />
      <FundingRatesSection fundingRates={fundingRates} isLoading={isFundingLoading} />
    </Stack>
  );
};

export const MarketIndicatorsTab = memo(MarketIndicatorsTabComponent);
