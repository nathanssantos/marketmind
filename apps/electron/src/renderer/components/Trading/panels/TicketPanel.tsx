import { Box } from '@chakra-ui/react';
import { UnavailableForIndex } from '@renderer/components/ui';
import { TradeTicketActions } from '@renderer/components/Layout/TradeTicket';
import { useIsCustomSymbol } from '@renderer/hooks/useIsCustomSymbol';
import { useLayoutStore } from '@renderer/store/layoutStore';

export const TicketPanel = () => {
  const symbol = useLayoutStore((s) => s.getActiveTab()?.symbol ?? 'BTCUSDT');
  const marketType = useLayoutStore((s) => s.getActiveTab()?.marketType ?? 'FUTURES');
  const isCustomSymbol = useIsCustomSymbol(symbol);

  return (
    <Box h="100%" overflowY="auto" p={1.5}>
      <UnavailableForIndex active={isCustomSymbol}>
        <TradeTicketActions symbol={symbol} marketType={marketType} />
      </UnavailableForIndex>
    </Box>
  );
};

export default TicketPanel;
