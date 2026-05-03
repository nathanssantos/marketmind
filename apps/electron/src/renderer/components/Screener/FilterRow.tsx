import type { IndicatorMeta, ScreenerFilterCondition, ScreenerIndicatorId, ScreenerOperator } from '@marketmind/types';
import { Flex } from '@chakra-ui/react';
import { IconButton, Input, Select, type SelectOption } from '@renderer/components/ui';
import { memo, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { LuTrash2 } from 'react-icons/lu';

const OPERATORS: ScreenerOperator[] = ['ABOVE', 'BELOW', 'BETWEEN', 'CROSSES_ABOVE', 'CROSSES_BELOW', 'INCREASING', 'DECREASING'];

const needsValue = (op: ScreenerOperator): boolean => !['INCREASING', 'DECREASING'].includes(op);
const needsMaxValue = (op: ScreenerOperator): boolean => op === 'BETWEEN';

interface FilterRowProps {
  filter: ScreenerFilterCondition;
  indicators: IndicatorMeta[];
  onUpdate: (id: string, updates: Partial<ScreenerFilterCondition>) => void;
  onRemove: (id: string) => void;
}

export const FilterRow = memo(({ filter, indicators, onUpdate, onRemove }: FilterRowProps) => {
  const { t } = useTranslation();

  const indicatorOptions: SelectOption[] = useMemo(
    () => indicators.map((ind) => ({ value: ind.id, label: ind.name })),
    [indicators],
  );

  const operatorOptions: SelectOption[] = useMemo(
    () => OPERATORS.map((op) => ({ value: op, label: t(`screener.operators.${op}`, op) })),
    [t],
  );

  const handleIndicatorChange = useCallback((value: string) => {
    const indicator = value as ScreenerIndicatorId;
    const meta = indicators.find((i) => i.id === indicator);
    onUpdate(filter.id, {
      indicator,
      indicatorParams: meta?.defaultParams ?? {},
      value: undefined,
      valueMax: undefined,
      compareIndicator: undefined,
    });
  }, [filter.id, indicators, onUpdate]);

  const handleOperatorChange = useCallback((value: string) => {
    onUpdate(filter.id, { operator: value as ScreenerOperator });
  }, [filter.id, onUpdate]);

  const handleValueChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value === '' ? undefined : Number(e.target.value);
    onUpdate(filter.id, { value: val });
  }, [filter.id, onUpdate]);

  const handleMaxValueChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value === '' ? undefined : Number(e.target.value);
    onUpdate(filter.id, { valueMax: val });
  }, [filter.id, onUpdate]);

  return (
    <Flex gap={2} align="center">
      <Select
        size="xs"
        value={filter.indicator}
        options={indicatorOptions}
        onChange={handleIndicatorChange}
        minWidth="140px"
        usePortal={false}
      />

      <Select
        size="xs"
        value={filter.operator}
        options={operatorOptions}
        onChange={handleOperatorChange}
        minWidth="120px"
        usePortal={false}
      />

      {needsValue(filter.operator) && (
        <Input
          size="xs"
          type="number"
          w="80px"
          flexShrink={0}
          placeholder={t('screener.filters.value')}
          value={filter.value ?? ''}
          onChange={handleValueChange}
        />
      )}

      {needsMaxValue(filter.operator) && (
        <Input
          size="xs"
          type="number"
          w="80px"
          flexShrink={0}
          placeholder={t('screener.filters.max')}
          value={filter.valueMax ?? ''}
          onChange={handleMaxValueChange}
        />
      )}

      <IconButton
        size="2xs"
        variant="ghost"
        colorPalette="red"
        aria-label={t('screener.filters.remove')}
        onClick={() => onRemove(filter.id)}
      >
        <LuTrash2 />
      </IconButton>
    </Flex>
  );
});

FilterRow.displayName = 'FilterRow';
