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
import { useSetupStore } from '../../store/setupStore';
import { Checkbox } from '../ui/checkbox';
import { Popover } from '../ui/popover';
import { TooltipWrapper } from '../ui/Tooltip';

type SetupKey = 'setup91' | 'setup92' | 'setup93' | 'setup94' | 'pattern123' | 'bullTrap' | 'bearTrap' | 'breakoutRetest' | 'pinInside' | 'orderBlockFVG' | 'vwapEmaCross' | 'divergence' | 'liquiditySweep' | 'meanReversion' | 'gridTrading' | 'marketMaking';

const SETUP_LIST: Array<{ value: SetupKey; titleKey: string }> = [
    { value: 'setup91', titleKey: 'setupConfig.setups.setup91.title' },
    { value: 'setup92', titleKey: 'setupConfig.setups.setup92.title' },
    { value: 'setup93', titleKey: 'setupConfig.setups.setup93.title' },
    { value: 'setup94', titleKey: 'setupConfig.setups.setup94.title' },
    { value: 'pattern123', titleKey: 'setupConfig.setups.pattern123.title' },
    { value: 'bullTrap', titleKey: 'setupConfig.setups.bullTrap.title' },
    { value: 'bearTrap', titleKey: 'setupConfig.setups.bearTrap.title' },
    { value: 'breakoutRetest', titleKey: 'setupConfig.setups.breakoutRetest.title' },
    { value: 'pinInside', titleKey: 'setupConfig.setups.pinInside.title' },
    { value: 'orderBlockFVG', titleKey: 'setupConfig.setups.orderBlockFVG.title' },
    { value: 'vwapEmaCross', titleKey: 'setupConfig.setups.vwapEmaCross.title' },
    { value: 'divergence', titleKey: 'setupConfig.setups.divergence.title' },
    { value: 'liquiditySweep', titleKey: 'setupConfig.setups.liquiditySweep.title' },
    { value: 'meanReversion', titleKey: 'setupConfig.setups.meanReversion.title' },
    { value: 'gridTrading', titleKey: 'setupConfig.setups.gridTrading.title' },
    { value: 'marketMaking', titleKey: 'setupConfig.setups.marketMaking.title' },
];

export const SetupTogglePopover = memo(() => {
    const { t } = useTranslation();
    const { config, updateSetupConfig } = useSetupStore();
    const [isOpen, setIsOpen] = useState(false);

    const toggleSetup = (setupKey: SetupKey): void => {
        updateSetupConfig(setupKey, {
            enabled: !config[setupKey].enabled,
        });
    };

    const toggleAll = (): void => {
        const allEnabled = SETUP_LIST.every(s => config[s.value].enabled);

        SETUP_LIST.forEach(setup => {
            updateSetupConfig(setup.value, {
                enabled: !allEnabled,
            });
        });
    };

    const allEnabled = SETUP_LIST.every(s => config[s.value].enabled);
    const enabledCount = SETUP_LIST.filter(s => config[s.value].enabled).length;

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
                            {enabledCount}/10
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
                        {SETUP_LIST.map((setup) => (
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
