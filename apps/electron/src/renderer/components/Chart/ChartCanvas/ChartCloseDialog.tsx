import { Box } from '@chakra-ui/react';
import { DialogShell } from '@renderer/components/ui';
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

interface ChartCloseVariant {
  titleKey: string;
  descriptionKey: string;
  descriptionVars: Record<string, unknown>;
  submitKey: string;
  showPnL: boolean;
  pnL?: { isProfit: boolean; percentChange: number };
}

const buildVariant = (
  orderToClose: string,
  allExecutions: BackendExecution[],
  manager: CanvasManager | null,
): ChartCloseVariant | null => {
  if (orderToClose.startsWith('sltp:')) {
    const firstColon = orderToClose.indexOf(':');
    const secondColon = orderToClose.indexOf(':', firstColon + 1);
    const type = orderToClose.substring(firstColon + 1, secondColon);
    const typeLabel = type === 'stopLoss' ? 'Stop Loss' : 'Take Profit';
    return {
      titleKey: 'trading.dialogs.chartRemoveSlTp.title',
      descriptionKey: 'trading.dialogs.chartRemoveSlTp.description',
      descriptionVars: { type: typeLabel },
      submitKey: 'trading.dialogs.chartRemoveSlTp.submit',
      showPnL: false,
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
    titleKey: 'trading.dialogs.chartClose.title',
    descriptionKey: 'trading.dialogs.chartClose.description',
    descriptionVars: {
      type: exec.side,
      entry: entryPrice.toFixed(2),
      current: currentPriceVal.toFixed(2),
    },
    submitKey: 'trading.dialogs.chartClose.submit',
    showPnL: true,
    pnL: { isProfit, percentChange },
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

  const variant = orderToClose ? buildVariant(orderToClose, allExecutions, manager) : null;

  return (
    <DialogShell
      isOpen={!!orderToClose}
      onClose={() => onOpenChange(false)}
      size="sm"
      title={variant ? t(variant.titleKey) : ''}
      description={variant ? t(variant.descriptionKey, variant.descriptionVars) : undefined}
      onSubmit={onConfirmClose}
      submitLabel={variant ? t(variant.submitKey) : t('common.confirm')}
      submitColorPalette="red"
    >
      {variant?.showPnL && variant.pnL && (
        <Box
          fontSize="lg"
          fontWeight="bold"
          color={variant.pnL.isProfit ? 'trading.profit' : 'trading.loss'}
        >
          {variant.pnL.percentChange >= 0 ? '+' : ''}{variant.pnL.percentChange.toFixed(2)}%
        </Box>
      )}
    </DialogShell>
  );
};
