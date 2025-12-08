import {
    Box,
    Flex,
    IconButton,
    Stack,
    Text,
} from '@chakra-ui/react';
import { memo, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HiAdjustmentsHorizontal } from 'react-icons/hi2';
import type { SetupDetectionConfig } from '../../store/setupConfig';
import { useSetupStore } from '../../store/setupStore';
import { Checkbox } from '../ui/checkbox';
import { Popover } from '../ui/popover';
import { TooltipWrapper } from '../ui/Tooltip';

type SetupKey = keyof Omit<SetupDetectionConfig, 'enableTrendFilter' | 'allowCounterTrend' | 'trendEmaPeriod' | 'setupCooldownPeriod'>;

const EXCLUDED_CONFIG_KEYS = new Set(['enableTrendFilter', 'allowCounterTrend', 'trendEmaPeriod', 'setupCooldownPeriod']);

const isSetupKey = (key: string, config: SetupDetectionConfig): key is SetupKey => {
    if (EXCLUDED_CONFIG_KEYS.has(key)) return false;
    const value = config[key as keyof SetupDetectionConfig];
    return typeof value === 'object' && value !== null && 'enabled' in value;
};

export const SetupTogglePopover = memo(() => {
    const { t } = useTranslation();
    const { config, updateSetupConfig } = useSetupStore();
    const [isOpen, setIsOpen] = useState(false);

    const setupList = useMemo(() =>
        Object.keys(config)
            .filter((key): key is SetupKey => isSetupKey(key, config))
            .sort((a, b) => a.localeCompare(b))
            .map(key => ({
                value: key,
                titleKey: `setupConfig.setups.${key}.title`,
            })),
        [config]
    );

    const toggleSetup = (setupKey: SetupKey): void => {
        updateSetupConfig(setupKey, {
            enabled: !config[setupKey].enabled,
        });
    };

    const toggleAll = (): void => {
        const allEnabled = setupList.every(s => config[s.value].enabled);

        setupList.forEach(setup => {
            updateSetupConfig(setup.value, {
                enabled: !allEnabled,
            });
        });
    };

    const allEnabled = setupList.every(s => config[s.value].enabled);
    const enabledCount = setupList.filter(s => config[s.value].enabled).length;

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

                    <Stack gap={2}>
                        {setupList.map((setup) => (
                            <TooltipWrapper
                                key={setup.value}
                                label={t(`setupConfig.setups.${setup.value}.description`)}
                                placement="right"
                                showArrow
                            >
                                <Box>
                                    <Checkbox
                                        checked={config[setup.value].enabled}
                                        onCheckedChange={() => toggleSetup(setup.value)}
                                    >
                                        <Text fontSize="sm">
                                            {t(setup.titleKey)}
                                        </Text>
                                    </Checkbox>
                                </Box>
                            </TooltipWrapper>
                        ))}
                    </Stack>
                </Stack>
            </Box>
        </Popover>
    );
});

SetupTogglePopover.displayName = 'SetupTogglePopover';
