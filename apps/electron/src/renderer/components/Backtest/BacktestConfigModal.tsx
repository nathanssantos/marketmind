import type { DialogOpenChangeDetails } from '@chakra-ui/react';
import { Button, HStack, Input, Stack } from '@chakra-ui/react';
import type { BacktestConfig } from '@marketmind/types';
import { useState, type ChangeEvent, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { DialogBackdrop, DialogBody, DialogCloseTrigger, DialogContent, DialogFooter, DialogHeader, DialogRoot, DialogTitle } from '../ui/dialog';
import { Field } from '../ui/field';
import { NumberInput } from '../ui/number-input';
import { Select } from '../ui/select';
import { Switch } from '../ui/switch';

interface BacktestConfigModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (config: BacktestConfig) => void;
    symbol: string;
    interval: string;
}

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const DEFAULT_DAYS_BACK = 30;
const DEFAULT_INITIAL_CAPITAL = 10000;
const DEFAULT_MAX_POSITION = 10;
const DEFAULT_COMMISSION = 0.1;
const DEFAULT_STOP_LOSS = 2;
const DEFAULT_TAKE_PROFIT = 4;
const PERCENT_MULTIPLIER = 100;

export const BacktestConfigModal = ({
    isOpen,
    onClose,
    onSubmit,
    symbol,
    interval,
}: BacktestConfigModalProps): ReactElement => {
    const { t } = useTranslation();
    const getDefaultStartDate = (): string => {
        const date = new Date(Date.now() - DEFAULT_DAYS_BACK * MILLISECONDS_PER_DAY);
        return date.toISOString().split('T')[0] ?? '';
    };

    const getDefaultEndDate = (): string => {
        return new Date().toISOString().split('T')[0] ?? '';
    };

    const [config, setConfig] = useState<BacktestConfig>({
        symbol,
        interval,
        startDate: getDefaultStartDate(),
        endDate: getDefaultEndDate(),
        initialCapital: DEFAULT_INITIAL_CAPITAL,
        maxPositionSize: DEFAULT_MAX_POSITION,
        commission: DEFAULT_COMMISSION,
        stopLossPercent: DEFAULT_STOP_LOSS,
        takeProfitPercent: DEFAULT_TAKE_PROFIT,
        useAlgorithmicLevels: false,
        minProfitPercent: 0,
        minConfidence: 0,
    });

    const updateConfig = (updates: Partial<BacktestConfig>): void => {
        setConfig((prev) => ({ ...prev, ...updates }));
    };

    const handleSubmit = (): void => {
        onSubmit(config);
        onClose();
    };

    return (
        <DialogRoot open={isOpen} onOpenChange={(e: DialogOpenChangeDetails) => !e.open && onClose()} size="lg">
            <DialogBackdrop />
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{t('backtesting.config.title')}</DialogTitle>
                    <DialogCloseTrigger />
                </DialogHeader>
                <DialogBody>
                    <Stack gap={4}>
                        <Field label={t('backtesting.config.symbol')}>
                            <Input value={config.symbol} readOnly />
                        </Field>

                        <Field label={t('backtesting.config.interval')}>
                            <Select
                                value={config.interval}
                                onChange={(value: string) => updateConfig({ interval: value })}
                                options={[
                                    { value: '1m', label: '1 Minute' },
                                    { value: '5m', label: '5 Minutes' },
                                    { value: '15m', label: '15 Minutes' },
                                    { value: '1h', label: '1 Hour' },
                                    { value: '4h', label: '4 Hours' },
                                    { value: '1d', label: '1 Day' },
                                ]}
                            />
                        </Field>

                        <HStack gap={4}>
                            <Field label="Start Date">
                                <Input
                                    type="date"
                                    value={config.startDate}
                                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                                        updateConfig({ startDate: e.target.value })
                                    }
                                />
                            </Field>

                            <Field label="End Date">
                                <Input
                                    type="date"
                                    value={config.endDate}
                                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                                        updateConfig({ endDate: e.target.value })
                                    }
                                />
                            </Field>
                        </HStack>

                        <Field label={t('backtesting.config.initialCapital')} helperText={t('backtesting.config.initialCapitalHelper')}>
                            <NumberInput
                                value={config.initialCapital}
                                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                                    updateConfig({ initialCapital: Number(e.target.value) })
                                }
                                min={0}
                            />
                        </Field>

                        <Field
                            label={t('backtesting.config.maxPosition')}
                            helperText={t('backtesting.config.maxPositionHelper')}
                        >
                            <NumberInput
                                value={config.maxPositionSize ?? DEFAULT_MAX_POSITION}
                                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                                    updateConfig({ maxPositionSize: Number(e.target.value) })
                                }
                                min={0}
                                max={100}
                            />
                        </Field>

                        <Field
                            label={t('backtesting.config.commission')}
                            helperText={t('backtesting.config.commissionHelper')}
                        >
                            <NumberInput
                                value={(config.commission ?? DEFAULT_COMMISSION) * PERCENT_MULTIPLIER}
                                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                                    updateConfig({ commission: Number(e.target.value) / PERCENT_MULTIPLIER })
                                }
                                min={0}
                                max={10}
                                step={0.01}
                            />
                        </Field>

                        <Field label={t('backtesting.config.useAlgorithmicLevels')}>
                            <Switch
                                checked={config.useAlgorithmicLevels ?? false}
                                onCheckedChange={(checked: boolean) =>
                                    updateConfig({ useAlgorithmicLevels: checked })
                                }
                            >
                                {t('backtesting.config.useAlgorithmicLevelsHelper')}
                            </Switch>
                        </Field>

                        {!config.useAlgorithmicLevels && (
                            <HStack gap={4}>
                                <Field label={t('backtesting.config.stopLoss')}>
                                    <NumberInput
                                        value={config.stopLossPercent ?? DEFAULT_STOP_LOSS}
                                        onChange={(e: ChangeEvent<HTMLInputElement>) =>
                                            updateConfig({ stopLossPercent: Number(e.target.value) })
                                        }
                                        min={0}
                                        max={100}
                                    />
                                </Field>

                                <Field label={t('backtesting.config.takeProfit')}>
                                    <NumberInput
                                        value={config.takeProfitPercent ?? DEFAULT_TAKE_PROFIT}
                                        onChange={(e: ChangeEvent<HTMLInputElement>) =>
                                            updateConfig({ takeProfitPercent: Number(e.target.value) })
                                        }
                                        min={0}
                                        max={100}
                                    />
                                </Field>
                            </HStack>
                        )}

                        <Field
                            label={t('backtesting.config.minProfit')}
                            helperText={t('backtesting.config.minProfitHelper')}
                        >
                            <NumberInput
                                value={config.minProfitPercent ?? 0}
                                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                                    updateConfig({ minProfitPercent: Number(e.target.value) })
                                }
                                min={0}
                                max={100}
                            />
                        </Field>

                        <Field
                            label={t('backtesting.config.minConfidence')}
                            helperText={t('backtesting.config.minConfidenceHelper')}
                        >
                            <NumberInput
                                value={config.minConfidence ?? 0}
                                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                                    updateConfig({ minConfidence: Number(e.target.value) })
                                }
                                min={0}
                                max={100}
                            />
                        </Field>
                    </Stack>
                </DialogBody>
                <DialogFooter>
                    <Button variant="ghost" onClick={onClose}>
                        {t('common.cancel')}
                    </Button>
                    <Button colorScheme="blue" onClick={handleSubmit}>
                        {t('backtesting.config.runBacktest')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </DialogRoot>
    );
};
