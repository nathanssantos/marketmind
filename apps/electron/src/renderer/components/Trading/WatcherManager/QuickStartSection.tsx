import { Box, Flex, Group, Stack, Text } from '@chakra-ui/react';
import type { MarketType, TimeInterval } from '@marketmind/types';
import { AUTO_TRADING_CONFIG } from '@marketmind/types';
import { Button, NumberInput } from '@renderer/components/ui';
import { TimeframeSelector } from '@renderer/components/Chart/TimeframeSelector';
import type { DirectionMode } from '@renderer/components/Trading/WatcherManager/WatchersList';
import { DirectionBadge } from '@renderer/components/Trading/DirectionBadge';
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
  directionMode?: DirectionMode;
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
  directionMode = 'auto',
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
    <Box p={3} bg="green.subtle" borderRadius="md" borderWidth="1px" borderColor="green.muted">
      <Flex justify="space-between" align="center" mb={3}>
        <Text fontSize="sm" fontWeight="medium">
          {t('tradingProfiles.dynamicSelection.quickStartTitle')}
        </Text>
        <DirectionBadge
          directionMode={directionMode}
          btcTrendStatus={btcTrendStatus}
          showBtcTrend={showBtcTrend}
          skippedTrendCount={skippedTrendCount}
          isIB={isIB}
        />
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
