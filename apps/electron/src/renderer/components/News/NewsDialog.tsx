import {
    DialogBackdrop,
    DialogBody,
    DialogCloseTrigger,
    DialogContent,
    DialogHeader,
    DialogPositioner,
    DialogRoot,
    DialogTitle,
} from '@/renderer/components/ui/dialog';
import { Tabs } from '@/renderer/components/ui/tabs';
import { Box, Flex } from '@chakra-ui/react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuNewspaper, LuSettings } from 'react-icons/lu';
import type { MarketDataService } from '../../services/market/MarketDataService';
import { SymbolSelector } from '../SymbolSelector';
import { NewsPanel } from './NewsPanel';
import { NewsSettingsTab } from './NewsSettingsTab';

export interface NewsDialogProps {
    open: boolean;
    onClose: () => void;
    symbols?: string[];
    marketService: MarketDataService;
}

export const NewsDialog = ({ open, onClose, symbols: initialSymbols, marketService }: NewsDialogProps) => {
    const { t } = useTranslation();
    const [pollingEnabled, setPollingEnabled] = useState(true);
    const [minImportance, setMinImportance] = useState(50);
    const [refetchTrigger, setRefetchTrigger] = useState(0);
    const [selectedSymbol, setSelectedSymbol] = useState<string>(
        initialSymbols?.[0] || 'BTCUSDT'
    );

    useEffect(() => {
        const firstSymbol = initialSymbols?.[0];
        if (firstSymbol) {
            const symbolWithSuffix = firstSymbol.endsWith('USDT')
                ? firstSymbol
                : `${firstSymbol}USDT`;
            setSelectedSymbol(symbolWithSuffix);
        }
    }, [initialSymbols?.[0]]);

    useEffect(() => {
        if (open) setRefetchTrigger(prev => prev + 1);
    }, [open]);

    const handleSymbolChange = (value: string) => {
        setSelectedSymbol(value);
        setRefetchTrigger(prev => prev + 1);
    };

    return (
        <DialogRoot open={open} onOpenChange={(e) => !e.open && onClose()} size="xl">
            <DialogBackdrop />
            <DialogPositioner>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{t('news.title')}</DialogTitle>
                        <DialogCloseTrigger />
                    </DialogHeader>
                    <DialogBody p={0}>
                        <Flex
                            px={4}
                            py={2}
                            align="center"
                            gap={4}
                            bg="bg.panel"
                            borderBottom="1px solid"
                            borderColor="border"
                        >
                            <SymbolSelector
                                marketService={marketService}
                                value={selectedSymbol}
                                onChange={handleSymbolChange}
                            />
                        </Flex>

                        <Tabs.Root defaultValue="news" variant="enclosed">
                            <Tabs.List>
                                <Tabs.Trigger value="news">
                                    <LuNewspaper />
                                    {t('news.tabs.news')}
                                </Tabs.Trigger>
                                <Tabs.Trigger value="settings">
                                    <LuSettings />
                                    {t('news.tabs.settings')}
                                </Tabs.Trigger>
                            </Tabs.List>

                            <Tabs.Content value="news">
                                <Box maxH="70vh" overflowY="auto">
                                    <NewsPanel
                                        symbols={[selectedSymbol.replace('USDT', '').replace('USD', '')]}
                                        limit={20}
                                        showSentiment={true}
                                        pollingEnabled={pollingEnabled}
                                        minImportanceForToast={minImportance}
                                        refetchTrigger={refetchTrigger}
                                        {...(pollingEnabled && { refetchInterval: 5 * 60 * 1000 })}
                                    />
                                </Box>
                            </Tabs.Content>

                            <Tabs.Content value="settings">
                                <Box maxH="70vh" overflowY="auto" p={4}>
                                    <NewsSettingsTab
                                        onPollingEnabledChange={setPollingEnabled}
                                        onMinImportanceChange={setMinImportance}
                                    />
                                </Box>
                            </Tabs.Content>
                        </Tabs.Root>
                    </DialogBody>
                </DialogContent>
            </DialogPositioner>
        </DialogRoot>
    );
};
