import { Box, Flex, Grid, HStack, Text, VStack } from '@chakra-ui/react';
import { Badge, Button, Callout, Checkbox, Field, LoadingSpinner, NumberInput, Switch } from '@renderer/components/ui';
import { DEFAULT_ENABLED_SETUP_IDS, type SimpleBacktestInput } from '@marketmind/types';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { trpc } from '../../../utils/trpc';
import type { SetField } from '../BacktestForm';

interface StrategiesTabProps {
  state: SimpleBacktestInput;
  setField: SetField;
}

const STATUS_PALETTE: Record<string, string> = {
  active: 'green',
  experimental: 'yellow',
  deprecated: 'gray',
  unprofitable: 'red',
};

export const StrategiesTab = ({ state, setField }: StrategiesTabProps) => {
  const { t } = useTranslation();
  const [includeExperimental, setIncludeExperimental] = useState(false);

  const excludeStatuses = useMemo<('deprecated' | 'unprofitable' | 'experimental')[]>(() => {
    return includeExperimental
      ? ['deprecated', 'unprofitable']
      : ['deprecated', 'unprofitable', 'experimental'];
  }, [includeExperimental]);

  const query = trpc.setupDetection.listStrategies.useQuery({ excludeStatuses });

  const selected = useMemo<Set<string>>(() => {
    return new Set(state.setupTypes ?? [...DEFAULT_ENABLED_SETUP_IDS]);
  }, [state.setupTypes]);

  const allStrategies = query.data ?? [];

  const toggleStrategy = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setField('setupTypes', Array.from(next));
  };

  // Override one strategy parameter. Writes to `state.strategyParams`
  // (a flat record keyed by param name; collisions across strategies
  // are accepted — the optimizer assumes param names are unique within
  // an active strategy set, which is fine because each .pine declares
  // its own `input.*` namespace).
  const setStrategyParam = (key: string, value: number | undefined) => {
    const next = { ...(state.strategyParams ?? {}) };
    if (value === undefined || Number.isNaN(value)) delete next[key];
    else next[key] = value;
    setField('strategyParams', Object.keys(next).length > 0 ? next : undefined);
  };

  const selectAll = () => {
    setField('setupTypes', allStrategies.map((s) => s.id));
  };

  const selectDefaults = () => {
    setField('setupTypes', [...DEFAULT_ENABLED_SETUP_IDS]);
  };

  const deselectAll = () => {
    setField('setupTypes', []);
  };

  const intervalRecommendationMismatch = useMemo(() => {
    if (selected.size === 0) return false;
    const selectedDefs = allStrategies.filter((s) => selected.has(s.id));
    if (selectedDefs.length === 0) return false;
    return selectedDefs.every((s) => {
      const tf = s.recommendedTimeframes;
      if (!tf) return false;
      const allowed: string[] = [];
      if (tf.primary) allowed.push(tf.primary);
      if (tf.secondary) allowed.push(...tf.secondary);
      if (allowed.length === 0) return false;
      return !allowed.includes(state.interval);
    });
  }, [allStrategies, selected, state.interval]);

  return (
    <VStack align="stretch" gap={3}>
      <HStack justify="space-between">
        <HStack gap={2}>
          <Button size="2xs" variant="outline" onClick={selectAll}>{t('backtest.strategies.selectAll')}</Button>
          <Button size="2xs" variant="outline" onClick={selectDefaults}>{t('backtest.strategies.selectDefaults')}</Button>
          <Button size="2xs" variant="ghost" onClick={deselectAll}>{t('backtest.strategies.deselectAll')}</Button>
        </HStack>
        <HStack gap={2}>
          <Text fontSize="xs" color="fg.muted">{t('backtest.strategies.showExperimental')}</Text>
          <Switch
            checked={includeExperimental}
            onCheckedChange={setIncludeExperimental}
          />
        </HStack>
      </HStack>

      {intervalRecommendationMismatch && (
        <Callout
          tone="warning"
          compact
          title={t('backtest.strategies.intervalMismatchTitle')}
        >
          {t('backtest.strategies.intervalMismatchBody', { interval: state.interval })}
        </Callout>
      )}

      {query.isLoading && <Flex justify="center" py={8}><LoadingSpinner /></Flex>}

      {query.isError && (
        <Callout tone="danger" compact>
          {t('backtest.strategies.loadFailed')}
        </Callout>
      )}

      {query.data && (
        <VStack align="stretch" gap={1} maxH="380px" overflowY="auto" pr={2}>
          {allStrategies.length === 0 && (
            <Text color="fg.muted" fontSize="sm">{t('backtest.strategies.empty')}</Text>
          )}
          {allStrategies.map((s) => (
            <Box
              key={s.id}
              p={2}
              borderWidth="1px"
              borderColor={selected.has(s.id) ? 'blue.muted' : 'border'}
              borderRadius="md"
              cursor="pointer"
              onClick={() => toggleStrategy(s.id)}
              _hover={{ bg: 'bg.subtle' }}
            >
              <HStack align="start" gap={3}>
                <Checkbox
                  checked={selected.has(s.id)}
                  onCheckedChange={() => toggleStrategy(s.id)}
                />
                <VStack align="stretch" flex={1} gap={1}>
                  <HStack justify="space-between">
                    <HStack gap={2} flex={1} minW={0}>
                      <Text fontSize="sm" fontWeight="medium">{s.name}</Text>
                      {s.requiresTimeframes && s.requiresTimeframes.length > 0 && (
                        <Badge colorPalette="purple" size="xs" data-testid={`htf-badge-${s.id}`}>
                          {t('backtest.strategies.htfBadge', { tfs: s.requiresTimeframes.join(', ') })}
                        </Badge>
                      )}
                    </HStack>
                    <Badge colorPalette={STATUS_PALETTE[s.status] ?? 'gray'} size="xs">{s.status}</Badge>
                  </HStack>
                  {s.description && (
                    <Text fontSize="xs" color="fg.muted">{s.description}</Text>
                  )}
                  {s.tags && s.tags.length > 0 && (
                    <HStack gap={1} flexWrap="wrap">
                      {s.tags.slice(0, 5).map((tag) => (
                        <Badge key={tag} size="xs" variant="subtle">{tag}</Badge>
                      ))}
                    </HStack>
                  )}
                  {/*
                    Per-param editor — only renders when:
                      (1) the strategy is selected, AND
                      (2) it actually declares `input.*` parameters.
                    Each input writes to `state.strategyParams[key]`,
                    overriding the .pine default. Empty value (the
                    user clears the field) deletes the override so the
                    strategy falls back to its declared default.
                  */}
                  {selected.has(s.id) && s.parameters && s.parameters.length > 0 && (
                    <Box
                      mt={1}
                      pt={2}
                      borderTopWidth="1px"
                      borderColor="border"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Text fontSize="2xs" color="fg.muted" textTransform="uppercase" mb={1.5}>
                        {t('backtest.strategies.paramsTitle')}
                      </Text>
                      <Grid templateColumns="repeat(2, 1fr)" gap={2}>
                        {s.parameters.map((p) => {
                          const override = state.strategyParams?.[p.key];
                          return (
                            <Field key={p.key} label={p.key} helperText={p.description ?? undefined}>
                              <NumberInput
                                value={override ?? p.default}
                                onChange={(e) => {
                                  const raw = e.target.value;
                                  if (raw === '') setStrategyParam(p.key, undefined);
                                  else setStrategyParam(p.key, Number(raw));
                                }}
                                min={p.min}
                                max={p.max}
                                step={p.step ?? 1}
                                size="xs"
                                data-testid={`param-${s.id}-${p.key}`}
                              />
                            </Field>
                          );
                        })}
                      </Grid>
                    </Box>
                  )}
                </VStack>
              </HStack>
            </Box>
          ))}
        </VStack>
      )}
    </VStack>
  );
};
