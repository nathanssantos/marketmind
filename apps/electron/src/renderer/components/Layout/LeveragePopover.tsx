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
              label={t('futures.leverage', 'Leverage')}
              showArrow
              placement="bottom"
              isDisabled={isOpen}
            >
              <Button
                size="2xs"
                variant="outline"
                color={leverage > 1 ? 'orange.500' : 'fg.muted'}
                aria-label={t('futures.leverage', 'Leverage')}
                onClick={() => setIsOpen((prev) => !prev)}
                px={leverage > 1 ? 1.5 : undefined}
                minW={0}
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
            <Text fontSize="2xs" color="orange.500" mt={2} textAlign="center">
              {t('futures.leverageLockedPosition', 'Close position to change leverage')}
            </Text>
          )}
        </Box>
      </Popover>
    </Box>
  );
});

LeveragePopover.displayName = 'LeveragePopover';
