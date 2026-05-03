import { Box } from '@chakra-ui/react';
import { QuickTradeActions } from '@renderer/components/Layout/QuickTradeToolbar';
import { useLayoutStore } from '@renderer/store/layoutStore';

export const TicketPanel = () => {
  const symbol = useLayoutStore((s) => s.getActiveTab()?.symbol ?? 'BTCUSDT');
  const marketType = useLayoutStore((s) => s.getActiveTab()?.marketType ?? 'FUTURES');

  return (
    <Box h="100%" overflowY="auto" p={1.5}>
      <QuickTradeActions symbol={symbol} marketType={marketType} />
    </Box>
  );
};

export default TicketPanel;
