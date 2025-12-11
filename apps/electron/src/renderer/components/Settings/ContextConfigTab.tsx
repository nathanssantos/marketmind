import { Field } from '@/renderer/components/ui/field';
import { NumberInput } from '@/renderer/components/ui/number-input';
import { Switch } from '@/renderer/components/ui/switch';
import { Box, Flex, Heading, Stack, Text } from '@chakra-ui/react';
import { useMarketContext } from '@renderer/hooks/useMarketContext';
import { useToast } from '@renderer/hooks/useToast';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

export const ContextConfigTab = () => {
    const { t } = useTranslation();
    const { success, error: showError } = useToast();
    const { getContextConfig, updateContextConfig } = useMarketContext();

    const config = getContextConfig.data?.config || {
        newsLookbackHours: 24,
        eventsLookforwardDays: 7,
        enableFearGreedIndex: true,
        enableBTCDominance: true,
        enableFundingRate: true,
        enableOpenInterest: true,
    };

    const [localConfig, setLocalConfig] = useState(config);

    const handleToggle = async (field: string, value: boolean) => {
        const newConfig = { ...localConfig, [field]: value };
        setLocalConfig(newConfig);

        try {
            await updateContextConfig.mutateAsync(newConfig);
            success(t('settings.contextConfig.updateSuccess'));
        } catch (err) {
            showError(t('settings.contextConfig.updateError'));
            setLocalConfig(localConfig);
        }
    };

    const handleNumberChange = async (field: string, value: string) => {
        const numValue = Number.parseInt(value, 10);
        if (Number.isNaN(numValue) || numValue < 1) return;

        const newConfig = { ...localConfig, [field]: numValue };
        setLocalConfig(newConfig);

        try {
            await updateContextConfig.mutateAsync(newConfig);
            success(t('settings.contextConfig.updateSuccess'));
        } catch (err) {
            showError(t('settings.contextConfig.updateError'));
            setLocalConfig(localConfig);
        }
    };

    return (
        <Stack gap={6} maxW="800px">
            <Box>
                <Heading size="md" mb={4}>
                    {t('settings.contextConfig.title')}
                </Heading>
                <Text color="fg.muted" mb={4}>
                    {t('settings.contextConfig.description')}
                </Text>
            </Box>

            <Box borderWidth={1} borderColor="border" borderRadius="md" p={4}>
                <Heading size="sm" mb={4}>
                    {t('settings.contextConfig.dataSources')}
                </Heading>

                <Stack gap={4}>
                    <Flex justify="space-between" align="center">
                        <Box flex={1}>
                            <Text fontWeight="medium">{t('settings.contextConfig.fearGreed')}</Text>
                            <Text fontSize="sm" color="fg.muted">
                                {t('settings.contextConfig.fearGreedDesc')}
                            </Text>
                        </Box>
                        <Switch
                            checked={localConfig.enableFearGreedIndex}
                            onCheckedChange={(checked) => handleToggle('enableFearGreedIndex', checked)}
                        />
                    </Flex>

                    <Flex justify="space-between" align="center">
                        <Box flex={1}>
                            <Text fontWeight="medium">{t('settings.contextConfig.btcDominance')}</Text>
                            <Text fontSize="sm" color="fg.muted">
                                {t('settings.contextConfig.btcDominanceDesc')}
                            </Text>
                        </Box>
                        <Switch
                            checked={localConfig.enableBTCDominance}
                            onCheckedChange={(checked) => handleToggle('enableBTCDominance', checked)}
                        />
                    </Flex>

                    <Flex justify="space-between" align="center">
                        <Box flex={1}>
                            <Text fontWeight="medium">{t('settings.contextConfig.fundingRate')}</Text>
                            <Text fontSize="sm" color="fg.muted">
                                {t('settings.contextConfig.fundingRateDesc')}
                            </Text>
                        </Box>
                        <Switch
                            checked={localConfig.enableFundingRate}
                            onCheckedChange={(checked) => handleToggle('enableFundingRate', checked)}
                        />
                    </Flex>

                    <Flex justify="space-between" align="center">
                        <Box flex={1}>
                            <Text fontWeight="medium">{t('settings.contextConfig.openInterest')}</Text>
                            <Text fontSize="sm" color="fg.muted">
                                {t('settings.contextConfig.openInterestDesc')}
                            </Text>
                        </Box>
                        <Switch
                            checked={localConfig.enableOpenInterest}
                            onCheckedChange={(checked) => handleToggle('enableOpenInterest', checked)}
                        />
                    </Flex>
                </Stack>
            </Box>

            <Box borderWidth={1} borderColor="border" borderRadius="md" p={4}>
                <Heading size="sm" mb={4}>
                    {t('settings.contextConfig.timeRanges')}
                </Heading>

                <Stack gap={4}>
                    <Field label={t('settings.contextConfig.newsLookback')} helperText={t('settings.contextConfig.newsLookbackDesc')}>
                        <NumberInput
                            value={localConfig.newsLookbackHours?.toString()}
                            onChange={(e) => handleNumberChange('newsLookbackHours', e.target.value)}
                            min={1}
                            max={168}
                        />
                    </Field>

                    <Field label={t('settings.contextConfig.eventsLookforward')} helperText={t('settings.contextConfig.eventsLookforwardDesc')}>
                        <NumberInput
                            value={localConfig.eventsLookforwardDays?.toString()}
                            onChange={(e) => handleNumberChange('eventsLookforwardDays', e.target.value)}
                            min={1}
                            max={30}
                        />
                    </Field>
                </Stack>
            </Box>
        </Stack>
    );
};
