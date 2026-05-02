import { Box } from '@chakra-ui/react';
import { QuickTradeToolbar } from '@renderer/components/Layout/QuickTradeToolbar';
import { useLayoutStore } from '@renderer/store/layoutStore';

/**
 * v1.10 Track 4.1 — registered as the `ticket` panel kind. Wraps the
 * existing `<QuickTradeToolbar>` ticket. Reads the active symbol +
 * marketType from the layout store (the symbol-tab selection drives
 * what the ticket targets, per the user's clarification: switching tabs
 * just retargets the ticket).
 *
 * `onMenuAction` and `onClose` are no-ops in panel mode — the panel is
 * closed via right-click, and the chart-overlay drop affordance is
 * preserved via the existing modes system (handled at a higher level).
 */
export const TicketPanel = () => {
  const symbol = useLayoutStore((s) => s.getActiveTab()?.symbol ?? 'BTCUSDT');
  const marketType = useLayoutStore((s) => s.getActiveTab()?.marketType ?? 'FUTURES');

  return (
    <Box h="100%" overflowY="auto">
      <QuickTradeToolbar symbol={symbol} marketType={marketType} />
    </Box>
  );
};

export default TicketPanel;
