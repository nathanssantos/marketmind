import { Switch } from '@/renderer/components/ui/switch';
import { useSetupStore } from '@/renderer/store/setupStore';
import { Box, Separator, Stack, Text } from '@chakra-ui/react';
import { useToast } from '@renderer/hooks/useToast';
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';

export const AlgorithmicAutoTradingTab = (): ReactElement => {
    const { t } = useTranslation();
    const toast = useToast();
    const { isAutoTradingActive, toggleAutoTrading, config: setupConfig } = useSetupStore();
    const isSetupDetectionActive = (setupConfig.enabledStrategies?.length ?? 0) > 0;

    const handleToggleAutoTrading = (checked: boolean): void => {
        if (checked && !isSetupDetectionActive) {
            toast.error(
                t('setupConfig.noSetupsEnabled'),
                t('setupConfig.noSetupsEnabledDescription')
            );
            return;
        }

        toggleAutoTrading();
    };

    return (
        <Stack gap={6}>
            <Box>
                <Text fontSize="lg" fontWeight="bold" mb={1}>
                    {t('settings.algorithmicAutoTrading.title')}
                </Text>
                <Text fontSize="sm" color="fg.muted">
                    {t('settings.algorithmicAutoTrading.description')}
                </Text>
            </Box>

            <Separator />

            <Stack gap={4}>
                <Box>
                    <Text fontSize="md" fontWeight="semibold" mb={2}>
                        {t('settings.algorithmicAutoTrading.status.title')}
                    </Text>
                    <Text fontSize="sm" color="fg.muted" mb={4}>
                        {t('settings.algorithmicAutoTrading.status.description')}
                    </Text>

                    <Stack gap={4}>
                        <Box
                            p={4}
                            borderRadius="md"
                            borderWidth="1px"
                            borderColor={isAutoTradingActive ? 'green.500' : 'border'}
                            bg={isAutoTradingActive ? 'green.50' : 'bg.subtle'}
                            _dark={{
                                bg: isAutoTradingActive ? 'green.950' : 'bg.subtle',
                            }}
                        >
                            <Stack gap={3}>
                                <Box display="flex" alignItems="center" justifyContent="space-between">
                                    <Box>
                                        <Text fontSize="sm" fontWeight="semibold">
                                            {t('setupConfig.status.autoTrading')}
                                        </Text>
                                        <Text fontSize="xs" color="fg.muted" mt={1}>
                                            {isAutoTradingActive
                                                ? t('settings.algorithmicAutoTrading.status.active')
                                                : t('settings.algorithmicAutoTrading.status.inactive')
                                            }
                                        </Text>
                                    </Box>
                                    <Switch
                                        checked={isAutoTradingActive}
                                        onCheckedChange={handleToggleAutoTrading}
                                        size="lg"
                                    />
                                </Box>
                                {!isSetupDetectionActive && (
                                    <Box
                                        p={2}
                                        borderRadius="sm"
                                        bg="orange.50"
                                        borderWidth="1px"
                                        borderColor="orange.200"
                                        _dark={{
                                            bg: 'orange.950',
                                            borderColor: 'orange.800',
                                        }}
                                    >
                                        <Text fontSize="xs" color="orange.700" _dark={{ color: 'orange.300' }}>
                                            ⚠️ {t('setupConfig.noSetupsEnabledDescription')}
                                        </Text>
                                    </Box>
                                )}
                            </Stack>
                        </Box>

                        <Box
                            p={3}
                            borderRadius="md"
                            bg="blue.50"
                            borderWidth="1px"
                            borderColor="blue.200"
                            _dark={{
                                bg: 'blue.950',
                                borderColor: 'blue.800',
                            }}
                        >
                            <Text fontSize="xs" color="blue.700" _dark={{ color: 'blue.300' }}>
                                💡 {t('settings.algorithmicAutoTrading.status.info')}
                            </Text>
                        </Box>
                    </Stack>
                </Box>
            </Stack>
        </Stack>
    );
};
