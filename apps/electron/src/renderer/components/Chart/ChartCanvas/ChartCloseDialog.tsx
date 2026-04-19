import {
  Button,
  CloseButton,
  DialogActionTrigger,
  DialogBackdrop,
  DialogBody,
  DialogCloseTrigger,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogPositioner,
  DialogRoot,
  DialogTitle,
} from '@renderer/components/ui';
import { Box, Portal } from '@chakra-ui/react';
import { getKlineClose } from '@shared/utils';
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import type { BackendExecution } from '../useOrderLinesRenderer';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';

interface ChartCloseDialogProps {
  orderToClose: string | null;
  onOpenChange: (open: boolean) => void;
  onConfirmClose: () => void;
  allExecutions: BackendExecution[];
  manager: CanvasManager | null;
}

export const ChartCloseDialog = ({
  orderToClose,
  onOpenChange,
  onConfirmClose,
  allExecutions,
  manager,
}: ChartCloseDialogProps): ReactElement => {
  const { t } = useTranslation();

  return (
    <Portal>
      <DialogRoot
        open={!!orderToClose}
        onOpenChange={(e) => !e.open && onOpenChange(false)}
        placement="center"
      >
        <DialogBackdrop />
        <DialogPositioner>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('trading.closeOrder')}</DialogTitle>
              <DialogCloseTrigger asChild>
                <CloseButton size="sm" />
              </DialogCloseTrigger>
            </DialogHeader>
            <DialogBody>
              {orderToClose && (() => {
                if (orderToClose.startsWith('sltp:')) {
                  const firstColon = orderToClose.indexOf(':');
                  const secondColon = orderToClose.indexOf(':', firstColon + 1);
                  const type = orderToClose.substring(firstColon + 1, secondColon);
                  const typeLabel = type === 'stopLoss' ? 'Stop Loss' : 'Take Profit';

                  return (
                    <Box>
                      {t('trading.removeSLTPConfirm', { type: typeLabel })}
                    </Box>
                  );
                }

                const exec = allExecutions.find((e) => e.id === orderToClose);
                if (!exec || !manager) return null;

                const klines = manager.getKlines();
                if (!klines.length) return null;

                const lastKline = klines[klines.length - 1];
                if (!lastKline) return null;

                const currentPriceVal = getKlineClose(lastKline);
                const isLong = exec.side === 'LONG';
                const entryPrice = parseFloat(exec.entryPrice);
                const priceChange = currentPriceVal - entryPrice;
                const percentChange = isLong
                  ? (priceChange / entryPrice) * 100
                  : (-priceChange / entryPrice) * 100;
                const isProfit = percentChange >= 0;

                return (
                  <Box>
                    <Box mb={4}>
                      {t('trading.closeOrderConfirm', {
                        type: exec.side,
                        entry: entryPrice.toFixed(2),
                        current: currentPriceVal.toFixed(2),
                      })}
                    </Box>
                    <Box
                      fontSize="lg"
                      fontWeight="bold"
                      color={isProfit ? 'green.500' : 'red.500'}
                    >
                      {percentChange >= 0 ? '+' : ''}{percentChange.toFixed(2)}%
                    </Box>
                  </Box>
                );
              })()}
            </DialogBody>
            <DialogFooter>
              <DialogActionTrigger asChild>
                <Button variant="outline">{t('common.cancel')}</Button>
              </DialogActionTrigger>
              <Button
                onClick={onConfirmClose}
                colorPalette="red"
              >
                {t('trading.confirmClose')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </DialogPositioner>
      </DialogRoot>
    </Portal>
  );
};
