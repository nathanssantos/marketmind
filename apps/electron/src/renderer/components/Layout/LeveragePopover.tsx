import { Box, Text } from '@chakra-ui/react';
import { Button, Popover, TooltipWrapper } from '@renderer/components/ui';
import { LeverageSelector } from '@renderer/components/LeverageSelector';
import { useActiveWallet } from '@renderer/hooks/useActiveWallet';
import { trpc } from '@renderer/utils/trpc';
import { memo, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface LeveragePopoverProps {
  symbol: string;
}

export const LeveragePopover = memo(({ symbol }: LeveragePopoverProps) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const { activeWallet } = useActiveWallet();
  const walletId = activeWallet?.id;

  const { data: symbolLeverage } = trpc.futuresTrading.getSymbolLeverage.useQuery(
    { walletId: walletId!, symbol },
    { enabled: !!walletId && !!symbol },
  );

  const { data: activeExecutions } = trpc.autoTrading.getActiveExecutions.useQuery(
    { walletId: walletId! },
    { enabled: !!walletId },
  );

  const hasOpenPosition = (activeExecutions ?? []).some(
    (e) => e.symbol === symbol && e.status === 'open'
  );

  const utils = trpc.useUtils();
  const setLeverageMutation = trpc.futuresTrading.setLeverage.useMutation({
    onSuccess: () => {
      void utils.futuresTrading.getSymbolLeverage.invalidate({ walletId: walletId!, symbol });
      void utils.futuresTrading.getPositions.invalidate();
    },
  });

  const leverage = symbolLeverage?.leverage ?? 1;

  // Match the LeverageSelector's risk-tier colors so the trigger button,
  // popover header, and (semantically) the preset grid all agree on
  // what color "Nx" should be at a glance. 1x is muted (no risk); 2-20x
  // is profit/safe; 21-50x warning; >50x loss/extreme.
  const triggerColor: string =
    leverage <= 1 ? 'fg.muted'
    : leverage > 50 ? 'trading.loss'
    : leverage > 20 ? 'trading.warning'
    : 'trading.profit';

  const handleLeverageChange = useCallback((newLeverage: number) => {
    if (!walletId || !symbol) return;
    setLeverageMutation.mutate({ walletId, symbol, leverage: newLeverage });
  }, [walletId, symbol, setLeverageMutation]);

  return (
    <Box position="relative" lineHeight={0}>
      <Popover
        open={isOpen}
        onOpenChange={(details) => setIsOpen(details.open)}
        width="240px"
        positioning={{ placement: 'top-start', offset: { mainAxis: 8 } }}
        trigger={
          <Box>
            <TooltipWrapper
              label={t('futures.leverage')}
              showArrow
              placement="bottom"
              isDisabled={isOpen}
            >
              <Button
                size="2xs"
                variant="outline"
                color={triggerColor}
                aria-label={t('futures.leverage')}
                onClick={() => setIsOpen((prev) => !prev)}
                h="20px"
                minH="20px"
                px={1.5}
                minW="32px"
                fontSize="xs"
                fontWeight="bold"
              >
                {`${leverage}x`}
              </Button>
            </TooltipWrapper>
          </Box>
        }
      >
        <Box p={2}>
          <LeverageSelector
            value={leverage}
            onChange={handleLeverageChange}
            disabled={!walletId || !symbol || hasOpenPosition}
          />
          {hasOpenPosition && (
            <Text fontSize="2xs" color="orange.fg" mt={2} textAlign="center">
              {t('futures.leverageLockedPosition')}
            </Text>
          )}
        </Box>
      </Popover>
    </Box>
  );
});

LeveragePopover.displayName = 'LeveragePopover';
