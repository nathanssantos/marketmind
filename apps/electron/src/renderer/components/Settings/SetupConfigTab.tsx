import { Field } from '@/renderer/components/ui/field';
import { Slider } from '@/renderer/components/ui/slider';
import { useSetupStore } from '@/renderer/store/setupStore';
import { Separator } from '@/renderer/components/ui/separator';
import { Box, HStack, Stack, Text } from '@chakra-ui/react';
import { Button } from '@/renderer/components/ui/button';
import type React from 'react';
import { useTranslation } from 'react-i18next';
import { LuRefreshCw } from 'react-icons/lu';

const MIN_CONFIDENCE = 30;
const MAX_CONFIDENCE = 100;
const CONFIDENCE_STEP = 5;

const MIN_RISK_REWARD = 0.5;
const MAX_RISK_REWARD = 5.0;
const RISK_REWARD_STEP = 0.5;

export const SetupConfigTab = (): React.ReactElement => {
    const { t } = useTranslation();
    const { config, setConfig, resetConfigToDefaults } = useSetupStore();

    const handleConfidenceChange = (value: number[]): void => {
        setConfig({ minConfidence: value[0] ?? 50 });
    };

    const handleRiskRewardChange = (value: number[]): void => {
        setConfig({ minRiskReward: value[0] ?? 1.0 });
    };

    return (
        <Stack gap={6} maxW="4xl" mx="auto" p={6}>
            <HStack justify="space-between">
                <Box>
                    <Text fontSize="2xl" fontWeight="bold">
                        {t('setupConfig.title')}
                    </Text>
                    <Text fontSize="sm" color="fg.muted" mt={1}>
                        {t('setupConfig.description')}
                    </Text>
                </Box>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => resetConfigToDefaults()}
                    title={t('setupConfig.resetToDefaults')}
                >
                    <LuRefreshCw />
                </Button>
            </HStack>

            <Separator />

            <Stack gap={6}>
                <Field label={t('setupConfig.globalSettings.minConfidence')} helperText={t('setupConfig.globalSettings.minConfidenceDescription')}>
                    <HStack gap={4}>
                        <Slider
                            value={[config.minConfidence]}
                            onValueChange={handleConfidenceChange}
                            min={MIN_CONFIDENCE}
                            max={MAX_CONFIDENCE}
                            step={CONFIDENCE_STEP}
                            width="full"
                        />
                        <Text fontSize="sm" fontWeight="medium" minW="50px" textAlign="right">
                            {config.minConfidence}%
                        </Text>
                    </HStack>
                </Field>

                <Field label={t('setupConfig.globalSettings.minRiskReward')} helperText={t('setupConfig.globalSettings.minRiskRewardDescription')}>
                    <HStack gap={4}>
                        <Slider
                            value={[config.minRiskReward]}
                            onValueChange={handleRiskRewardChange}
                            min={MIN_RISK_REWARD}
                            max={MAX_RISK_REWARD}
                            step={RISK_REWARD_STEP}
                            width="full"
                        />
                        <Text fontSize="sm" fontWeight="medium" minW="50px" textAlign="right">
                            {config.minRiskReward.toFixed(1)}
                        </Text>
                    </HStack>
                </Field>

                <Box mt={4} p={4} borderWidth="1px" borderRadius="md" bg="bg.subtle">
                    <Text fontSize="sm" color="fg.muted">
                        {t('setupConfig.strategiesManaged')}
                    </Text>
                </Box>
            </Stack>
        </Stack>
    );
};
