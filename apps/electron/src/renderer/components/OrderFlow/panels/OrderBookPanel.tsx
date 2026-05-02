import { Box } from '@chakra-ui/react';
import { DomLadder } from '@renderer/components/Chart/DomLadder';
import { useDepth } from '@renderer/hooks/useDepth';
import { useFastPriceForSymbol } from '@renderer/store/priceStore';
import { useLayoutStore } from '@renderer/store/layoutStore';

export const OrderBookPanel = () => {
  const symbol = useLayoutStore((s) => s.getActiveTab()?.symbol ?? 'BTCUSDT');
  const { bids, asks } = useDepth(symbol);
  const currentPrice = useFastPriceForSymbol(symbol) ?? 0;

  return (
    <Box h="100%" display="flex" flexDirection="column" minH={0}>
      <DomLadder bids={bids} asks={asks} currentPrice={currentPrice} />
    </Box>
  );
};

export default OrderBookPanel;
