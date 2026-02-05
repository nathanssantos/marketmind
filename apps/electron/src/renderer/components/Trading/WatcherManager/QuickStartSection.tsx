import { Box, Flex, Group, Stack, Text } from '@chakra-ui/react';
import type { MarketType, TimeInterval } from '@marketmind/types';
import { AUTO_TRADING_CONFIG } from '@marketmind/types';
import { Button } from '@renderer/components/ui/button';
import { NumberInput } from '@renderer/components/ui/number-input';
import { TimeframeSelector } from '@renderer/components/Chart/TimeframeSelector';
import { useTranslation } from 'react-i18next';
import { LuPlay } from 'react-icons/lu';

export interface BtcTrendStatus {
  trend: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  canLong: boolean;
  canShort: boolean;
  btcPrice?: number | null;
  btcEma21?: number | null;
}

export interface BtcTrendInfo {
  direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  isClearTrend: boolean;
  adx: number;
  strength: number;
  rsi: number;
}

export interface QuickStartSectionProps {
  isIB?: boolean;
  marketType: MarketType;
  timeframe: TimeInterval;
  count: number;
  effectiveMax: number;
  isLoadingMax: boolean;
  filteredSymbolsCount: number;
  isLoadingFiltered: boolean;
  isStarting: boolean;
  btcTrendStatus?: BtcTrendStatus;
  btcTrendInfo?: BtcTrendInfo | null;
  skippedTrendCount?: number;
  showBtcTrend: boolean;
  formatCapitalTooltip: () => string;
  onMarketTypeChange: (type: MarketType) => void;
  onTimeframeChange: (timeframe: TimeInterval) => void;
  onCountChange: (count: number) => void;
  onQuickStart: () => void;
}

export const QuickStartSection = ({
  isIB,
  marketType,
  timeframe,
  count,
  effectiveMax,
  isLoadingMax,
  filteredSymbolsCount,
  isLoadingFiltered,
  isStarting,
  btcTrendStatus,
  btcTrendInfo: _btcTrendInfo,
  skippedTrendCount = 0,
  showBtcTrend,
  formatCapitalTooltip,
  onMarketTypeChange,
  onTimeframeChange,
  onCountChange,
  onQuickStart,
}: QuickStartSectionProps) => {
  const { t } = useTranslation();

  return (
    <Box p={4} bg="green.50" borderRadius="md" borderWidth="1px" borderColor="green.200" _dark={{ bg: 'green.900/20', borderColor: 'green.800' }}>
      <Flex justify="space-between" align="center" mb={3}>
        <Text fontSize="sm" fontWeight="medium">
          {t('tradingProfiles.dynamicSelection.quickStartTitle')}
        </Text>
        {!isIB && showBtcTrend && btcTrendStatus && (
          <Flex gap={2} align="center">
            <Box
              px={2}
              py={0.5}
              bg={
                btcTrendStatus.trend === 'BULLISH'
                  ? 'green.100'
                  : btcTrendStatus.trend === 'BEARISH'
                    ? 'red.100'
                    : 'gray.100'
              }
              borderRadius="md"
              fontSize="xs"
              _dark={{
                bg:
                  btcTrendStatus.trend === 'BULLISH'
                    ? 'green.900'
                    : btcTrendStatus.trend === 'BEARISH'
                      ? 'red.900'
                      : 'gray.700',
              }}
            >
              <Text
                fontWeight="medium"
                color={
                  btcTrendStatus.trend === 'BULLISH'
                    ? 'green.700'
                    : btcTrendStatus.trend === 'BEARISH'
                      ? 'red.700'
                      : 'gray.600'
                }
                _dark={{
                  color:
                    btcTrendStatus.trend === 'BULLISH'
                      ? 'green.200'
                      : btcTrendStatus.trend === 'BEARISH'
                        ? 'red.200'
                        : 'gray.300',
                }}
              >
                BTC: {btcTrendStatus.trend}
                {!btcTrendStatus.canLong && ' (LONG blocked)'}
                {!btcTrendStatus.canShort && ' (SHORT blocked)'}
              </Text>
            </Box>
            {skippedTrendCount > 0 && (
              <Box px={2} py={0.5} bg="orange.100" borderRadius="md" fontSize="xs" _dark={{ bg: 'orange.900' }}>
                <Text fontWeight="medium" color="orange.700" _dark={{ color: 'orange.200' }}>
                  {skippedTrendCount} filtered
                </Text>
              </Box>
            )}
          </Flex>
        )}
      </Flex>
      <Stack gap={3}>
        <Flex gap={3} align="center">
          {!isIB && (
            <Group attached flex="0 0 180px">
              <Button
                size="sm"
                variant={marketType === 'SPOT' ? 'solid' : 'outline'}
                onClick={() => onMarketTypeChange('SPOT')}
                flex={1}
              >
                Spot
              </Button>
              <Button
                size="sm"
                variant={marketType === 'FUTURES' ? 'solid' : 'outline'}
                onClick={() => onMarketTypeChange('FUTURES')}
                flex={1}
              >
                Futures
              </Button>
            </Group>
          )}
          <Box>
            <TimeframeSelector
              selectedTimeframe={timeframe}
              onTimeframeChange={onTimeframeChange}
            />
          </Box>
          <Flex align="center" gap={2}>
            <Box flex="0 0 70px">
              <NumberInput
                min={AUTO_TRADING_CONFIG.TARGET_COUNT.MIN}
                max={effectiveMax}
                value={count}
                onChange={(e) => onCountChange(parseInt(e.target.value, 10) || 1)}
                size="sm"
                px={3}
              />
            </Box>
            <Text fontSize="xs" color="fg.muted" whiteSpace="nowrap" title={formatCapitalTooltip()}>
              / {isLoadingMax ? '...' : effectiveMax} max
            </Text>
          </Flex>
          <Text fontSize="sm" color="fg.muted" flex={1}>
            {effectiveMax === 0
              ? t('tradingProfiles.dynamicSelection.insufficientCapital')
              : t('tradingProfiles.dynamicSelection.quickStartDescription')}
          </Text>
          <Button
            size="sm"
            colorPalette="green"
            onClick={onQuickStart}
            loading={isStarting}
            disabled={isLoadingFiltered || filteredSymbolsCount === 0 || effectiveMax === 0}
          >
            <LuPlay />
            {t('tradingProfiles.dynamicSelection.quickStartButton', { count: Math.min(count, effectiveMax) })}
          </Button>
        </Flex>
      </Stack>
    </Box>
  );
};
