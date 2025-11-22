import { Button } from '@/renderer/components/ui/button';
import { useTradingStore } from '@/renderer/store/tradingStore';
import { Box, Flex, Separator, Stack, Text } from '@chakra-ui/react';
import { useTranslation } from 'react-i18next';
import { LuTrash2 } from 'react-icons/lu';

export const TradingSimulatorTab = () => {
    const { t } = useTranslation();
    const { wallets, orders, clearAllData } = useTradingStore();

    const handleClearAll = () => {
        if (window.confirm(t('settings.tradingSimulator.confirmClearAll'))) {
            clearAllData();
        }
    };

    return (
        <Stack gap={6}>
            <Box>
                <Text fontSize="lg" fontWeight="bold" mb={1}>
                    {t('settings.tradingSimulator.title')}
                </Text>
                <Text fontSize="sm" color="fg.muted">
                    {t('settings.tradingSimulator.description')}
                </Text>
            </Box>

            <Separator />

            <Stack gap={4}>
                <Box>
                    <Text fontSize="md" fontWeight="semibold" mb={2}>
                        {t('settings.tradingSimulator.statistics.title')}
                    </Text>
                    <Stack gap={2} fontSize="sm">
                        <Flex justify="space-between">
                            <Text color="fg.muted">{t('settings.tradingSimulator.statistics.wallets')}</Text>
                            <Text fontWeight="medium">{wallets.length}</Text>
                        </Flex>
                        <Flex justify="space-between">
                            <Text color="fg.muted">{t('settings.tradingSimulator.statistics.orders')}</Text>
                            <Text fontWeight="medium">{orders.length}</Text>
                        </Flex>
                        <Flex justify="space-between">
                            <Text color="fg.muted">{t('settings.tradingSimulator.statistics.activeOrders')}</Text>
                            <Text fontWeight="medium" color="green.500">
                                {orders.filter(o => o.status === 'active').length}
                            </Text>
                        </Flex>
                        <Flex justify="space-between">
                            <Text color="fg.muted">{t('settings.tradingSimulator.statistics.pendingOrders')}</Text>
                            <Text fontWeight="medium" color="orange.500">
                                {orders.filter(o => o.status === 'pending').length}
                            </Text>
                        </Flex>
                    </Stack>
                </Box>

                <Separator />

                <Box>
                    <Text fontSize="md" fontWeight="semibold" mb={2}>
                        {t('settings.tradingSimulator.dangerZone.title')}
                    </Text>
                    <Text fontSize="sm" color="fg.muted" mb={4}>
                        {t('settings.tradingSimulator.dangerZone.description')}
                    </Text>
                    <Button
                        size="2xs"
                        colorPalette="red"
                        onClick={handleClearAll}
                        disabled={wallets.length === 0 && orders.length === 0}
                    >
                        <LuTrash2 />
                        {t('settings.tradingSimulator.dangerZone.clearAll')}
                    </Button>
                </Box>
            </Stack>
        </Stack>
    );
};
