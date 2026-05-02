import { Box } from '@chakra-ui/react';
import { Callout } from '@renderer/components/ui';
import { useActiveWallet } from '@renderer/hooks/useActiveWallet';
import { useLayoutStore } from '@renderer/store/layoutStore';
import { ScalpingDashboard } from '@renderer/components/Trading/ScalpingDashboard';
import { ScalpingConfigDialog } from '@renderer/components/Trading/ScalpingConfig';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

export const AutoTradingSetupPanel = () => {
  const { t } = useTranslation();
  const { activeWallet } = useActiveWallet();
  const symbol = useLayoutStore((s) => s.getActiveTab()?.symbol ?? 'BTCUSDT');
  const [configOpen, setConfigOpen] = useState(false);

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
        onConfigClick={() => setConfigOpen(true)}
      />
      <ScalpingConfigDialog
        walletId={activeWallet.id}
        isOpen={configOpen}
        onClose={() => setConfigOpen(false)}
      />
    </Box>
  );
};

export default AutoTradingSetupPanel;
