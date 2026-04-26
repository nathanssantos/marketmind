import { Box, Grid, HStack, Text, VStack } from '@chakra-ui/react';
import { CollapsibleSection, Field, NumberInput, Switch } from '@renderer/components/ui';
import {
  FILTER_DEFINITIONS,
  FILTER_GROUPS,
  type FilterDefinition,
  type FilterFieldDefinition,
  type FilterGroup,
  type SimpleBacktestInput,
} from '@marketmind/types';
import { useTranslation } from 'react-i18next';
import type { SetField } from '../BacktestForm';

interface FiltersTabProps {
  state: SimpleBacktestInput;
  setField: SetField;
  fieldErrors: Record<string, string>;
}

const isToggleEnabled = (state: SimpleBacktestInput, key: keyof SimpleBacktestInput): boolean => {
  const value = state[key];
  return value === true;
};

const FilterParam = ({
  param,
  state,
  setField,
  fieldErrors,
}: {
  param: FilterFieldDefinition;
  state: SimpleBacktestInput;
  setField: SetField;
  fieldErrors: Record<string, string>;
}) => {
  const { t } = useTranslation();
  const value = state[param.key];
  const error = fieldErrors[param.key as string];

  if (param.kind === 'toggle') {
    const checked = value === true || (value === undefined && param.default === true);
    return (
      <HStack justify="space-between" w="100%">
        <Text fontSize="xs">{t(param.labelKey)}</Text>
        <Switch
          checked={checked}
          onCheckedChange={(next) => setField(param.key, next as never)}
        />
      </HStack>
    );
  }

  const numericValue = typeof value === 'number' ? value : (param.default as number);

  return (
    <Field label={t(param.labelKey)} invalid={!!error} errorText={error}>
      <NumberInput
        value={numericValue}
        onChange={(e) => setField(param.key, Number(e.target.value) as never)}
        {...(param.min !== undefined ? { min: param.min } : {})}
        {...(param.max !== undefined ? { max: param.max } : {})}
        {...(param.step !== undefined ? { step: param.step } : {})}
        size="sm"
      />
    </Field>
  );
};

const FilterCard = ({
  filter,
  state,
  setField,
  fieldErrors,
}: {
  filter: FilterDefinition;
  state: SimpleBacktestInput;
  setField: SetField;
  fieldErrors: Record<string, string>;
}) => {
  const { t } = useTranslation();
  const enabled = isToggleEnabled(state, filter.toggle.key);

  return (
    <Box borderWidth="1px" borderColor="border" borderRadius="md" p={3}>
      <HStack justify="space-between" mb={enabled && filter.params?.length ? 2 : 0}>
        <VStack align="start" gap={0}>
          <Text fontSize="sm" fontWeight="medium">{t(filter.labelKey)}</Text>
          {filter.descriptionKey && (
            <Text fontSize="xs" color="fg.muted">{t(filter.descriptionKey)}</Text>
          )}
        </VStack>
        <Switch
          checked={enabled}
          onCheckedChange={(next) => setField(filter.toggle.key, next as never)}
        />
      </HStack>
      {enabled && filter.params && filter.params.length > 0 && (
        <Grid templateColumns={{ base: '1fr', md: 'repeat(2, 1fr)' }} gap={3}>
          {filter.params.map((param) => (
            <FilterParam
              key={param.key as string}
              param={param}
              state={state}
              setField={setField}
              fieldErrors={fieldErrors}
            />
          ))}
        </Grid>
      )}
    </Box>
  );
};

const GROUP_LABEL_KEY: Record<FilterGroup, string> = {
  trend: 'backtest.filters.groups.trend',
  momentum: 'backtest.filters.groups.momentum',
  volume: 'backtest.filters.groups.volume',
  volatility: 'backtest.filters.groups.volatility',
  session: 'backtest.filters.groups.session',
  confluence: 'backtest.filters.groups.confluence',
};

export const FiltersTab = ({ state, setField, fieldErrors }: FiltersTabProps) => {
  const { t } = useTranslation();

  return (
    <VStack align="stretch" gap={2} maxH="440px" overflowY="auto" pr={2}>
      {FILTER_GROUPS.map((group) => {
        const groupFilters = FILTER_DEFINITIONS.filter((f) => f.group === group);
        if (groupFilters.length === 0) return null;
        const enabledCount = groupFilters.filter((f) => isToggleEnabled(state, f.toggle.key)).length;

        return (
          <CollapsibleSection
            key={group}
            title={t(GROUP_LABEL_KEY[group])}
            description={t('backtest.filters.groupSummary', { enabled: enabledCount, total: groupFilters.length })}
            defaultOpen={enabledCount > 0}
            size="sm"
          >
            <VStack align="stretch" gap={2}>
              {groupFilters.map((filter) => (
                <FilterCard
                  key={filter.id}
                  filter={filter}
                  state={state}
                  setField={setField}
                  fieldErrors={fieldErrors}
                />
              ))}
            </VStack>
          </CollapsibleSection>
        );
      })}
    </VStack>
  );
};
