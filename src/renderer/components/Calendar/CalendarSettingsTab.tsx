import { Button } from '@/renderer/components/ui/button';
import { Field } from '@/renderer/components/ui/field';
import { NumberInput } from '@/renderer/components/ui/number-input';
import { Select } from '@/renderer/components/ui/select';
import { Box, Checkbox, Separator, Text, VStack } from '@chakra-ui/react';
import type { EventImportance } from '@shared/types';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuRefreshCw } from 'react-icons/lu';
import { useCalendar } from '../../hooks/useCalendar';

const DEFAULT_DAYS_AHEAD = 30;
const DEFAULT_DAYS_BEHIND = 7;
const DEFAULT_MIN_IMPORTANCE: EventImportance = 'medium';

export const CalendarSettingsTab = () => {
    const { t } = useTranslation();
    const {
        settings,
        toggleEnabled,
        toggleShowOnChart,
        toggleCorrelateWithAI,
        setMinImportanceForChart,
        setDaysAhead,
        setDaysBehind,
    } = useCalendar(); const [daysAheadValue, setDaysAheadValue] = useState(settings.daysAhead);
    const [daysBehindValue, setDaysBehindValue] = useState(settings.daysBehind);

    useEffect(() => {
        setDaysAheadValue(settings.daysAhead);
        setDaysBehindValue(settings.daysBehind);
    }, [settings]);

    const handleDaysAheadChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = Math.max(1, Math.min(90, parseInt(e.target.value) || DEFAULT_DAYS_AHEAD));
        setDaysAheadValue(value);
        setDaysAhead(value);
    };

    const handleDaysBehindChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = Math.max(0, Math.min(90, parseInt(e.target.value) || DEFAULT_DAYS_BEHIND));
        setDaysBehindValue(value);
        setDaysBehind(value);
    };

    const handleMinImportanceChange = (value: string) => {
        const importance = value as EventImportance;
        if (importance) {
            setMinImportanceForChart(importance);
        }
    };

    const handleReset = () => {
        setDaysAheadValue(DEFAULT_DAYS_AHEAD);
        setDaysBehindValue(DEFAULT_DAYS_BEHIND);
        setDaysAhead(DEFAULT_DAYS_AHEAD);
        setDaysBehind(DEFAULT_DAYS_BEHIND);
        setMinImportanceForChart(DEFAULT_MIN_IMPORTANCE);
    };

    return (
        <VStack align="stretch" gap={6}>
            <Box>
                <Checkbox.Root checked={settings.enabled} onCheckedChange={toggleEnabled}>
                    <Checkbox.HiddenInput />
                    <Checkbox.Control>
                        <Checkbox.Indicator />
                    </Checkbox.Control>
                    <Checkbox.Label>
                        <Text fontWeight="medium">{t('calendar.settings.enableCalendar')}</Text>
                    </Checkbox.Label>
                </Checkbox.Root>
                <Text fontSize="sm" color="fg.muted" mt={2}>
                    {t('calendar.settings.enableCalendarDescription')}
                </Text>
            </Box>

            <Separator />

            <Box opacity={settings.enabled ? 1 : 0.5}>
                <Checkbox.Root
                    checked={settings.showOnChart}
                    onCheckedChange={toggleShowOnChart}
                    disabled={!settings.enabled}
                >
                    <Checkbox.HiddenInput />
                    <Checkbox.Control>
                        <Checkbox.Indicator />
                    </Checkbox.Control>
                    <Checkbox.Label>
                        <Text fontWeight="medium">{t('calendar.settings.showOnChart')}</Text>
                    </Checkbox.Label>
                </Checkbox.Root>
                <Text fontSize="sm" color="fg.muted" mt={2}>
                    {t('calendar.settings.showOnChartDescription')}
                </Text>
            </Box>

            <Separator />

            <Box opacity={settings.enabled && settings.showOnChart ? 1 : 0.5}>
                <Field label={t('calendar.settings.minImportanceForChart')}>
                    <Select
                        value={settings.minImportanceForChart}
                        onChange={handleMinImportanceChange}
                        options={[
                            { value: 'low', label: t('calendar.importance.low') },
                            { value: 'medium', label: t('calendar.importance.medium') },
                            { value: 'high', label: t('calendar.importance.high') },
                            { value: 'critical', label: t('calendar.importance.critical') },
                        ]}
                    />
                    <Text fontSize="sm" color="fg.muted" mt={1}>
                        {t('calendar.settings.minImportanceHelper')}
                    </Text>
                </Field>
            </Box>

            <Separator />

            <Box opacity={settings.enabled ? 1 : 0.5}>
                <Field label={t('calendar.settings.daysAhead')}>
                    <NumberInput
                        min={1}
                        max={90}
                        value={daysAheadValue}
                        onChange={handleDaysAheadChange}
                        disabled={!settings.enabled}
                    />
                    <Text fontSize="sm" color="fg.muted" mt={1}>
                        {t('calendar.settings.daysAheadHelper')}
                    </Text>
                </Field>
            </Box>

            <Separator />

            <Box opacity={settings.enabled ? 1 : 0.5}>
                <Field label={t('calendar.settings.daysBehind')}>
                    <NumberInput
                        min={0}
                        max={90}
                        value={daysBehindValue}
                        onChange={handleDaysBehindChange}
                        disabled={!settings.enabled}
                    />
                    <Text fontSize="sm" color="fg.muted" mt={1}>
                        {t('calendar.settings.daysBehindHelper')}
                    </Text>
                </Field>
            </Box>

            <Separator />

            <Box>
                <Checkbox.Root
                    checked={settings.correlateWithAI}
                    onCheckedChange={toggleCorrelateWithAI}
                >
                    <Checkbox.HiddenInput />
                    <Checkbox.Control>
                        <Checkbox.Indicator />
                    </Checkbox.Control>
                    <Checkbox.Label>
                        <Text fontWeight="medium">{t('calendar.settings.correlateWithAI')}</Text>
                    </Checkbox.Label>
                </Checkbox.Root>
                <Text fontSize="sm" color="fg.muted" mt={2}>
                    {t('calendar.settings.correlateWithAIDescription')}
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