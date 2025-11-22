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
import { LuCalendar, LuSettings } from 'react-icons/lu';
import type { MarketDataService } from '../../services/market/MarketDataService';
import { SymbolSelector } from '../SymbolSelector';
import { CalendarPanel } from './CalendarPanel';
import { CalendarSettingsTab } from './CalendarSettingsTab';

export interface CalendarDialogProps {
    open: boolean;
    onClose: () => void;
    symbols?: string[];
    marketService: MarketDataService;
}

export const CalendarDialog = ({ open, onClose, symbols: initialSymbols, marketService }: CalendarDialogProps) => {
    const { t } = useTranslation();
    const [refetchTrigger, setRefetchTrigger] = useState(0);
    const [selectedSymbol, setSelectedSymbol] = useState<string>(
        initialSymbols?.[0] || 'BTCUSDT'
    );

    useEffect(() => {
        if (initialSymbols?.[0]) {
            const symbolWithSuffix = initialSymbols[0].endsWith('USDT')
                ? initialSymbols[0]
                : `${initialSymbols[0]}USDT`;
            setSelectedSymbol(symbolWithSuffix);
        }
    }, [initialSymbols]);

    useEffect(() => {
        if (open) {
            console.log('[CalendarDialog] Dialog opened, triggering refetch');
            setRefetchTrigger(prev => prev + 1);
        }
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
                        <DialogTitle>{t('calendar.title')}</DialogTitle>
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

                        <Tabs.Root defaultValue="events" variant="enclosed">
                            <Tabs.List>
                                <Tabs.Trigger value="events">
                                    <LuCalendar />
                                    {t('calendar.tabs.events')}
                                </Tabs.Trigger>
                                <Tabs.Trigger value="settings">
                                    <LuSettings />
                                    {t('calendar.tabs.settings')}
                                </Tabs.Trigger>
                            </Tabs.List>

                            <Tabs.Content value="events">
                                <Box maxH="70vh" overflowY="auto">
                                    <CalendarPanel
                                        symbols={[selectedSymbol.replace('USDT', '').replace('USD', '')]}
                                        refetchTrigger={refetchTrigger}
                                    />
                                </Box>
                            </Tabs.Content>

                            <Tabs.Content value="settings">
                                <Box maxH="70vh" overflowY="auto" p={4}>
                                    <CalendarSettingsTab />
                                </Box>
                            </Tabs.Content>
                        </Tabs.Root>
                    </DialogBody>
                </DialogContent>
            </DialogPositioner>
        </DialogRoot>
    );
};
