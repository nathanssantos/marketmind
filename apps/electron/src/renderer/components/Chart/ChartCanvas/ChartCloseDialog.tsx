import { Box, Stack, Text } from '@chakra-ui/react';
import { ConfirmationDialog } from '@renderer/components/ui';
import { getKlineClose } from '@shared/utils';
import type { ReactElement, ReactNode } from 'react';
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

interface ChartCloseVariant {
  title: string;
  description: ReactNode;
  confirmLabel: string;
}

const buildVariant = (
  orderToClose: string,
  allExecutions: BackendExecution[],
  manager: CanvasManager | null,
  t: (key: string, vars?: Record<string, unknown>) => string,
): ChartCloseVariant | null => {
  if (orderToClose.startsWith('sltp:')) {
    const firstColon = orderToClose.indexOf(':');
    const secondColon = orderToClose.indexOf(':', firstColon + 1);
    const type = orderToClose.substring(firstColon + 1, secondColon);
    const typeLabel = type === 'stopLoss'
      ? t('trading.dialogs.chartRemoveSlTp.typeStopLoss')
      : t('trading.dialogs.chartRemoveSlTp.typeTakeProfit');
    return {
      title: t('trading.dialogs.chartRemoveSlTp.title', { type: typeLabel }),
      description: (
        <Text fontSize="sm" color="fg.muted">
          {t('trading.dialogs.chartRemoveSlTp.description', { type: typeLabel })}
        </Text>
      ),
      confirmLabel: t('trading.dialogs.chartRemoveSlTp.submit', { type: typeLabel }),
    };
  }

  const exec = allExecutions.find((e) => e.id === orderToClose);
  if (!exec || !manager) return null;
  const klines = manager.getKlines();
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

  return {
    title: t('trading.dialogs.chartClose.title'),
    description: (
      <Stack gap={2}>
        <Text fontSize="sm" color="fg.muted">
          {t('trading.dialogs.chartClose.description', {
            side: exec.side,
            entry: entryPrice.toFixed(2),
            current: currentPriceVal.toFixed(2),
          })}
        </Text>
        <Box
          fontSize="lg"
          fontWeight="bold"
          color={isProfit ? 'trading.profit' : 'trading.loss'}
        >
          {percentChange >= 0 ? '+' : ''}{percentChange.toFixed(2)}%
        </Box>
      </Stack>
    ),
    confirmLabel: t('trading.dialogs.chartClose.submit'),
  };
};

export const ChartCloseDialog = ({
  orderToClose,
  onOpenChange,
  onConfirmClose,
  allExecutions,
  manager,
}: ChartCloseDialogProps): ReactElement => {
  const { t } = useTranslation();

  const variant = orderToClose ? buildVariant(orderToClose, allExecutions, manager, t) : null;

  return (
    <ConfirmationDialog
      isOpen={!!orderToClose}
      onClose={() => onOpenChange(false)}
      onConfirm={onConfirmClose}
      title={variant?.title ?? ''}
      description={variant?.description}
      confirmLabel={variant?.confirmLabel}
      isDestructive
    />
  );
};
