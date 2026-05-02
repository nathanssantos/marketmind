import { Box } from '@chakra-ui/react';
import { Callout } from '@renderer/components/ui';
import { useActiveWallet } from '@renderer/hooks/useActiveWallet';
import { useLayoutStore } from '@renderer/store/layoutStore';
import { ScalpingDashboard } from '@renderer/components/Trading/ScalpingDashboard';
import { useTranslation } from 'react-i18next';

/**
 * v1.10 Track 4.5 — registered as the `autoTradingSetup` panel kind.
 * Wraps the existing `<ScalpingDashboard>` (auto-trading setup detection)
 * with the same wallet-required guard the AutoTradingSidebar uses today.
 *
 * onConfigClick is a no-op in the grid panel context — the user can open
 * the scalping config dialog from the trading menu instead. We can wire
 * a config affordance later if needed.
 */
export const AutoTradingSetupPanel = () => {
  const { t } = useTranslation();
  const { activeWallet } = useActiveWallet();
  const symbol = useLayoutStore((s) => s.getActiveTab()?.symbol ?? 'BTCUSDT');
  const noop = () => {};

  if (!activeWallet) {
    return (
      <Box h="100%" overflowY="auto" p={1.5}>
        <Callout tone="warning" compact>
          {t('trading.wallets.selectWallet')}
        </Callout>
      </Box>
    );
  }

  return (
    <Box h="100%" overflowY="auto" p={1.5}>
      <ScalpingDashboard
        walletId={activeWallet.id}
        symbol={symbol}
        onConfigClick={noop}
      />
    </Box>
  );
};

export default AutoTradingSetupPanel;
