import type { ScreenerFilterCondition } from '@marketmind/types';
import { Flex, HStack, IconButton, Text } from '@chakra-ui/react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { LuX } from 'react-icons/lu';
import { Button } from '../ui/button';

interface FilterChipProps {
  filters: ScreenerFilterCondition[];
  onRemove: (id: string) => void;
  onClearAll: () => void;
}

const formatCondition = (cond: ScreenerFilterCondition): string => {
  const indicator = cond.indicator.replace(/_/g, ' ');
  switch (cond.operator) {
    case 'ABOVE': return `${indicator} > ${cond.compareIndicator ?? cond.value ?? ''}`;
    case 'BELOW': return `${indicator} < ${cond.compareIndicator ?? cond.value ?? ''}`;
    case 'BETWEEN': return `${indicator} ${cond.value ?? ''}-${cond.valueMax ?? ''}`;
    case 'CROSSES_ABOVE': return `${indicator} crosses above ${cond.value ?? ''}`;
    case 'CROSSES_BELOW': return `${indicator} crosses below ${cond.value ?? ''}`;
    case 'INCREASING': return `${indicator} increasing`;
    case 'DECREASING': return `${indicator} decreasing`;
    default: return indicator;
  }
};

export const FilterChip = memo(({ filters, onRemove, onClearAll }: FilterChipProps) => {
  const { t } = useTranslation();

  if (filters.length === 0) return null;

  return (
    <Flex gap={1} flexWrap="wrap" align="center">
      {filters.map((filter) => (
        <HStack
          key={filter.id}
          bg="bg.muted"
          borderRadius="md"
          px={2}
          py={0.5}
          gap={1}
          fontSize="2xs"
        >
          <Text>{formatCondition(filter)}</Text>
          <IconButton
            size="2xs"
            variant="ghost"
            aria-label={t('screener.filters.remove')}
            onClick={() => onRemove(filter.id)}
            minW={4}
            h={4}
          >
            <LuX size={10} />
          </IconButton>
        </HStack>
      ))}
      <Button size="2xs" variant="ghost" colorPalette="red" onClick={onClearAll}>
        {t('screener.filters.clearAll')}
      </Button>
    </Flex>
  );
});

FilterChip.displayName = 'FilterChip';
