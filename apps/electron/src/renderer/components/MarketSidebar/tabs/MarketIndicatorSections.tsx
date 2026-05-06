import { Badge, CryptoIcon, RecordRow, Skeleton } from '@renderer/components/ui';
import { Flex, Stack, Text } from '@chakra-ui/react';
import { useTranslation } from 'react-i18next';
import { LuArrowDown, LuArrowUp, LuMinus } from 'react-icons/lu';
import { MarketNoData } from './MarketNoData';
import {
  formatFundingRate,
  formatLargeNumber,
  getAdxColor,
  getAltSeasonColor,
  getOrderBookPressureColor,
  POPULAR_FUNDING_SYMBOLS,
} from './marketIndicatorUtils';
import { MiniAreaChart, SectionTitle } from './MarketIndicatorCharts';

interface AltcoinSeasonSectionProps {
  altcoinSeason: {
    seasonType: string;
    altSeasonIndex: number;
    change24h: number | null;
    history?: Array<Record<string, unknown>>;
    altsOutperformingBtc: number;
    totalAltsAnalyzed: number;
    btcPerformance24h: number;
    topPerformers: Array<{ symbol: string; performance: number }>;
  } | undefined;
  isLoading: boolean;
  hasWidth: boolean;
}

export const AltcoinSeasonSection = ({ altcoinSeason, isLoading, hasWidth }: AltcoinSeasonSectionProps) => {
  return (
    <RecordRow density="card">
      <SectionTitle>Altcoin Season Index</SectionTitle>
      {altcoinSeason && (
        <Flex align="center" gap={2} mb={2} flexWrap="wrap">
          <Badge colorPalette={getAltSeasonColor(altcoinSeason.seasonType)} size="xs" px={2}>
            {altcoinSeason.seasonType === 'ALT_SEASON' ? 'Alt Season' :
             altcoinSeason.seasonType === 'BTC_SEASON' ? 'BTC Season' : 'Neutral'}
          </Badge>
          <Badge colorPalette="gray" size="xs" px={2}>
            Index: {altcoinSeason.altSeasonIndex.toFixed(0)}%
          </Badge>
          {altcoinSeason.change24h !== null && (
            <Badge size="xs" px={2} colorPalette={altcoinSeason.change24h >= 0 ? 'green' : 'red'}>
              24h: {altcoinSeason.change24h >= 0 ? '+' : ''}{altcoinSeason.change24h.toFixed(1)}
            </Badge>
          )}
        </Flex>
      )}
      {isLoading || !hasWidth ? (
        <Skeleton height="60px" />
      ) : altcoinSeason?.history && altcoinSeason.history.length > 0 ? (
        <MiniAreaChart
          data={altcoinSeason.history}
          dataKey="value"
          color={`var(--chakra-colors-${getAltSeasonColor(altcoinSeason.seasonType)}-500)`}
          gradientId="altSeasonGradient"
          formatter={(v) => `${v.toFixed(0)}%`}
          label="Index"
          yDomain={[0, 100]}
          referenceLine={50}
        />
      ) : altcoinSeason ? (
        <>
          <Flex justify="space-between" fontSize="2xs" color="fg.muted">
            <Text>Alts {">"} BTC: {altcoinSeason.altsOutperformingBtc}/{altcoinSeason.totalAltsAnalyzed}</Text>
            <Text>BTC 24h: {altcoinSeason.btcPerformance24h >= 0 ? '+' : ''}{altcoinSeason.btcPerformance24h.toFixed(2)}%</Text>
          </Flex>
          {altcoinSeason.topPerformers.length > 0 && (
            <Text fontSize="2xs" color="fg.muted" mt={1}>
              Top: {altcoinSeason.topPerformers.slice(0, 3).map(p => `${p.symbol.replace('USDT', '')} +${p.performance.toFixed(1)}%`).join(', ')}
            </Text>
          )}
        </>
      ) : (
        <MarketNoData />
      )}
    </RecordRow>
  );
};

interface AdxSectionProps {
  adxTrendStrength: {
    adx: number | null;
    isChoppy: boolean;
    isStrongTrend: boolean;
    change24h: number | null;
    history?: Array<Record<string, unknown>>;
    plusDI: number | null;
    minusDI: number | null;
    isBullish: boolean;
    isBearish: boolean;
  } | undefined;
  isLoading: boolean;
  hasWidth: boolean;
}

export const AdxSection = ({ adxTrendStrength, isLoading, hasWidth }: AdxSectionProps) => {
  return (
    <RecordRow density="card">
      <SectionTitle>ADX Trend Strength (BTC)</SectionTitle>
      {adxTrendStrength && (
        <Flex align="center" gap={2} mb={2} flexWrap="wrap">
          <Badge colorPalette={getAdxColor(adxTrendStrength.adx)} size="xs" px={2}>
            ADX: {adxTrendStrength.adx?.toFixed(1) ?? 'N/A'}
          </Badge>
          {adxTrendStrength.isChoppy ? (
            <Badge colorPalette="red" size="xs" px={2}>Choppy Market</Badge>
          ) : adxTrendStrength.isStrongTrend ? (
            <Badge colorPalette="green" size="xs" px={2}>Strong Trend</Badge>
          ) : (
            <Badge colorPalette="yellow" size="xs" px={2}>Weak Trend</Badge>
          )}
          {adxTrendStrength.change24h !== null && (
            <Badge size="xs" px={2} colorPalette={adxTrendStrength.change24h >= 0 ? 'green' : 'red'}>
              24h: {adxTrendStrength.change24h >= 0 ? '+' : ''}{adxTrendStrength.change24h.toFixed(1)}
            </Badge>
          )}
        </Flex>
      )}
      {isLoading || !hasWidth ? (
        <Skeleton height="60px" />
      ) : adxTrendStrength?.history && adxTrendStrength.history.length > 0 ? (
        <MiniAreaChart
          data={adxTrendStrength.history}
          dataKey="value"
          color={`var(--chakra-colors-${getAdxColor(adxTrendStrength.adx)}-500)`}
          gradientId="adxGradient"
          formatter={(v) => v.toFixed(1)}
          label="ADX"
          yDomain={[0, 100]}
          referenceLine={20}
        />
      ) : adxTrendStrength ? (
        <Flex justify="space-between" fontSize="2xs" color="fg.muted">
          <Text>+DI: {adxTrendStrength.plusDI?.toFixed(1) ?? 'N/A'}</Text>
          <Text>-DI: {adxTrendStrength.minusDI?.toFixed(1) ?? 'N/A'}</Text>
          <Text>{adxTrendStrength.isBullish ? 'Bullish' : adxTrendStrength.isBearish ? 'Bearish' : 'Neutral'}</Text>
        </Flex>
      ) : (
        <MarketNoData />
      )}
    </RecordRow>
  );
};

interface OrderBookSectionProps {
  orderBook: {
    pressure: string;
    imbalanceRatio: number;
    bidVolume: number;
    askVolume: number;
    spreadPercent: number;
    bidWalls: unknown[];
    askWalls: unknown[];
  } | undefined;
  isLoading: boolean;
}

export const OrderBookSection = ({ orderBook, isLoading }: OrderBookSectionProps) => {
  return (
    <RecordRow density="card">
      <SectionTitle>Order Book (BTC)</SectionTitle>
      {isLoading ? (
        <Skeleton height="60px" />
      ) : orderBook ? (
        <>
          <Flex align="center" gap={2} mb={2} flexWrap="wrap">
            <Badge colorPalette={getOrderBookPressureColor(orderBook.pressure)} size="xs" px={2}>
              {orderBook.pressure === 'BUYING' ? 'Buying Pressure' :
               orderBook.pressure === 'SELLING' ? 'Selling Pressure' : 'Neutral'}
            </Badge>
            <Badge colorPalette="gray" size="xs" px={2}>
              Ratio: {orderBook.imbalanceRatio.toFixed(2)}
            </Badge>
          </Flex>
          <Flex justify="space-between" fontSize="2xs" color="fg.muted">
            <Text>Bids: ${formatLargeNumber(orderBook.bidVolume)}</Text>
            <Text>Asks: ${formatLargeNumber(orderBook.askVolume)}</Text>
            <Text>Spread: {orderBook.spreadPercent.toFixed(4)}%</Text>
          </Flex>
          {(orderBook.bidWalls.length > 0 || orderBook.askWalls.length > 0) && (
            <Text fontSize="2xs" color="fg.muted" mt={1}>
              Walls: {orderBook.bidWalls.length} bid / {orderBook.askWalls.length} ask
            </Text>
          )}
        </>
      ) : (
        <MarketNoData />
      )}
    </RecordRow>
  );
};

interface FundingRatesSectionProps {
  fundingRates: Array<{ symbol: string; rate: number | null; isExtreme: boolean }> | undefined;
  isLoading: boolean;
}

export const FundingRatesSection = ({ fundingRates, isLoading }: FundingRatesSectionProps) => {
  const { t } = useTranslation();
  return (
    <RecordRow density="card">
      <SectionTitle>{t('marketSidebar.indicators.fundingRates')}</SectionTitle>
      {isLoading ? (
        <Stack gap={2}>
          {POPULAR_FUNDING_SYMBOLS.map((symbol) => (
            <Skeleton key={symbol} height="28px" />
          ))}
        </Stack>
      ) : fundingRates && fundingRates.length > 0 ? (
        <Stack gap={2}>
          {fundingRates.map((fr) => {
            const isPositive = fr.rate !== null && fr.rate > 0;
            const isNegative = fr.rate !== null && fr.rate < 0;
            const RateIcon = isPositive ? LuArrowUp : isNegative ? LuArrowDown : LuMinus;
            const rateColor = isPositive ? 'green' : isNegative ? 'red' : 'gray';

            return (
              <Flex key={fr.symbol} justify="space-between" align="center" py={1}>
                <Flex align="center" gap={2}>
                  <CryptoIcon symbol={fr.symbol} size={16} />
                  <Text fontSize="xs" fontWeight="medium">
                    {fr.symbol.replace('USDT', '')}
                  </Text>
                </Flex>
                <Flex align="center" gap={1}>
                  {fr.isExtreme && (
                    <Badge colorPalette="orange" size="xs" px={2} mr={1}>!</Badge>
                  )}
                  <RateIcon size={12} color={`var(--chakra-colors-${rateColor}-500)`} />
                  <Text
                    fontSize="xs"
                    fontWeight="medium"
                    color={`${rateColor}.fg`}
                  >
                    {formatFundingRate(fr.rate)}
                  </Text>
                </Flex>
              </Flex>
            );
          })}
        </Stack>
      ) : (
        <MarketNoData />
      )}
      <Text fontSize="2xs" color="fg.muted" mt={2}>
        Positive = longs pay shorts | Negative = shorts pay longs
      </Text>
    </RecordRow>
  );
};
