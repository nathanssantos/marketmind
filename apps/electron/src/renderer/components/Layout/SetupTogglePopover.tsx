import {
    Box,
    Flex,
    IconButton,
    Stack,
    Text,
} from '@chakra-ui/react';
import type { StrategyDefinition } from '@marketmind/types';
import { memo, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HiAdjustmentsHorizontal } from 'react-icons/hi2';
import { useActiveWallet } from '../../hooks/useActiveWallet';
import { useStrategyList } from '../../hooks/useSetupDetection';
import { trpc } from '../../utils/trpc';
import { Checkbox } from '../ui/checkbox';
import { Popover } from '../ui/popover';
import { TooltipWrapper } from '../ui/Tooltip';

export const SetupTogglePopover = memo(() => {
    const { t } = useTranslation();
    const { activeWallet } = useActiveWallet();
    const walletId = activeWallet?.id;
    const [isOpen, setIsOpen] = useState(false);
    const utils = trpc.useUtils();

    const { data: config, isLoading: isLoadingConfig } = trpc.autoTrading.getConfig.useQuery(
        { walletId: walletId ?? '' },
        { enabled: !!walletId }
    );

    const updateConfigMutation = trpc.autoTrading.updateConfig.useMutation({
        onSuccess: () => {
            utils.autoTrading.getConfig.invalidate();
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

    const toggleSetup = useCallback((strategyId: string): void => {
        if (!walletId) return;

        const isEnabled = enabledStrategies.includes(strategyId);
        const newEnabledStrategies = isEnabled
            ? enabledStrategies.filter(id => id !== strategyId)
            : [...enabledStrategies, strategyId];

        updateConfigMutation.mutate({
            walletId,
            enabledSetupTypes: newEnabledStrategies,
        });
    }, [walletId, enabledStrategies, updateConfigMutation]);

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
    const allEnabled = setupList.length > 0 && setupList.every((s: { value: string }) => enabledStrategies.includes(s.value));
    const enabledCount = setupList.filter((s: { value: string }) => enabledStrategies.includes(s.value)).length;

    if (!walletId) {
        return null;
    }

    return (
        <Popover
            open={isOpen}
            onOpenChange={(e) => setIsOpen(e.open)}
            showArrow={false}
            width="320px"
            positioning={{ placement: 'bottom-start', offset: { mainAxis: 8 } }}
            trigger={
                <Flex>
                    <TooltipWrapper label={t('setupConfig.configureSetups')} showArrow placement="top" isDisabled={isOpen}>
                        <IconButton
                            aria-label={t('setupConfig.configureSetups')}
                            size="2xs"
                            variant="solid"
                            colorPalette="blue"
                        >
                            <HiAdjustmentsHorizontal />
                        </IconButton>
                    </TooltipWrapper>
                </Flex>
            }
        >
            <Box p={4} maxH="500px" overflowY="auto">
                <Stack gap={4}>
                    <Flex justify="space-between" align="center">
                        <Text fontSize="sm" fontWeight="bold">
                            {t('setupConfig.enabledSetups')}
                        </Text>
                        <Text fontSize="xs" color="fg.muted">
                            {enabledCount}/{setupList.length}
                        </Text>
                    </Flex>

                    <Box>
                        <Checkbox
                            checked={allEnabled}
                            onCheckedChange={toggleAll}
                            disabled={updateConfigMutation.isPending}
                        >
                            <Text fontWeight="semibold" fontSize="sm">
                                {t('setupConfig.toggleAll')}
                            </Text>
                        </Checkbox>
                    </Box>

                    <Box h="1px" bg="border" />

                    <Stack gap={2} maxH="400px" overflowY="auto">
                        {isLoading ? (
                            <Text fontSize="sm" color="fg.muted" textAlign="center" py={4}>
                                {t('common.loading')}
                            </Text>
                        ) : setupList.length === 0 ? (
                            <Text fontSize="sm" color="fg.muted" textAlign="center" py={4}>
                                {t('setupConfig.noStrategiesAvailable')}
                            </Text>
                        ) : (
                            setupList.map((setup: { value: string; title: string }) => (
                                <Box key={setup.value}>
                                    <Checkbox
                                        checked={enabledStrategies.includes(setup.value)}
                                        onCheckedChange={() => toggleSetup(setup.value)}
                                        disabled={updateConfigMutation.isPending}
                                    >
                                        <Text fontSize="sm">
                                            {setup.title}
                                        </Text>
                                    </Checkbox>
                                </Box>
                            ))
                        )}
                    </Stack>
                </Stack>
            </Box>
        </Popover>
    );
});

SetupTogglePopover.displayName = 'SetupTogglePopover';
