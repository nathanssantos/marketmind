import { Button } from '@/renderer/components/ui/button';
import { Field } from '@/renderer/components/ui/field';
import { NumberInput } from '@/renderer/components/ui/number-input';
import { Slider } from '@/renderer/components/ui/slider';
import { DEFAULT_NEWS_SETTINGS } from '@/renderer/constants/defaults';
import { useDebounceCallback } from '@/renderer/hooks/useDebounceCallback';
import { Box, Checkbox, HStack, Separator, Text, VStack } from '@chakra-ui/react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuRefreshCw } from 'react-icons/lu';

interface NewsSettingsTabProps {
    onPollingEnabledChange?: (enabled: boolean) => void;
    onMinImportanceChange?: (value: number) => void;
}

export const NewsSettingsTab = ({
    onPollingEnabledChange,
    onMinImportanceChange,
}: NewsSettingsTabProps) => {
    const { t } = useTranslation();
    const [pollingEnabled, setPollingEnabled] = useState<boolean>(DEFAULT_NEWS_SETTINGS.pollingEnabled);
    const [refreshInterval, setRefreshInterval] = useState<number>(DEFAULT_NEWS_SETTINGS.refreshInterval);
    const [minImportanceForToast, setMinImportanceForToast] = useState<number>(
        DEFAULT_NEWS_SETTINGS.minImportanceForToast
    );
    const [correlateWithAI, setCorrelateWithAI] = useState<boolean>(DEFAULT_NEWS_SETTINGS.correlateWithAI);
    const [loading, setLoading] = useState<boolean>(false);

    const debouncedSaveSettings = useDebounceCallback(
        async (settings: {
            pollingEnabled: boolean;
            refreshInterval: number;
            minImportanceForToast: number;
            correlateWithAI: boolean;
        }) => {
            try {
                const currentSettings = await window.electron.secureStorage.getNewsSettings();
                await window.electron.secureStorage.setNewsSettings({
                    ...currentSettings,
                    ...settings,
                });
            } catch (error) {
                console.error('Failed to save news polling settings:', error);
            }
        },
        300
    );

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        setLoading(true);
        try {
            const settings = await window.electron.secureStorage.getNewsSettings();

            const savedPollingEnabled = (settings as typeof settings & { pollingEnabled?: boolean }).pollingEnabled ?? DEFAULT_NEWS_SETTINGS.pollingEnabled;
            const savedRefreshInterval = settings.refreshInterval ?? DEFAULT_NEWS_SETTINGS.refreshInterval;
            const savedMinImportance = (settings as typeof settings & { minImportanceForToast?: number }).minImportanceForToast ?? DEFAULT_NEWS_SETTINGS.minImportanceForToast;
            const savedCorrelateWithAI = (settings as typeof settings & { correlateWithAI?: boolean }).correlateWithAI ?? DEFAULT_NEWS_SETTINGS.correlateWithAI;

            setPollingEnabled(savedPollingEnabled);
            setRefreshInterval(savedRefreshInterval);
            setMinImportanceForToast(savedMinImportance);
            setCorrelateWithAI(savedCorrelateWithAI);

            onPollingEnabledChange?.(savedPollingEnabled);
            onMinImportanceChange?.(savedMinImportance);
        } catch (error) {
            console.error('Failed to load news polling settings:', error);
        } finally {
            setLoading(false);
        }
    };

    const handlePollingEnabledChange = (checked: boolean) => {
        setPollingEnabled(checked);
        onPollingEnabledChange?.(checked);
        debouncedSaveSettings({ pollingEnabled: checked, refreshInterval, minImportanceForToast, correlateWithAI });
    };

    const handleRefreshIntervalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = Math.max(1, Math.min(60, parseInt(e.target.value) || DEFAULT_NEWS_SETTINGS.refreshInterval));
        setRefreshInterval(value);
        debouncedSaveSettings({ pollingEnabled, refreshInterval: value, minImportanceForToast, correlateWithAI });
    };

    const handleMinImportanceChange = (value: number[]) => {
        const importance = value[0] ?? DEFAULT_NEWS_SETTINGS.minImportanceForToast;
        setMinImportanceForToast(importance);
        onMinImportanceChange?.(importance);
        debouncedSaveSettings({ pollingEnabled, refreshInterval, minImportanceForToast: importance, correlateWithAI });
    };

    const handleCorrelateWithAIChange = (checked: boolean) => {
        setCorrelateWithAI(checked);
        debouncedSaveSettings({ pollingEnabled, refreshInterval, minImportanceForToast, correlateWithAI: checked });
    };

    const handleReset = async () => {
        setPollingEnabled(DEFAULT_NEWS_SETTINGS.pollingEnabled);
        setRefreshInterval(DEFAULT_NEWS_SETTINGS.refreshInterval);
        setMinImportanceForToast(DEFAULT_NEWS_SETTINGS.minImportanceForToast);
        setCorrelateWithAI(DEFAULT_NEWS_SETTINGS.correlateWithAI);

        onPollingEnabledChange?.(DEFAULT_NEWS_SETTINGS.pollingEnabled);
        onMinImportanceChange?.(DEFAULT_NEWS_SETTINGS.minImportanceForToast);

        try {
            const currentSettings = await window.electron.secureStorage.getNewsSettings();
            await window.electron.secureStorage.setNewsSettings({
                ...currentSettings,
                pollingEnabled: DEFAULT_NEWS_SETTINGS.pollingEnabled,
                refreshInterval: DEFAULT_NEWS_SETTINGS.refreshInterval,
                minImportanceForToast: DEFAULT_NEWS_SETTINGS.minImportanceForToast,
                correlateWithAI: DEFAULT_NEWS_SETTINGS.correlateWithAI,
            });
        } catch (error) {
            console.error('Failed to reset news polling settings:', error);
        }
    };

    return (
        <VStack align="stretch" gap={6}>
            {loading && (
                <Box textAlign="center" py={4}>
                    <Text color="fg.muted">{t('settings.news.loadingSettings')}</Text>
                </Box>
            )}

            <Box>
                <Checkbox.Root
                    checked={pollingEnabled}
                    onCheckedChange={(e) => handlePollingEnabledChange(!!e.checked)}
                >
                    <Checkbox.HiddenInput />
                    <Checkbox.Control>
                        <Checkbox.Indicator />
                    </Checkbox.Control>
                    <Checkbox.Label>
                        <Text fontWeight="medium">{t('news.settings.enablePolling')}</Text>
                    </Checkbox.Label>
                </Checkbox.Root>
                <Text fontSize="sm" color="fg.muted" mt={2}>
                    {t('news.settings.pollingDescription')}
                </Text>
            </Box>

            <Separator />

            <Box opacity={pollingEnabled ? 1 : 0.5}>
                <Field label={t('news.settings.refreshInterval')}>
                    <NumberInput
                        min={1}
                        max={60}
                        value={refreshInterval}
                        onChange={handleRefreshIntervalChange}
                        disabled={!pollingEnabled}
                    />
                    <Text fontSize="sm" color="fg.muted" mt={1}>
                        {t('news.settings.refreshIntervalHelper')}
                    </Text>
                </Field>
            </Box>

            <Separator />

            <Box>
                <Field label={t('news.settings.minImportanceForToast')}>
                    <VStack align="stretch" gap={3}>
                        <HStack justify="space-between">
                            <Text fontSize="sm" color="fg.muted">
                                {t('news.settings.importanceLevel')}
                            </Text>
                            <Text fontSize="sm" fontWeight="semibold">
                                {minImportanceForToast}%
                            </Text>
                        </HStack>
                        <Slider
                            min={0}
                            max={100}
                            step={10}
                            value={[minImportanceForToast]}
                            onValueChange={handleMinImportanceChange}
                        />
                    </VStack>
                    <Text fontSize="sm" color="fg.muted" mt={2}>
                        {t('news.settings.importanceHelper')}
                    </Text>
                </Field>
            </Box>

            <Separator />

            <Box>
                <Checkbox.Root
                    checked={correlateWithAI}
                    onCheckedChange={(e) => handleCorrelateWithAIChange(!!e.checked)}
                >
                    <Checkbox.HiddenInput />
                    <Checkbox.Control>
                        <Checkbox.Indicator />
                    </Checkbox.Control>
                    <Checkbox.Label>
                        <Text fontWeight="medium">{t('news.settings.correlateWithAI')}</Text>
                    </Checkbox.Label>
                </Checkbox.Root>
                <Text fontSize="sm" color="fg.muted" mt={2}>
                    {t('news.settings.correlateWithAIDescription')}
                </Text>
            </Box>

            <Separator />

            <Button variant="outline" onClick={handleReset}>
                <LuRefreshCw />
                {t('settings.resetToDefaults')}
            </Button>
        </VStack>
    );
};
