import { Box, VStack, HStack, Text } from '@chakra-ui/react';
import type { DepthLevel } from '@marketmind/types';
import { memo, useEffect, useRef } from 'react';

interface DomLadderProps {
  bids: DepthLevel[];
  asks: DepthLevel[];
  currentPrice: number;
  onPriceClick?: (price: number) => void;
}

const LEVEL_HEIGHT = 20;

export const DomLadder = memo(({ bids, asks, currentPrice, onPriceClick }: DomLadderProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const visibleAsks = asks;
  const visibleBids = bids;
  const maxQty = Math.max(
    ...visibleBids.map((b) => b.quantity),
    ...visibleAsks.map((a) => a.quantity),
    1,
  );

  useEffect(() => {
    if (containerRef.current) {
      const midIndex = visibleAsks.length;
      const containerHeight = containerRef.current.clientHeight;
      const scrollTo = midIndex * LEVEL_HEIGHT - containerHeight / 2;
      containerRef.current.scrollTop = Math.max(0, scrollTo);
    }
  }, [currentPrice, visibleAsks.length]);

  return (
    <Box
      ref={containerRef}
      overflow="auto"
      flex={1}
      minH={0}
      width="100%"
      fontSize="xs"
      fontFamily="mono"
    >
      <VStack gap={0}>
        {[...visibleAsks].reverse().map((level, i) => (
          <HStack
            key={`ask-${i}`}
            width="100%"
            height={`${LEVEL_HEIGHT}px`}
            position="relative"
            cursor="pointer"
            onClick={() => onPriceClick?.(level.price)}
            _hover={{ bg: 'bg.subtle' }}
          >
            <Box
              position="absolute"
              right={0}
              top={0}
              bottom={0}
              bg="red.500/20"
              width={`${(level.quantity / maxQty) * 100}%`}
            />
            <Text flex={1} textAlign="right" px={1} zIndex={1} color="fg.error">
              {level.price.toFixed(2)}
            </Text>
            <Text width="60px" textAlign="right" px={1} zIndex={1}>
              {formatQty(level.quantity)}
            </Text>
          </HStack>
        ))}

        <HStack
          width="100%"
          height={`${LEVEL_HEIGHT + 4}px`}
          bg="bg.emphasized"
          borderY="1px solid"
          borderColor="border.default"
        >
          <Text flex={1} textAlign="center" fontWeight="bold" color={currentPrice > 0 ? 'fg.default' : 'fg.muted'}>
            {currentPrice > 0 ? currentPrice.toFixed(2) : '—'}
          </Text>
        </HStack>

        {visibleBids.map((level, i) => (
          <HStack
            key={`bid-${i}`}
            width="100%"
            height={`${LEVEL_HEIGHT}px`}
            position="relative"
            cursor="pointer"
            onClick={() => onPriceClick?.(level.price)}
            _hover={{ bg: 'bg.subtle' }}
          >
            <Box
              position="absolute"
              right={0}
              top={0}
              bottom={0}
              bg="green.500/20"
              width={`${(level.quantity / maxQty) * 100}%`}
            />
            <Text flex={1} textAlign="right" px={1} zIndex={1} color="fg.success">
              {level.price.toFixed(2)}
            </Text>
            <Text width="60px" textAlign="right" px={1} zIndex={1}>
              {formatQty(level.quantity)}
            </Text>
          </HStack>
        ))}
      </VStack>
    </Box>
  );
});

const formatQty = (qty: number): string => {
  if (qty >= 1000) return `${(qty / 1000).toFixed(1)}k`;
  if (qty >= 1) return qty.toFixed(2);
  return qty.toFixed(4);
};
