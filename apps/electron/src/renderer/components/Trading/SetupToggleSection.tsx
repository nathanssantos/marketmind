import { Checkbox } from '@renderer/components/ui';
import { Box, Collapsible, Flex, SimpleGrid, Stack, Text } from '@chakra-ui/react';
import type { StrategyDefinition } from '@marketmind/types';
import { memo, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuChevronDown, LuChevronUp } from 'react-icons/lu';
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

  const [setupsExpanded, setSetupsExpanded] = useState(false);

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

  return (
    <Box>
      <Flex
        justify="space-between"
        align="center"
        cursor="pointer"
        onClick={() => setSetupsExpanded(!setupsExpanded)}
        _hover={{ bg: 'bg.muted' }}
        p={2}
        mx={-2}
        borderRadius="md"
      >
        <Box>
          <Flex align="center" gap={2}>
            <Text fontSize="lg" fontWeight="bold">
              {t('setupConfig.enabledSetups')}
            </Text>
            <Box
              px={2}
              py={0.5}
              bg={enabledCount === setupList.length ? 'green.subtle' : 'blue.subtle'}
              color={enabledCount === setupList.length ? 'green.fg' : 'blue.fg'}
              borderRadius="full"
              fontSize="xs"
              fontWeight="medium"
            >
              {enabledCount}/{setupList.length}
            </Box>
          </Flex>
          <Text fontSize="sm" color="fg.muted">
            {t('setupConfig.enabledSetupsDescription', 'Select which trading setups the watchers will monitor')}
          </Text>
        </Box>
        {setupsExpanded ? <LuChevronUp size={20} /> : <LuChevronDown size={20} />}
      </Flex>

      <Collapsible.Root open={setupsExpanded}>
        <Collapsible.Content>
          <Stack gap={4} mt={4}>
            <Box>
              <Checkbox checked={allEnabled} onCheckedChange={toggleAll} disabled={updateConfigMutation.isPending}>
                <Text fontWeight="semibold" fontSize="sm">
                  {t('setupConfig.toggleAll')}
                </Text>
              </Checkbox>
            </Box>

            {isLoading ? (
              <Box p={4} textAlign="center">
                <Text fontSize="sm" color="fg.muted">
                  {t('common.loading')}
                </Text>
              </Box>
            ) : setupList.length === 0 ? (
              <Box p={4} textAlign="center">
                <Text fontSize="sm" color="fg.muted">
                  {t('setupConfig.noStrategiesAvailable')}
                </Text>
              </Box>
            ) : (
              <SimpleGrid columns={{ base: 1, md: 2 }} gap={2}>
                {setupList.map((setup: { value: string; title: string }) => (
                  <Box
                    key={setup.value}
                    p={2}
                    bg="bg.muted"
                    borderRadius="md"
                    borderLeft="3px solid"
                    borderColor={enabledStrategies.includes(setup.value) ? 'trading.profit' : 'border'}
                  >
                    <Checkbox
                      checked={enabledStrategies.includes(setup.value)}
                      onCheckedChange={() => toggleSetup(setup.value)}
                      disabled={updateConfigMutation.isPending}
                    >
                      <Text fontSize="sm">{setup.title}</Text>
                    </Checkbox>
                  </Box>
                ))}
              </SimpleGrid>
            )}
          </Stack>
        </Collapsible.Content>
      </Collapsible.Root>
    </Box>
  );
});

SetupToggleSection.displayName = 'SetupToggleSection';
