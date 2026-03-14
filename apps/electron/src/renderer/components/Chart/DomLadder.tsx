import { Box, VStack, HStack, Text } from '@chakra-ui/react';
import type { DepthLevel } from '@marketmind/types';
import { useEffect, useRef } from 'react';

interface DomLadderProps {
  bids: DepthLevel[];
  asks: DepthLevel[];
  currentPrice: number;
  onPriceClick?: (price: number) => void;
  height?: number;
}

const LEVEL_HEIGHT = 20;

export function DomLadder({ bids, asks, currentPrice, onPriceClick, height = 400 }: DomLadderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const maxQty = Math.max(
    ...bids.map((b) => b.quantity),
    ...asks.map((a) => a.quantity),
    1,
  );

  useEffect(() => {
    if (containerRef.current) {
      const midIndex = asks.length;
      const scrollTo = midIndex * LEVEL_HEIGHT - height / 2;
      containerRef.current.scrollTop = Math.max(0, scrollTo);
    }
  }, [currentPrice, asks.length, height]);

  return (
    <Box
      ref={containerRef}
      overflow="auto"
      height={`${height}px`}
      width="160px"
      borderLeft="1px solid"
      borderColor="border.muted"
      fontSize="xs"
      fontFamily="mono"
    >
      <VStack gap={0}>
        {[...asks].reverse().map((level, i) => (
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
          <Text flex={1} textAlign="center" fontWeight="bold" color="fg.default">
            {currentPrice.toFixed(2)}
          </Text>
        </HStack>

        {bids.map((level, i) => (
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
}

const formatQty = (qty: number): string => {
  if (qty >= 1000) return `${(qty / 1000).toFixed(1)}k`;
  if (qty >= 1) return qty.toFixed(2);
  return qty.toFixed(4);
};
