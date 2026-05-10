import { Box } from '@chakra-ui/react';
import { TradeTicketActions } from '@renderer/components/Layout/TradeTicket';
import { useLayoutStore } from '@renderer/store/layoutStore';

export const TicketPanel = () => {
  const symbol = useLayoutStore((s) => s.getActiveTab()?.symbol ?? 'BTCUSDT');
  const marketType = useLayoutStore((s) => s.getActiveTab()?.marketType ?? 'FUTURES');

  return (
    <Box h="100%" overflowY="auto" p={1.5}>
      <TradeTicketActions symbol={symbol} marketType={marketType} />
    </Box>
  );
};

export default TicketPanel;
