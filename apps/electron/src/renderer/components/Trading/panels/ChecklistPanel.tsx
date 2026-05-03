import { Box } from '@chakra-ui/react';
import { ChecklistSection } from '@renderer/components/Trading/ChecklistSection';
import { useLayoutStore } from '@renderer/store/layoutStore';

const DEFAULT_INTERVAL = '1h';

/**
 * v1.10 Track 4.1 — registered as the `checklist` panel kind. Standalone
 * panel that shows the trading checklist for the active symbol.
 *
 * Interval defaults to the focused chart panel's timeframe (so the
 * checklist follows what the user is looking at) and falls back to '1h'
 * if no chart is focused yet. ChecklistSection itself already pulls a
 * focusedInterval from the layout store as its primary source — this
 * just makes sure we pass a sane interval prop when no chart is
 * focused.
 */
export const ChecklistPanel = () => {
  const symbol = useLayoutStore((s) => s.getActiveTab()?.symbol ?? 'BTCUSDT');
  const marketType = useLayoutStore((s) => s.getActiveTab()?.marketType ?? 'FUTURES');
  const focusedInterval = useLayoutStore((s) => {
    const panel = s.getFocusedPanel();
    return panel?.kind === 'chart' ? panel.timeframe : undefined;
  });
  const interval = focusedInterval ?? DEFAULT_INTERVAL;

  return (
    <Box h="100%" overflowY="auto" p={1.5}>
      <ChecklistSection symbol={symbol} interval={interval} marketType={marketType} />
    </Box>
  );
};

export default ChecklistPanel;
