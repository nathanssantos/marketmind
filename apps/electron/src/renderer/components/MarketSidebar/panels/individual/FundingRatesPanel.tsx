import { Box, Flex, Stack, Text } from '@chakra-ui/react';
import { Badge, CryptoIcon } from '@renderer/components/ui';
import { trpc } from '@renderer/utils/trpc';
import { useTranslation } from 'react-i18next';
import {
  formatFundingRate,
  POPULAR_FUNDING_SYMBOLS,
} from '../../tabs/marketIndicatorUtils';
import { MarketIndicatorPanelShell } from './MarketIndicatorPanelShell';

const REFRESH_MS = 5 * 60 * 1000;

const rateTone = (rate: number | null): string =>
  rate !== null && rate > 0 ? 'trading.profit' : rate !== null && rate < 0 ? 'trading.loss' : 'fg.muted';

export const FundingRatesPanel = () => {
  const { t } = useTranslation();
  const { data, isLoading } = trpc.autoTrading.getBatchFundingRates.useQuery(
    { symbols: POPULAR_FUNDING_SYMBOLS },
    { staleTime: REFRESH_MS, refetchInterval: REFRESH_MS },
  );

  const rates = data ?? [];
  const maxAbs = Math.max(...rates.map((r) => Math.abs(r.rate ?? 0)), Number.EPSILON);

  return (
    <MarketIndicatorPanelShell
      title={t('marketSidebar.indicators.fundingRates')}
      isLoading={isLoading}
      hasData={rates.length > 0}
    >
      <Stack h="100%" gap={2} justify="center">
        {rates.map((fr) => {
          const rate = fr.rate ?? 0;
          const tone = rateTone(fr.rate);
          const widthPct = Math.min(100, (Math.abs(rate) / maxAbs) * 100);
          return (
            <Flex key={fr.symbol} align="center" gap={2}>
              <CryptoIcon symbol={fr.symbol} size={16} />
              <Text w="44px" fontSize="xs" fontWeight="medium" flexShrink={0}>
                {fr.symbol.replace('USDT', '')}
              </Text>
              <Box flex={1} h="6px" bg="bg.muted" borderRadius="full" overflow="hidden">
                <Box h="100%" w={`${widthPct}%`} bg={tone} />
              </Box>
              {fr.isExtreme && <Badge colorPalette="orange" size="xs" px={2}>!</Badge>}
              <Text w="68px" textAlign="right" fontSize="xs" fontWeight="medium" fontFamily="mono" color={tone} flexShrink={0}>
                {formatFundingRate(fr.rate)}
              </Text>
            </Flex>
          );
        })}
      </Stack>
    </MarketIndicatorPanelShell>
  );
};

export default FundingRatesPanel;
