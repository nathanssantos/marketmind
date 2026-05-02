import { Flex, HStack, Text, VStack } from '@chakra-ui/react';
import { Badge, Button, LoadingSpinner, RecordRow } from '@renderer/components/ui';
import { useTranslation } from 'react-i18next';
import { trpc } from '../../utils/trpc';

const STATUS_PALETTE: Record<string, string> = {
  COMPLETED: 'green',
  FAILED: 'red',
  RUNNING: 'blue',
};

interface RecentRunsPanelProps {
  onSelect: (id: string) => void;
}

export const RecentRunsPanel = ({ onSelect }: RecentRunsPanelProps) => {
  const { t } = useTranslation();
  const query = trpc.backtest.list.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  if (query.isLoading) {
    return <Flex justify="center" py={4}><LoadingSpinner /></Flex>;
  }

  const items = (query.data ?? []).slice(0, 5);
  if (items.length === 0) return null;

  return (
    <VStack align="stretch" gap={2} pt={2}>
      <Text fontSize="xs" fontWeight="semibold" color="fg.muted" textTransform="uppercase">
        {t('backtest.recent.title')}
      </Text>
      <VStack align="stretch" gap={1}>
        {items.map((item) => (
          <RecordRow
            key={item.id}
            onClick={() => onSelect(item.id)}
            data-testid="recent-run-item"
          >
            <HStack justify="space-between">
              <VStack align="start" gap={0}>
                <Text fontSize="sm" fontWeight="medium">{item.symbol} · {item.interval}</Text>
                <Text fontSize="xs" color="fg.muted">
                  {item.startDate} → {item.endDate}
                </Text>
              </VStack>
              <HStack gap={2}>
                <Badge colorPalette={STATUS_PALETTE[item.status] ?? 'gray'} size="xs">
                  {item.status}
                </Badge>
                <Text
                  fontSize="xs"
                  color={item.totalPnlPercent >= 0 ? 'trading.profit' : 'trading.loss'}
                  fontWeight="medium"
                >
                  {item.totalPnlPercent >= 0 ? '+' : ''}{item.totalPnlPercent.toFixed(2)}%
                </Text>
                <Button
                  size="2xs"
                  variant="ghost"
                  onClick={(e) => { e.stopPropagation(); onSelect(item.id); }}
                  px={2}
                >
                  {t('backtest.recent.view')}
                </Button>
              </HStack>
            </HStack>
          </RecordRow>
        ))}
      </VStack>
    </VStack>
  );
};
