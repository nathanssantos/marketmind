import { formatDateTimeTooltip } from '@/renderer/utils/formatters';
import { HStack, Text } from '@chakra-ui/react';
import { Badge } from '@renderer/components/ui';
import type { MarketEvent } from '@marketmind/types';
import { useTranslation } from 'react-i18next';
import { TooltipContainer } from './TooltipContainer';

interface MarketEventTooltipProps {
  marketEvent: MarketEvent;
  left: number;
  top: number;
}

const getPriorityColor = (priority: string) => {
  if (priority === 'critical') return 'red';
  if (priority === 'high') return 'orange';
  if (priority === 'medium') return 'yellow';
  return 'gray';
};

const getEventTypeIcon = (type: string) => {
  switch (type) {
    case 'market_open': return '🔔';
    case 'market_close': return '🔕';
    case 'economic_event': return '📊';
    case 'earnings': return '💰';
    case 'dividend': return '💵';
    default: return '📅';
  }
};

export const MarketEventTooltip = ({ marketEvent, left, top }: MarketEventTooltipProps) => {
  const { t } = useTranslation();

  return (
    <TooltipContainer left={left} top={top}>
      <Text fontSize="2xs" color="fg.muted" mb={1}>
        {formatDateTimeTooltip(marketEvent.timestamp)}
      </Text>

      <HStack gap={1.5}>
        <Text>{getEventTypeIcon(marketEvent.type)}</Text>
        <Text fontWeight="semibold">
          {marketEvent.title}
        </Text>
      </HStack>

      {marketEvent.description && (
        <Text color="fg.muted" fontSize="2xs">
          {marketEvent.description}
        </Text>
      )}

      <HStack justify="space-between" pt={1} borderTopWidth={1} borderColor="border">
        <Text color="fg.muted" fontSize="2xs">{t('common.type')}</Text>
        <Badge colorScheme="blue" fontSize="2xs" px={2}>
          {marketEvent.type === 'market_open' ? t('common.marketOpen') : t('common.marketClose')}
        </Badge>
      </HStack>

      <HStack justify="space-between">
        <Text color="fg.muted" fontSize="2xs">{t('common.priority')}</Text>
        <Badge colorScheme={getPriorityColor(marketEvent.priority)} fontSize="2xs" px={2}>
          {t(`common.${marketEvent.priority}`)}
        </Badge>
      </HStack>

      <HStack justify="space-between">
        <Text color="fg.muted" fontSize="2xs">{t('common.source')}</Text>
        <Text fontWeight="medium" fontSize="2xs">{marketEvent.source}</Text>
      </HStack>

      {marketEvent.endTimestamp && (
        <HStack justify="space-between">
          <Text color="fg.muted">{t('common.endTime')}:</Text>
          <Text fontWeight="medium">{formatDateTimeTooltip(marketEvent.endTimestamp)}</Text>
        </HStack>
      )}
    </TooltipContainer>
  );
};
