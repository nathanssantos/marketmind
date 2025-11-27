import { Button } from '@/renderer/components/ui/button';
import { Field } from '@/renderer/components/ui/field';
import { NumberInput } from '@/renderer/components/ui/number-input';
import { Select } from '@/renderer/components/ui/select';
import { Switch } from '@/renderer/components/ui/switch';
import { useAIStore } from '@/renderer/store';
import { useTradingStore } from '@/renderer/store/tradingStore';
import {
  Box,
  HStack,
  Separator,
  Stack,
  Text,
} from '@chakra-ui/react';
import type { RiskProfile, TradingInterval } from '@shared/types';
import type React from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuRefreshCw } from 'react-icons/lu';

const DECIMAL_PLACES = 2;
const DEFAULT_MAX_POSITION_SIZE = 10;
const DEFAULT_ACCOUNT_RISK = 1;
const DEFAULT_STOP_LOSS = 2;
const DEFAULT_TAKE_PROFIT = 4;
const DEFAULT_MAX_TRADES_DAY = 10;
const DEFAULT_MAX_TRADES_HOUR = 3;
const DEFAULT_MIN_TIME_BETWEEN = 5;
const DEFAULT_MAX_DAILY_LOSS = 5;
const DEFAULT_EMERGENCY_STOP = 3;
const WIN_RATE_THRESHOLD = 50;

export const AITradingConfigTab = (): React.ReactElement => {
  const { t } = useTranslation();
  const {
    isAutoTradingActive,
    tradingConfig,
    tradingStats,
    trades,
    updateTradingConfig,
    clearTradingHistory,
  } = useAIStore();

  const { getActiveWallet } = useTradingStore();
  const wallet = getActiveWallet();

  const [localConfig, setLocalConfig] = useState(tradingConfig);

  const RISK_PROFILES: Array<{ value: RiskProfile; label: string; description: string }> = [
    { value: 'conservative', label: t('aiTrading.riskProfile.conservative'), description: t('aiTrading.riskProfile.conservativeDesc') },
    { value: 'moderate', label: t('aiTrading.riskProfile.moderate'), description: t('aiTrading.riskProfile.moderateDesc') },
    { value: 'aggressive', label: t('aiTrading.riskProfile.aggressive'), description: t('aiTrading.riskProfile.aggressiveDesc') },
  ];

  const TRADING_INTERVALS: Array<{ value: TradingInterval; label: string }> = [
    { value: '1m', label: t('aiTrading.limits.interval1m') },
    { value: '5m', label: t('aiTrading.limits.interval5m') },
    { value: '15m', label: t('aiTrading.limits.interval15m') },
    { value: '30m', label: t('aiTrading.limits.interval30m') },
    { value: '1h', label: t('aiTrading.limits.interval1h') },
  ];

  const handleConfigChange = <K extends keyof typeof tradingConfig>(
    key: K,
    value: typeof tradingConfig[K]
  ): void => {
    const newConfig = { ...localConfig, [key]: value };
    setLocalConfig(newConfig);
    updateTradingConfig({ [key]: value });
  };

  const handleResetToDefaults = (): void => {
    const defaultConfig = {
      enabled: false,
      riskProfile: 'moderate' as const,
      analysisInterval: '15m' as TradingInterval,
      maxPositionSize: 10,
      defaultStopLoss: 2,
      defaultTakeProfit: 4,
      maxTradesPerDay: 10,
      maxTradesPerHour: 3,
      minTimeBetweenTrades: 5,
      enabledTimeframes: ['1m', '5m', '15m', '30m', '1h', '4h', '1d'],
      emergencyStopLosses: 3,
      notifyOnTrade: true,
      notifyOnProfit: true,
      notifyOnLoss: true,
      maxDailyLoss: 5,
      accountRiskPercent: 1,
    };
    setLocalConfig(defaultConfig);
    updateTradingConfig(defaultConfig);
  };

  const openTrades = trades.filter(t => t.status === 'open');
  const winRate = tradingStats?.winRate ?? 0;
  const netProfit = tradingStats?.netProfit ?? 0;

  return (
    <Stack gap={6}>
      <Box
        bg="orange.500/10"
        p={4}
        borderRadius="md"
        borderLeft="4px solid"
        borderColor="orange.500"
      >
        <Text fontSize="sm" fontWeight="semibold" mb={2}>
          ⚠️ {t('common.tips')}
        </Text>
        <Stack gap={1} fontSize="sm" color="fg.muted">
          <Text>• {t('aiTrading.tips.experimental')}</Text>
          <Text>• {t('aiTrading.tips.simulator')}</Text>
          <Text>• {t('aiTrading.tips.monitor')}</Text>
        </Stack>
      </Box>

      <Box>
        <Button
          variant="outline"
          onClick={handleResetToDefaults}
          width="full"
          colorPalette="red"
          disabled={isAutoTradingActive}
        >
          <LuRefreshCw />
          {t('settings.resetToDefaults')}
        </Button>
      </Box>

      <Separator />

      <Box>
        <Text fontSize="sm" fontWeight="bold" mb={4}>
          {t('aiTrading.status.title')}
        </Text>
        <Stack gap={4}>
          <HStack justify="space-between">
            <Box>
              <Text fontWeight="medium">{t('aiTrading.status.autoTrading')}</Text>
              <Text fontSize="sm" color="fg.muted">
                {isAutoTradingActive ? t('aiTrading.status.active') : t('aiTrading.status.inactive')}
              </Text>
            </Box>
            <Switch
              checked={isAutoTradingActive}
              onCheckedChange={() => { }}
              disabled
            />
          </HStack>
          {wallet && (
            <Box p={3} bg="bg.subtle" borderRadius="md">
              <Text fontSize="sm" color="fg.muted">
                {t('aiTrading.status.activeWallet', { name: wallet.name, currency: wallet.currency })}
              </Text>
              <Text fontSize="sm" color="fg.muted">
                {t('aiTrading.status.balance', { balance: wallet.balance.toFixed(DECIMAL_PLACES), currency: wallet.currency })}
              </Text>
            </Box>
          )}
        </Stack>
      </Box>

      <Separator />

      <Box>
        <Text fontSize="sm" fontWeight="bold" mb={4}>
          {t('aiTrading.riskProfile.title')}
        </Text>
        <Stack gap={4}>
          <Field label={t('aiTrading.riskProfile.tradingStrategy')}>
            <Select
              value={localConfig.riskProfile}
              onChange={(value) => handleConfigChange('riskProfile', value as RiskProfile)}
              options={RISK_PROFILES.map(profile => ({
                value: profile.value,
                label: `${profile.label} - ${profile.description}`,
              }))}
              usePortal={false}
            />
          </Field>

          <Field label={t('aiTrading.riskProfile.maxPositionSize')}>
            <NumberInput
              value={localConfig.maxPositionSize.toString()}
              onChange={(e) => handleConfigChange('maxPositionSize', parseFloat(e.target.value) || DEFAULT_MAX_POSITION_SIZE)}
              min={1}
              max={100}
              step={1}
              disabled={isAutoTradingActive}
            />
          </Field>

          <Field label={t('aiTrading.riskProfile.accountRisk')}>
            <NumberInput
              value={localConfig.accountRiskPercent.toString()}
              onChange={(e) => handleConfigChange('accountRiskPercent', parseFloat(e.target.value) || DEFAULT_ACCOUNT_RISK)}
              min={0.1}
              max={10}
              step={0.1}
              disabled={isAutoTradingActive}
            />
          </Field>

          <Field label={t('aiTrading.riskProfile.defaultStopLoss')}>
            <NumberInput
              value={localConfig.defaultStopLoss.toString()}
              onChange={(e) => handleConfigChange('defaultStopLoss', parseFloat(e.target.value) || DEFAULT_STOP_LOSS)}
              min={0.5}
              max={20}
              step={0.5}
              disabled={isAutoTradingActive}
            />
          </Field>

          <Field label={t('aiTrading.riskProfile.defaultTakeProfit')}>
            <NumberInput
              value={localConfig.defaultTakeProfit.toString()}
              onChange={(e) => handleConfigChange('defaultTakeProfit', parseFloat(e.target.value) || DEFAULT_TAKE_PROFIT)}
              min={0.5}
              max={50}
              step={0.5}
              disabled={isAutoTradingActive}
            />
          </Field>
        </Stack>
      </Box>

      <Separator />

      <Box>
        <Text fontSize="sm" fontWeight="bold" mb={4}>
          {t('aiTrading.limits.title')}
        </Text>
        <Stack gap={4}>
          <Field label={t('aiTrading.limits.analysisInterval')}>
            <Select
              value={localConfig.analysisInterval}
              onChange={(value) => handleConfigChange('analysisInterval', value as TradingInterval)}
              options={TRADING_INTERVALS.map(interval => ({
                value: interval.value,
                label: interval.label,
              }))}
              usePortal={false}
            />
          </Field>

          <Field label={t('aiTrading.limits.maxTradesPerDay')}>
            <NumberInput
              value={localConfig.maxTradesPerDay.toString()}
              onChange={(e) => handleConfigChange('maxTradesPerDay', parseInt(e.target.value) || DEFAULT_MAX_TRADES_DAY)}
              min={1}
              max={100}
              step={1}
              disabled={isAutoTradingActive}
            />
          </Field>

          <Field label={t('aiTrading.limits.maxTradesPerHour')}>
            <NumberInput
              value={localConfig.maxTradesPerHour.toString()}
              onChange={(e) => handleConfigChange('maxTradesPerHour', parseInt(e.target.value) || DEFAULT_MAX_TRADES_HOUR)}
              min={1}
              max={20}
              step={1}
              disabled={isAutoTradingActive}
            />
          </Field>

          <Field label={t('aiTrading.limits.minTimeBetween')}>
            <NumberInput
              value={localConfig.minTimeBetweenTrades.toString()}
              onChange={(e) => handleConfigChange('minTimeBetweenTrades', parseInt(e.target.value) || DEFAULT_MIN_TIME_BETWEEN)}
              min={1}
              max={60}
              step={1}
              disabled={isAutoTradingActive}
            />
          </Field>
        </Stack>
      </Box>

      <Separator />

      <Box>
        <Text fontSize="sm" fontWeight="bold" mb={4}>
          {t('aiTrading.safety.title')}
        </Text>
        <Stack gap={4}>
          <Field label={t('aiTrading.safety.maxDailyLoss')}>
            <NumberInput
              value={localConfig.maxDailyLoss.toString()}
              onChange={(e) => handleConfigChange('maxDailyLoss', parseFloat(e.target.value) || DEFAULT_MAX_DAILY_LOSS)}
              min={1}
              max={50}
              step={1}
              disabled={isAutoTradingActive}
            />
          </Field>

          <Field label={t('aiTrading.safety.emergencyStop')}>
            <NumberInput
              value={localConfig.emergencyStopLosses.toString()}
              onChange={(e) => handleConfigChange('emergencyStopLosses', parseInt(e.target.value) || DEFAULT_EMERGENCY_STOP)}
              min={1}
              max={10}
              step={1}
              disabled={isAutoTradingActive}
            />
          </Field>

          <Separator />

          <Stack gap={3}>
            <HStack justify="space-between">
              <Text>{t('aiTrading.safety.notifyOnTrade')}</Text>
              <Switch
                checked={localConfig.notifyOnTrade}
                onCheckedChange={(checked) => handleConfigChange('notifyOnTrade', checked)}
              />
            </HStack>
            <HStack justify="space-between">
              <Text>{t('aiTrading.safety.notifyOnProfit')}</Text>
              <Switch
                checked={localConfig.notifyOnProfit}
                onCheckedChange={(checked) => handleConfigChange('notifyOnProfit', checked)}
              />
            </HStack>
            <HStack justify="space-between">
              <Text>{t('aiTrading.safety.notifyOnLoss')}</Text>
              <Switch
                checked={localConfig.notifyOnLoss}
                onCheckedChange={(checked) => handleConfigChange('notifyOnLoss', checked)}
              />
            </HStack>
          </Stack>
        </Stack>
      </Box>

      {tradingStats && (
        <>
          <Separator />
          <Box>
            <Text fontSize="sm" fontWeight="bold" mb={4}>
              {t('aiTrading.statistics.title')}
            </Text>
            <Stack gap={3}>
              <HStack justify="space-between" p={3} bg="bg.subtle" borderRadius="md">
                <Text fontSize="sm" color="fg.muted">{t('aiTrading.statistics.totalTrades')}</Text>
                <Text fontSize="lg" fontWeight="bold">{tradingStats.totalTrades}</Text>
              </HStack>
              <HStack justify="space-between" p={3} bg="bg.subtle" borderRadius="md">
                <Text fontSize="sm" color="fg.muted">{t('aiTrading.statistics.openPositions')}</Text>
                <Text fontSize="lg" fontWeight="bold">{openTrades.length}</Text>
              </HStack>
              <HStack justify="space-between" p={3} bg="bg.subtle" borderRadius="md">
                <Text fontSize="sm" color="fg.muted">{t('aiTrading.statistics.winRate')}</Text>
                <Text fontSize="lg" fontWeight="bold" color={winRate >= WIN_RATE_THRESHOLD ? 'green.500' : 'red.500'}>
                  {winRate.toFixed(1)}%
                </Text>
              </HStack>
              <HStack justify="space-between" p={3} bg="bg.subtle" borderRadius="md">
                <Text fontSize="sm" color="fg.muted">{t('aiTrading.statistics.netPnL')}</Text>
                <Text fontSize="lg" fontWeight="bold" color={netProfit >= 0 ? 'green.500' : 'red.500'}>
                  {netProfit >= 0 ? '+' : ''}{netProfit.toFixed(DECIMAL_PLACES)}
                </Text>
              </HStack>
            </Stack>
          </Box>
        </>
      )}

      <Separator />

      <Box>
        <Button
          onClick={clearTradingHistory}
          variant="outline"
          colorPalette="red"
          disabled={isAutoTradingActive || trades.length === 0}
          width="full"
        >
          {t('aiTrading.clearHistory')}
        </Button>
      </Box>
    </Stack>
  );
};
