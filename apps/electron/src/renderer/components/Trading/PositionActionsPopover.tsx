import { Box, Flex, Text, VStack } from '@chakra-ui/react';
import { ConfirmationDialog, Popover } from '@renderer/components/ui';
import { useBackendFuturesTrading } from '@renderer/hooks/useBackendFuturesTrading';
import { useToast } from '@renderer/hooks/useToast';
import { memo, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuArrowUpDown, LuX } from 'react-icons/lu';

interface PositionLike {
  id?: string;
  side?: string;
  quantity?: string;
}

interface PositionActionsPopoverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  anchorRect: { x: number; y: number; width: number; height: number } | null;
  symbol: string;
  walletId: string | undefined;
  currentPosition: PositionLike | null;
}

interface ActionItemProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
}

const ActionItem = ({ icon, label, onClick, disabled, loading }: ActionItemProps) => (
  <Flex
    role="menuitem"
    align="center"
    gap={2}
    px={3}
    py={2}
    cursor={disabled || loading ? 'not-allowed' : 'pointer'}
    opacity={disabled ? 0.4 : 1}
    aria-disabled={disabled ? true : undefined}
    _hover={disabled || loading ? {} : { bg: 'bg.muted' }}
    onClick={disabled || loading ? undefined : onClick}
  >
    {icon}
    <Text fontSize="xs" color="fg">{label}</Text>
  </Flex>
);

export const PositionActionsPopover = memo(({
  open,
  onOpenChange,
  anchorRect,
  symbol,
  walletId,
  currentPosition,
}: PositionActionsPopoverProps) => {
  const { t } = useTranslation();
  const { error: toastError } = useToast();
  const {
    reversePosition,
    isReversingPosition,
    closePositionAndCancelOrders,
    isClosingPositionAndCancellingOrders,
  } = useBackendFuturesTrading(walletId ?? '');

  const [showReverseConfirm, setShowReverseConfirm] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);

  const isDisabled = !currentPosition;
  const positionSide = currentPosition?.side ? String(currentPosition.side).toUpperCase() : '';
  const positionQty = currentPosition?.quantity ?? '0';

  const handleReverseClick = useCallback(() => {
    if (isDisabled) return;
    setShowReverseConfirm(true);
  }, [isDisabled]);

  const handleCloseClick = useCallback(() => {
    if (isDisabled) return;
    setShowCloseConfirm(true);
  }, [isDisabled]);

  const handleReverseConfirm = useCallback(async () => {
    if (!walletId || !currentPosition) return;
    try {
      const result = await reversePosition({
        walletId,
        symbol,
        positionId: currentPosition.id,
      });
      if (result && 'success' in result && !result.success) {
        const errorMsg = 'error' in result && typeof result.error === 'string' ? result.error : undefined;
        toastError(t('futures.reverseFailed'), errorMsg);
        setShowReverseConfirm(false);
        return;
      }
      setShowReverseConfirm(false);
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toastError(t('futures.reverseFailed'), msg);
      setShowReverseConfirm(false);
    }
  }, [walletId, currentPosition, symbol, reversePosition, toastError, t, onOpenChange]);

  const handleCloseConfirm = useCallback(async () => {
    if (!walletId || !currentPosition) return;
    try {
      await closePositionAndCancelOrders({
        walletId,
        symbol,
        positionId: currentPosition.id,
      });
      setShowCloseConfirm(false);
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toastError(t('futures.closePositionFailed'), msg);
      setShowCloseConfirm(false);
    }
  }, [walletId, currentPosition, symbol, closePositionAndCancelOrders, toastError, t, onOpenChange]);

  const triggerAnchor = (
    <Box
      data-testid="position-actions-anchor"
      position="absolute"
      left={`${anchorRect?.x ?? 0}px`}
      top={`${anchorRect?.y ?? 0}px`}
      width={`${anchorRect?.width ?? 0}px`}
      height={`${anchorRect?.height ?? 0}px`}
      pointerEvents="none"
    />
  );

  return (
    <>
      <Popover
        open={open}
        onOpenChange={(details) => onOpenChange(details.open)}
        width="200px"
        positioning={{ placement: 'bottom-start', offset: { mainAxis: 8 } }}
        trigger={triggerAnchor}
      >
        <VStack gap={0} align="stretch" py={1} role="menu" data-testid="position-actions-menu">
          <ActionItem
            icon={<LuArrowUpDown />}
            label={t('futures.reversePosition')}
            onClick={handleReverseClick}
            disabled={isDisabled}
            loading={isReversingPosition}
          />
          <ActionItem
            icon={<LuX />}
            label={t('futures.closePosition')}
            onClick={handleCloseClick}
            disabled={isDisabled}
            loading={isClosingPositionAndCancellingOrders}
          />
        </VStack>
      </Popover>

      <ConfirmationDialog
        isOpen={showReverseConfirm}
        onClose={() => setShowReverseConfirm(false)}
        onConfirm={() => { void handleReverseConfirm(); }}
        title={t('futures.reverseConfirmTitle')}
        description={t('futures.reverseConfirmDescription', {
          side: positionSide,
          quantity: positionQty,
          symbol,
          newSide: positionSide === 'LONG' ? 'SHORT' : 'LONG',
        })}
        confirmLabel={t('futures.reversePosition')}
        colorPalette="blue"
        isLoading={isReversingPosition}
      />

      <ConfirmationDialog
        isOpen={showCloseConfirm}
        onClose={() => setShowCloseConfirm(false)}
        onConfirm={() => { void handleCloseConfirm(); }}
        title={t('futures.closePositionConfirmTitle')}
        description={t('futures.closePositionConfirmDescription', {
          side: positionSide,
          quantity: positionQty,
          symbol,
        })}
        confirmLabel={t('futures.closePosition')}
        colorPalette="red"
        isLoading={isClosingPositionAndCancellingOrders}
      />
    </>
  );
});

PositionActionsPopover.displayName = 'PositionActionsPopover';
