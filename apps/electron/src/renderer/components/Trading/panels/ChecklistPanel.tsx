import { Box } from '@chakra-ui/react';
import { ChecklistSection } from '@renderer/components/Trading/ChecklistSection';
import { useLayoutStore } from '@renderer/store/layoutStore';

const DEFAULT_INTERVAL = '1h';

/**
 * v1.10 Track 4.1 — registered as the `checklist` panel kind. Standalone
 * panel that shows the trading checklist for the active symbol.
 *
 * Note: this panel intentionally does NOT read the focused chart's
 * timeframe — that subscription happens inside ChecklistSection and is
 * gated on whether any condition resolves to `timeframe='current'`. If
 * we read it here, every focus change would re-render this panel and
 * pass a new `interval` prop, defeating the gating. Pass the static
 * fallback and let the section decide.
 */
export const ChecklistPanel = () => {
  const symbol = useLayoutStore((s) => s.getActiveTab()?.symbol ?? 'BTCUSDT');
  const marketType = useLayoutStore((s) => s.getActiveTab()?.marketType ?? 'FUTURES');

  return (
    <Box h="100%" overflowY="auto" p={1.5}>
      <ChecklistSection symbol={symbol} interval={DEFAULT_INTERVAL} marketType={marketType} />
    </Box>
  );
};

export default ChecklistPanel;
