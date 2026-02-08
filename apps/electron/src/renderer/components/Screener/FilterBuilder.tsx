import type { IndicatorMeta, ScreenerFilterCondition } from '@marketmind/types';
import { Box, Flex, Stack } from '@chakra-ui/react';
import { memo, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuChevronDown, LuChevronUp, LuPlus } from 'react-icons/lu';
import { Button } from '../ui/button';
import { FilterRow } from './FilterRow';

const MAX_FILTERS = 10;

interface FilterBuilderProps {
  filters: ScreenerFilterCondition[];
  indicators: IndicatorMeta[];
  onAdd: (filter: ScreenerFilterCondition) => void;
  onUpdate: (id: string, updates: Partial<ScreenerFilterCondition>) => void;
  onRemove: (id: string) => void;
}

export const FilterBuilder = memo(({ filters, indicators, onAdd, onUpdate, onRemove }: FilterBuilderProps) => {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(filters.length > 0);

  const handleAdd = useCallback(() => {
    const defaultIndicator = indicators[0];
    if (!defaultIndicator) return;
    onAdd({
      id: `filter_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      indicator: defaultIndicator.id,
      indicatorParams: defaultIndicator.defaultParams,
      operator: 'ABOVE',
    });
    setExpanded(true);
  }, [indicators, onAdd]);

  return (
    <Box>
      <Flex justify="space-between" align="center">
        <Button
          size="2xs"
          variant="ghost"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? <LuChevronUp /> : <LuChevronDown />}
          {t('screener.filters.title')} ({filters.length})
        </Button>
        {filters.length < MAX_FILTERS && (
          <Button size="2xs" variant="ghost" colorPalette="blue" onClick={handleAdd}>
            <LuPlus />
            {t('screener.filters.add')}
          </Button>
        )}
      </Flex>

      {expanded && filters.length > 0 && (
        <Stack gap={2} mt={2}>
          {filters.map((filter) => (
            <FilterRow
              key={filter.id}
              filter={filter}
              indicators={indicators}
              onUpdate={onUpdate}
              onRemove={onRemove}
            />
          ))}
        </Stack>
      )}
    </Box>
  );
});

FilterBuilder.displayName = 'FilterBuilder';
