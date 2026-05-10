import { Badge, CollapsibleSection, Input, LoadingSpinner, Switch } from '@renderer/components/ui';
import { Box, SimpleGrid, Stack, Text } from '@chakra-ui/react';
import type { StrategyDefinition } from '@marketmind/types';
import { memo, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useActiveWallet } from '../../hooks/useActiveWallet';
import { useStrategyList } from '../../hooks/useSetupDetection';
import { trpc } from '../../utils/trpc';

export const SetupToggleSection = memo(() => {
  const { t } = useTranslation();
  const { activeWallet } = useActiveWallet();
  const walletId = activeWallet?.id;
  const utils = trpc.useUtils();

  const { data: config, isLoading: isLoadingConfig } = trpc.autoTrading.getConfig.useQuery(
    { walletId: walletId ?? '' },
    { enabled: !!walletId }
  );

  const updateConfigMutation = trpc.autoTrading.updateConfig.useMutation({
    onSuccess: () => {
      void utils.autoTrading.getConfig.invalidate();
    },
  });

  const { data: strategies, isLoading: isLoadingStrategies } = useStrategyList({
    excludeStatuses: ['unprofitable', 'deprecated'],
  });

  const setupList = useMemo(() => {
    return (strategies ?? [])
      .filter((strategy: StrategyDefinition) => strategy.enabled)
      .map((strategy: StrategyDefinition) => ({
        value: strategy.id,
        title: strategy.name,
      }));
  }, [strategies]);

  const enabledStrategies = useMemo(() => config?.enabledSetupTypes ?? [], [config?.enabledSetupTypes]);

  const [search, setSearch] = useState('');

  const filteredSetups = useMemo(() => {
    if (!search.trim()) return setupList;
    const q = search.toLowerCase();
    return setupList.filter((s: { value: string; title: string }) => s.title.toLowerCase().includes(q) || s.value.toLowerCase().includes(q));
  }, [setupList, search]);

  const toggleSetup = useCallback(
    (strategyId: string): void => {
      if (!walletId) return;

      const isEnabled = enabledStrategies.includes(strategyId);
      const newEnabledStrategies = isEnabled
        ? enabledStrategies.filter((id) => id !== strategyId)
        : [...enabledStrategies, strategyId];

      updateConfigMutation.mutate({
        walletId,
        enabledSetupTypes: newEnabledStrategies,
      });
    },
    [walletId, enabledStrategies, updateConfigMutation]
  );

  const toggleAll = useCallback((): void => {
    if (!walletId) return;

    const allEnabled = setupList.every((s: { value: string }) => enabledStrategies.includes(s.value));
    const newEnabledStrategies = allEnabled ? [] : setupList.map((s: { value: string }) => s.value);

    updateConfigMutation.mutate({
      walletId,
      enabledSetupTypes: newEnabledStrategies,
    });
  }, [walletId, setupList, enabledStrategies, updateConfigMutation]);

  const isLoading = isLoadingConfig || isLoadingStrategies;
  const allEnabled =
    setupList.length > 0 && setupList.every((s: { value: string }) => enabledStrategies.includes(s.value));
  const enabledCount = setupList.filter((s: { value: string }) => enabledStrategies.includes(s.value)).length;

  if (!walletId) {
    return (
      <Box p={4} textAlign="center">
        <Text fontSize="sm" color="fg.muted">
          {t('tradingProfiles.noWallet')}
        </Text>
      </Box>
    );
  }

  const countBadge = (
    <Badge colorPalette={enabledCount === setupList.length ? 'green' : 'gray'} size="sm">
      {enabledCount}/{setupList.length}
    </Badge>
  );

  return (
    <CollapsibleSection
      title={t('setupConfig.enabledSetups')}
      description={t('setupConfig.enabledSetupsDescription')}
      defaultOpen={false}
      size="lg"
      badge={countBadge}
    >
      <Stack gap={3}>
        <Switch checked={allEnabled} onCheckedChange={toggleAll} disabled={updateConfigMutation.isPending}>
          <Text fontWeight="semibold" fontSize="sm">
            {t('setupConfig.toggleAll')}
          </Text>
        </Switch>

        {setupList.length > 8 && (
          <Input
            placeholder={t('common.search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            size="sm"
          />
        )}

        {isLoading ? (
          <Box p={4}>
            <LoadingSpinner />
          </Box>
        ) : filteredSetups.length === 0 ? (
          <Box p={4} textAlign="center">
            <Text fontSize="sm" color="fg.muted">
              {search ? t('common.noResults') : t('setupConfig.noStrategiesAvailable')}
            </Text>
          </Box>
        ) : (
          <SimpleGrid columns={{ base: 1, md: 2 }} gap={1}>
            {filteredSetups.map((setup: { value: string; title: string }) => (
              <Box
                key={setup.value}
                px={2}
                py={1}
                borderRadius="md"
                _hover={{ bg: 'bg.muted' }}
              >
                <Switch
                  checked={enabledStrategies.includes(setup.value)}
                  onCheckedChange={() => toggleSetup(setup.value)}
                  disabled={updateConfigMutation.isPending}
                >
                  <Text fontSize="sm">{setup.title}</Text>
                </Switch>
              </Box>
            ))}
          </SimpleGrid>
        )}
      </Stack>
    </CollapsibleSection>
  );
});

SetupToggleSection.displayName = 'SetupToggleSection';
