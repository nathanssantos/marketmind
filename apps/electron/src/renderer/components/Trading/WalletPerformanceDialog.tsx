import { Box, CloseButton, Flex, Stack, Text } from '@chakra-ui/react';
import { Dialog } from '@renderer/components/ui/dialog';
import { useBackendWallet } from '@renderer/hooks/useBackendWallet';
import { useTranslation } from 'react-i18next';

interface WalletPerformanceDialogProps {
    isOpen: boolean;
    onClose: () => void;
    walletId: string | null;
}

export const WalletPerformanceDialog = ({ isOpen, onClose, walletId }: WalletPerformanceDialogProps) => {
    const { t } = useTranslation();
    const { wallets } = useBackendWallet();
    const backendWallet = wallets.find(w => w.id === walletId);

    if (!backendWallet) return null;

    const wallet = {
        id: backendWallet.id,
        name: backendWallet.name,
        balance: parseFloat(backendWallet.currentBalance || '0'),
        initialBalance: parseFloat(backendWallet.initialBalance || '0'),
        currency: (backendWallet.currency || 'USDT') as string,
        createdAt: new Date(backendWallet.createdAt),
    };

    const totalPnL = wallet.balance - wallet.initialBalance;
    const totalPnLPercent = wallet.initialBalance > 0 ? ((totalPnL / wallet.initialBalance) * 100) : 0;
    const isProfitable = totalPnL >= 0;

    const tradeDays = Math.max(1, Math.ceil((Date.now() - wallet.createdAt.getTime()) / (1000 * 60 * 60 * 24)));
    const avgDailyReturn = tradeDays > 1 ? totalPnL / tradeDays : 0;

    return (
        <Dialog.Root open={isOpen} onOpenChange={(e) => !e.open && onClose()} size="xl">
            <Dialog.Backdrop />
            <Dialog.Positioner>
                <Dialog.Content maxH="85vh">
                    <CloseButton
                        position="absolute"
                        top={4}
                        right={4}
                        onClick={onClose}
                        size="sm"
                    />
                    <Dialog.Header>
                        <Dialog.Title>{t('trading.wallets.performanceTitle', { name: wallet.name })}</Dialog.Title>
                    </Dialog.Header>

                    <Dialog.Body overflowY="auto">
                        <Stack gap={4}>
                            <Flex wrap="wrap" gap={2}>
                                <Box flex="1" minW="180px" p={3} bg="bg.muted" borderRadius="md">
                                    <Text fontSize="xs" color="fg.muted" mb={1}>{t('trading.wallets.currentBalance')}</Text>
                                    <Text fontSize="md" fontWeight="bold">
                                        {wallet.currency} {wallet.balance.toLocaleString(undefined, {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 2
                                        })}
                                    </Text>
                                </Box>

                                <Box flex="1" minW="180px" p={3} bg="bg.muted" borderRadius="md">
                                    <Text fontSize="xs" color="fg.muted" mb={1}>{t('trading.wallets.totalPnL')}</Text>
                                    <Text
                                        fontSize="md"
                                        fontWeight="bold"
                                        color={isProfitable ? 'green.500' : 'red.500'}
                                    >
                                        {isProfitable ? '+' : ''}{totalPnL.toLocaleString(undefined, {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 2
                                        })}
                                        {' '}({isProfitable ? '+' : ''}{totalPnLPercent.toFixed(2)}%)
                                    </Text>
                                </Box>

                                <Box flex="1" minW="180px" p={3} bg="bg.muted" borderRadius="md">
                                    <Text fontSize="xs" color="fg.muted" mb={1}>{t('trading.wallets.tradeDays')}</Text>
                                    <Text fontSize="md" fontWeight="bold">{tradeDays}</Text>
                                </Box>

                                <Box flex="1" minW="180px" p={3} bg="bg.muted" borderRadius="md">
                                    <Text fontSize="xs" color="fg.muted" mb={1}>{t('trading.wallets.avgDailyReturn')}</Text>
                                    <Text fontSize="md" fontWeight="bold">
                                        {wallet.currency} {avgDailyReturn.toLocaleString(undefined, {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 2
                                        })}
                                    </Text>
                                </Box>
                            </Flex>

                            <Box p={4} textAlign="center" color="fg.muted">
                                <Text fontSize="sm">
                                    {t('trading.wallets.performanceChartComingSoon')}
                                </Text>
                            </Box>
                        </Stack>
                    </Dialog.Body>
                </Dialog.Content>
            </Dialog.Positioner>
        </Dialog.Root>
    );
};
