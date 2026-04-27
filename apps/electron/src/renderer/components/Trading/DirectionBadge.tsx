import { Flex } from '@chakra-ui/react';
import { Badge } from '@renderer/components/ui';
import type { DirectionMode } from '@renderer/components/Trading/WatcherManager/WatchersList';
import type { BtcTrendStatus } from '@renderer/components/Trading/WatcherManager/QuickStartSection';

interface DirectionBadgeProps {
  directionMode: DirectionMode;
  btcTrendStatus?: BtcTrendStatus;
  showBtcTrend: boolean;
  skippedTrendCount?: number;
  isIB?: boolean;
}

export const DirectionBadge = ({
  directionMode,
  btcTrendStatus,
  showBtcTrend,
  skippedTrendCount = 0,
  isIB,
}: DirectionBadgeProps) => {
  if (directionMode === 'long_only') {
    return (
      <Badge colorPalette="green" size="sm">
        LONG ONLY (SHORT blocked)
      </Badge>
    );
  }

  if (directionMode === 'short_only') {
    return (
      <Badge colorPalette="red" size="sm">
        SHORT ONLY (LONG blocked)
      </Badge>
    );
  }

  if (isIB || !showBtcTrend || !btcTrendStatus) return null;

  const trendPalette =
    btcTrendStatus.trend === 'BULLISH' ? 'green'
      : btcTrendStatus.trend === 'BEARISH' ? 'red'
      : 'gray';

  return (
    <Flex gap={2} align="center">
      <Badge colorPalette={trendPalette} size="sm">
        BTC: {btcTrendStatus.trend}
        {!btcTrendStatus.canLong && ' (LONG blocked)'}
        {!btcTrendStatus.canShort && ' (SHORT blocked)'}
      </Badge>
      {skippedTrendCount > 0 && (
        <Badge colorPalette="orange" size="sm">
          {skippedTrendCount} filtered
        </Badge>
      )}
    </Flex>
  );
};
