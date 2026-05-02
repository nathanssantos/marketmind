import { Box } from '@chakra-ui/react';
import { useLayoutStore } from '@renderer/store/layoutStore';
import { OrderFlowMetrics } from '../OrderFlowMetrics';

/**
 * v1.10 Track 4.6 — registered as the `orderFlowMetrics` panel kind.
 * Reads the active symbol from the layout store (same pattern named
 * panels use to track the active symbol-tab) and feeds it into the
 * existing `<OrderFlowMetrics>` component.
 */
export const OrderFlowMetricsPanel = () => {
  const symbol = useLayoutStore((s) => s.getActiveTab()?.symbol ?? 'BTCUSDT');
  return (
    <Box h="100%" overflowY="auto">
      <OrderFlowMetrics symbol={symbol} />
    </Box>
  );
};

export default OrderFlowMetricsPanel;
