import { Box, Flex, Text } from '@chakra-ui/react';
import { Badge, CryptoIcon, IconButton } from '@renderer/components/ui';
import { useToast } from '@renderer/hooks/useToast';
import type { OrphanOrder } from '@renderer/hooks/useOrphanOrders';
import { memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuX } from 'react-icons/lu';
import { TradingTable, TradingTableCell, TradingTableRow, type TradingTableColumn } from './TradingTable';
import type { NavigateToSymbol } from './portfolioTypes';

interface OrphanOrderCardProps {
  orphan: OrphanOrder;
  onCancel: () => Promise<void>;
  onNavigateToSymbol?: NavigateToSymbol;
}

const OrphanOrderCardComponent = ({ orphan, onCancel, onNavigateToSymbol }: OrphanOrderCardProps) => {
  const { t } = useTranslation();
  const [cancelling, setCancelling] = useState(false);
  const isBuy = orphan.side === 'BUY';

  const handleCancel = async () => {
    setCancelling(true);
    try { await onCancel(); } finally { setCancelling(false); }
  };

  return (
    <Box
      borderRadius="md"
      borderLeftWidth="3px"
      borderLeftColor="orange.500"
      bg="bg.muted"
      px={3}
      py={2}
      cursor={onNavigateToSymbol ? 'pointer' : undefined}
      onClick={() => onNavigateToSymbol?.(orphan.symbol, 'FUTURES')}
      _hover={onNavigateToSymbol ? { bg: 'bg.subtle' } : undefined}
    >
      <Flex justify="space-between" align="center">
        <Flex align="center" gap={2}>
          <CryptoIcon symbol={orphan.symbol} size={18} />
          <Text fontSize="sm" fontWeight="semibold">{orphan.symbol}</Text>
          <Badge colorPalette={isBuy ? 'green' : 'red'} size="xs">{t(`trading.ticket.${isBuy ? 'buy' : 'sell'}`)}</Badge>
          <Badge colorPalette="gray" size="xs">{orphan.type.replace(/_/g, ' ')}</Badge>
        </Flex>
        <IconButton
          aria-label={t('trading.portfolio.orphanOrdersCancel')}
          size="2xs"
          variant="ghost"
          colorPalette="red"
          loading={cancelling}
          onClick={(e) => { e.stopPropagation(); handleCancel(); }}
        >
          <LuX />
        </IconButton>
      </Flex>
      <Flex gap={4} mt={1} fontSize="xs" color="fg.muted">
        <Text>{parseFloat(orphan.price).toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
        <Text>Qty: {parseFloat(orphan.quantity).toLocaleString()}</Text>
        {orphan.createdAt && <Text>{orphan.createdAt.toLocaleTimeString()}</Text>}
      </Flex>
    </Box>
  );
};

export const OrphanOrderCard = memo(OrphanOrderCardComponent);

interface OrphanOrdersTableProps {
  orphans: OrphanOrder[];
  walletId: string;
  cancelFuturesOrder: (data: { walletId: string; symbol: string; orderId: string; isAlgo?: boolean }) => Promise<unknown>;
  onNavigateToSymbol?: NavigateToSymbol;
}

const OrphanOrdersTableComponent = ({ orphans, walletId, cancelFuturesOrder, onNavigateToSymbol }: OrphanOrdersTableProps) => {
  const { t } = useTranslation();
  const { success: toastSuccess, error: toastError } = useToast();
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const columns: TradingTableColumn[] = useMemo(() => [
    { key: 'symbol', header: 'SYMBOL', sticky: true },
    { key: 'side', header: 'SIDE' },
    { key: 'type', header: 'TYPE' },
    { key: 'price', header: 'PRICE', textAlign: 'right' as const },
    { key: 'quantity', header: 'QTY', textAlign: 'right' as const },
    { key: 'actions', header: '' },
  ], []);

  return (
    <TradingTable columns={columns}>
      {orphans.map((orphan) => {
        const isBuy = orphan.side === 'BUY';
        return (
          <TradingTableRow
            key={orphan.id}
            onClick={() => onNavigateToSymbol?.(orphan.symbol, 'FUTURES')}
          >
            <TradingTableCell sticky>
              <Flex align="center" gap={1.5}>
                <CryptoIcon symbol={orphan.symbol} size={16} />
                <Text fontWeight="medium" fontSize="xs">{orphan.symbol}</Text>
              </Flex>
            </TradingTableCell>
            <TradingTableCell>
              <Badge colorPalette={isBuy ? 'green' : 'red'} size="xs">{t(`trading.ticket.${isBuy ? 'buy' : 'sell'}`)}</Badge>
            </TradingTableCell>
            <TradingTableCell>
              <Text fontSize="xs">{orphan.type.replace(/_/g, ' ')}</Text>
            </TradingTableCell>
            <TradingTableCell textAlign="right">
              <Text fontSize="xs">{parseFloat(orphan.price).toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
            </TradingTableCell>
            <TradingTableCell textAlign="right">
              <Text fontSize="xs">{parseFloat(orphan.quantity).toLocaleString()}</Text>
            </TradingTableCell>
            <TradingTableCell>
              <IconButton
                aria-label={t('trading.portfolio.orphanOrdersCancel')}
                size="2xs"
                variant="ghost"
                colorPalette="red"
                loading={cancellingId === orphan.id}
                onClick={async (e) => {
                  e.stopPropagation();
                  setCancellingId(orphan.id);
                  try {
                    await cancelFuturesOrder({ walletId, symbol: orphan.symbol, orderId: orphan.exchangeOrderId, isAlgo: orphan.isAlgo });
                    toastSuccess(t('trading.portfolio.orphanOrdersCancelSuccess'));
                  } catch {
                    toastError(t('trading.portfolio.orphanOrdersCancelFailed'));
                  } finally {
                    setCancellingId(null);
                  }
                }}
              >
                <LuX />
              </IconButton>
            </TradingTableCell>
          </TradingTableRow>
        );
      })}
    </TradingTable>
  );
};

export const OrphanOrdersTable = memo(OrphanOrdersTableComponent);
