import { Box, Flex, HStack, Text, VStack } from '@chakra-ui/react';
import { Alert, Badge, Button, Checkbox, LoadingSpinner, Switch } from '@renderer/components/ui';
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
        <Alert.Root status="warning">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>{t('backtest.strategies.intervalMismatchTitle')}</Alert.Title>
            <Alert.Description>
              {t('backtest.strategies.intervalMismatchBody', { interval: state.interval })}
            </Alert.Description>
          </Alert.Content>
        </Alert.Root>
      )}

      {query.isLoading && <Flex justify="center" py={8}><LoadingSpinner /></Flex>}

      {query.isError && (
        <Alert.Root status="error">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Description>{t('backtest.strategies.loadFailed')}</Alert.Description>
          </Alert.Content>
        </Alert.Root>
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
              borderColor={selected.has(s.id) ? 'blue.500' : 'border'}
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
                    <Text fontSize="sm" fontWeight="medium">{s.name}</Text>
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
                </VStack>
              </HStack>
            </Box>
          ))}
        </VStack>
      )}
    </VStack>
  );
};
