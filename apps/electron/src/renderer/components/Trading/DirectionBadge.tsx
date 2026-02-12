import { Box, Flex, Text } from '@chakra-ui/react';
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
      <Box px={2} py={0.5} bg="green.100" borderRadius="md" fontSize="xs" _dark={{ bg: 'green.900' }}>
        <Text fontWeight="medium" color="green.700" _dark={{ color: 'green.200' }}>
          LONG ONLY (SHORT blocked)
        </Text>
      </Box>
    );
  }

  if (directionMode === 'short_only') {
    return (
      <Box px={2} py={0.5} bg="red.100" borderRadius="md" fontSize="xs" _dark={{ bg: 'red.900' }}>
        <Text fontWeight="medium" color="red.700" _dark={{ color: 'red.200' }}>
          SHORT ONLY (LONG blocked)
        </Text>
      </Box>
    );
  }

  if (isIB || !showBtcTrend || !btcTrendStatus) return null;

  return (
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
  );
};
