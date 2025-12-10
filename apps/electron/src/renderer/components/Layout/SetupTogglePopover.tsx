import {
    Box,
    Flex,
    IconButton,
    Stack,
    Text,
} from '@chakra-ui/react';
import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HiAdjustmentsHorizontal } from 'react-icons/hi2';
import { useStrategyList } from '../../hooks/useSetupDetection';
import { useSetupStore } from '../../store/setupStore';
import { Checkbox } from '../ui/checkbox';
import { Popover } from '../ui/popover';
import { TooltipWrapper } from '../ui/Tooltip';

export const SetupTogglePopover = memo(() => {
    const { t } = useTranslation();
    const { config, setConfig } = useSetupStore();
    const [isOpen, setIsOpen] = useState(false);

    const { data: strategies, isLoading } = useStrategyList({
        excludeStatuses: ['unprofitable', 'deprecated'],
    });

    const setupList = (strategies ?? []).map((strategy: { id: string; name: string }) => ({
        value: strategy.id,
        title: strategy.name,
    }));

    const toggleSetup = (strategyId: string): void => {
        const enabledStrategies = config.enabledStrategies ?? [];
        const isEnabled = enabledStrategies.includes(strategyId);

        setConfig({
            enabledStrategies: isEnabled
                ? enabledStrategies.filter(id => id !== strategyId)
                : [...enabledStrategies, strategyId],
        });
    };

    const toggleAll = (): void => {
        const allEnabled = setupList.every((s: { value: string }) => config.enabledStrategies?.includes(s.value));

        setConfig({
            enabledStrategies: allEnabled ? [] : setupList.map((s: { value: string }) => s.value),
        });
    };

    const enabledStrategies = config.enabledStrategies ?? [];
    const allEnabled = setupList.length > 0 && setupList.every((s: { value: string }) => enabledStrategies.includes(s.value));
    const enabledCount = enabledStrategies.length;

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
                            colorPalette="green"
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
