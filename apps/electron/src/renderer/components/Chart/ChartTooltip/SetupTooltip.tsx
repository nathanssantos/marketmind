import { formatPriceDisplay } from '@/renderer/utils/formatters';
import { HStack, Text } from '@chakra-ui/react';
import { Badge } from '@renderer/components/ui';
import type { TradingSetup } from '@marketmind/types';
import { useTranslation } from 'react-i18next';
import { TooltipContainer } from './TooltipContainer';

interface SetupTooltipProps {
  setup: TradingSetup;
  left: number;
  top: number;
}

const getUrgencyColor = (urgency: string) => {
  if (urgency === 'immediate') return 'red';
  if (urgency === 'wait_for_pullback') return 'orange';
  return 'green';
};

const getUrgencyLabel = (urgency: string) => {
  if (urgency === 'immediate') return 'Immediate';
  if (urgency === 'wait_for_pullback') return 'Wait for Pullback';
  return 'Wait for Confirmation';
};

export const SetupTooltip = ({ setup, left, top }: SetupTooltipProps) => {
  const { t } = useTranslation();

  const isLong = setup.direction === 'LONG';
  const riskRewardRatio = setup.stopLoss && setup.takeProfit
    ? Math.abs((setup.takeProfit - setup.entryPrice) / (setup.entryPrice - setup.stopLoss))
    : null;

  return (
    <TooltipContainer left={left} top={top}>
      {setup.openTime && (
        <Text fontSize="2xs" color="fg.muted" mb={1}>
          {new Date(setup.openTime).toLocaleString()}
        </Text>
      )}

      <HStack gap={1.5}>
        <Text>{isLong ? '📈' : '📉'}</Text>
        <Text fontWeight="semibold" color={isLong ? 'trading.long' : 'trading.short'}>
          {setup.type.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
        </Text>
      </HStack>

      <HStack justify="space-between" pt={1} borderTopWidth={1} borderColor="border">
        <Text color="fg.muted">{t('common.direction')}:</Text>
        <Text fontWeight="medium" color={isLong ? 'trading.long' : 'trading.short'}>
          {isLong ? t('common.long') : t('common.short')}
        </Text>
      </HStack>

      {setup.confidence !== undefined && (
        <HStack justify="space-between">
          <Text color="fg.muted">{t('aiTrading.confidence')}:</Text>
          <Text fontWeight="medium" color={setup.confidence >= 0.7 ? 'trading.profit' : setup.confidence >= 0.5 ? 'trading.warning' : 'trading.loss'}>
            {Math.round(setup.confidence * 100)}%
          </Text>
        </HStack>
      )}

      {riskRewardRatio && (
        <HStack justify="space-between">
          <Text color="fg.muted">R:R {t('common.ratio')}:</Text>
          <Text fontWeight="medium" color="blue.fg">
            1:{riskRewardRatio.toFixed(2)}
          </Text>
        </HStack>
      )}

      {setup.urgency && (
        <HStack justify="space-between" pt={1} borderTopWidth={1} borderColor="border">
          <Text color="fg.muted">{t('aiTrading.urgency')}:</Text>
          <Badge colorScheme={getUrgencyColor(setup.urgency)}>
            {getUrgencyLabel(setup.urgency)}
          </Badge>
        </HStack>
      )}

      <HStack justify="space-between" pt={1} borderTopWidth={1} borderColor="border">
        <Text color="fg.muted">{t('common.entry')}:</Text>
        <Text fontWeight="medium">{formatPriceDisplay(setup.entryPrice)}</Text>
      </HStack>

      {setup.stopLoss && (
        <HStack justify="space-between">
          <Text color="fg.muted">{t('common.stopLoss')}:</Text>
          <Text fontWeight="medium" color="red.fg">{formatPriceDisplay(setup.stopLoss)}</Text>
        </HStack>
      )}

      {setup.takeProfit && (
        <HStack justify="space-between">
          <Text color="fg.muted">{t('common.takeProfit')}:</Text>
          <Text fontWeight="medium" color="green.fg">{formatPriceDisplay(setup.takeProfit)}</Text>
        </HStack>
      )}
    </TooltipContainer>
  );
};
