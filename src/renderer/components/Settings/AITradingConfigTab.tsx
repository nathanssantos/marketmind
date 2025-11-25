import { Button } from '@/renderer/components/ui/button';
import { Field } from '@/renderer/components/ui/field';
import { NumberInput } from '@/renderer/components/ui/number-input';
import { Switch } from '@/renderer/components/ui/switch';
import { useAIStore } from '@/renderer/store';
import { useTradingStore } from '@/renderer/store/tradingStore';
import {
  Box,
  Card,
  Flex,
  Grid,
  Heading,
  HStack,
  Separator,
  Stack,
  Text,
} from '@chakra-ui/react';
import type { RiskProfile, TradingInterval } from '@shared/types';
import { useState } from 'react';
import { LuInfo, LuRefreshCw, LuSettings, LuShield, LuTrendingUp } from 'react-icons/lu';

const RISK_PROFILES: Array<{ value: RiskProfile; label: string; description: string }> = [
  { value: 'conservative', label: 'Conservative', description: '50%+ confidence, 1:2 risk/reward' },
  { value: 'moderate', label: 'Moderate', description: '40%+ confidence, 1:1.5 risk/reward' },
  { value: 'aggressive', label: 'Aggressive', description: '30%+ confidence, 1:1 risk/reward' },
];

const TRADING_INTERVALS: Array<{ value: TradingInterval; label: string }> = [
  { value: '1m', label: '1 minute' },
  { value: '5m', label: '5 minutes' },
  { value: '15m', label: '15 minutes' },
  { value: '30m', label: '30 minutes' },
  { value: '1h', label: '1 hour' },
];

export const AITradingConfigTab = () => {
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

  const handleConfigChange = <K extends keyof typeof tradingConfig>(
    key: K,
    value: typeof tradingConfig[K]
  ) => {
    const newConfig = { ...localConfig, [key]: value };
    setLocalConfig(newConfig);
    updateTradingConfig({ [key]: value });
  };

  const handleResetToDefaults = () => {
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
    <Stack gap={6} pb={4}>
      <Box>
        <Flex align="center" gap={2} mb={2}>
          <LuInfo size={20} />
          <Heading size="sm">AI Auto-Trading Status</Heading>
        </Flex>
        <Card.Root>
          <Card.Body>
            <Stack gap={4}>
              <Flex justify="space-between" align="center">
                <Box>
                  <Text fontWeight="medium">Auto-Trading</Text>
                  <Text fontSize="sm" color="fg.muted">
                    {isAutoTradingActive ? 'Active - AI is analyzing and trading' : 'Inactive - Toggle in Chat to activate'}
                  </Text>
                </Box>
                <Switch
                  checked={isAutoTradingActive}
                  onCheckedChange={() => { }}
                  disabled
                />
              </Flex>
              {wallet && (
                <Box>
                  <Text fontSize="sm" color="fg.muted">
                    Active Wallet: {wallet.name} ({wallet.currency})
                  </Text>
                  <Text fontSize="sm" color="fg.muted">
                    Balance: {wallet.balance.toFixed(2)} {wallet.currency}
                  </Text>
                </Box>
              )}
            </Stack>
          </Card.Body>
        </Card.Root>
      </Box>

      <Box>
        <Flex align="center" gap={2} mb={2}>
          <LuTrendingUp size={20} />
          <Heading size="sm">Risk Profile</Heading>
        </Flex>
        <Card.Root>
          <Card.Body>
            <Stack gap={4}>
              <Field label="Trading Strategy">
                <select
                  value={localConfig.riskProfile}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleConfigChange('riskProfile', e.target.value as RiskProfile)}
                  disabled={isAutoTradingActive}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #e2e8f0' }}
                >
                  {RISK_PROFILES.map(profile => (
                    <option key={profile.value} value={profile.value}>
                      {profile.label} - {profile.description}
                    </option>
                  ))}
                </select>
              </Field>

              <Grid templateColumns="repeat(2, 1fr)" gap={4}>
                <Field label="Max Position Size (%)">
                  <NumberInput
                    value={localConfig.maxPositionSize.toString()}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleConfigChange('maxPositionSize', parseFloat(e.target.value) || 10)}
                    min={1}
                    max={100}
                    step={1}
                    disabled={isAutoTradingActive}
                    size="sm"
                  />
                </Field>

                <Field label="Account Risk (%)">
                  <NumberInput
                    value={localConfig.accountRiskPercent.toString()}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleConfigChange('accountRiskPercent', parseFloat(e.target.value) || 1)}
                    min={0.1}
                    max={10}
                    step={0.1}
                    disabled={isAutoTradingActive}
                    size="sm"
                  />
                </Field>

                <Field label="Default Stop Loss (%)">
                  <NumberInput
                    value={localConfig.defaultStopLoss.toString()}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleConfigChange('defaultStopLoss', parseFloat(e.target.value) || 2)}
                    min={0.5}
                    max={20}
                    step={0.5}
                    disabled={isAutoTradingActive}
                    size="sm"
                  />
                </Field>

                <Field label="Default Take Profit (%)">
                  <NumberInput
                    value={localConfig.defaultTakeProfit.toString()}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleConfigChange('defaultTakeProfit', parseFloat(e.target.value) || 4)}
                    min={0.5}
                    max={50}
                    step={0.5}
                    disabled={isAutoTradingActive}
                    size="sm"
                  />
                </Field>
              </Grid>
            </Stack>
          </Card.Body>
        </Card.Root>
      </Box>

      <Box>
        <Flex align="center" gap={2} mb={2}>
          <LuSettings size={20} />
          <Heading size="sm">Trading Limits</Heading>
        </Flex>
        <Card.Root>
          <Card.Body>
            <Grid templateColumns="repeat(2, 1fr)" gap={4}>
              <Field label="Analysis Interval">
                <select
                  value={localConfig.analysisInterval}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleConfigChange('analysisInterval', e.target.value as TradingInterval)}
                  disabled={isAutoTradingActive}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #e2e8f0' }}
                >
                  {TRADING_INTERVALS.map(interval => (
                    <option key={interval.value} value={interval.value}>
                      {interval.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Max Trades Per Day">
                <NumberInput
                  value={localConfig.maxTradesPerDay.toString()}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleConfigChange('maxTradesPerDay', parseInt(e.target.value) || 10)}
                  min={1}
                  max={100}
                  step={1}
                  disabled={isAutoTradingActive}
                  size="sm"
                />
              </Field>

              <Field label="Max Trades Per Hour">
                <NumberInput
                  value={localConfig.maxTradesPerHour.toString()}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleConfigChange('maxTradesPerHour', parseInt(e.target.value) || 3)}
                  min={1}
                  max={20}
                  step={1}
                  disabled={isAutoTradingActive}
                  size="sm"
                />
              </Field>

              <Field label="Min Time Between Trades (min)">
                <NumberInput
                  value={localConfig.minTimeBetweenTrades.toString()}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleConfigChange('minTimeBetweenTrades', parseInt(e.target.value) || 5)}
                  min={1}
                  max={60}
                  step={1}
                  disabled={isAutoTradingActive}
                  size="sm"
                />
              </Field>
            </Grid>
          </Card.Body>
        </Card.Root>
      </Box>

      <Box>
        <Flex align="center" gap={2} mb={2}>
          <LuShield size={20} />
          <Heading size="sm">Safety Settings</Heading>
        </Flex>
        <Card.Root>
          <Card.Body>
            <Stack gap={4}>
              <Grid templateColumns="repeat(2, 1fr)" gap={4}>
                <Field label="Max Daily Loss (%)">
                  <NumberInput
                    value={localConfig.maxDailyLoss.toString()}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleConfigChange('maxDailyLoss', parseFloat(e.target.value) || 5)}
                    min={1}
                    max={50}
                    step={1}
                    disabled={isAutoTradingActive}
                    size="sm"
                  />
                </Field>

                <Field label="Emergency Stop (consecutive losses)">
                  <NumberInput
                    value={localConfig.emergencyStopLosses.toString()}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleConfigChange('emergencyStopLosses', parseInt(e.target.value) || 3)}
                    min={1}
                    max={10}
                    step={1}
                    disabled={isAutoTradingActive}
                    size="sm"
                  />
                </Field>
              </Grid>

              <Separator />

              <Stack gap={3}>
                <HStack>
                  <Switch
                    checked={localConfig.notifyOnTrade}
                    onCheckedChange={(checked) => handleConfigChange('notifyOnTrade', !!checked)}
                  />
                  <Text>Notify on trade execution</Text>
                </HStack>
                <HStack>
                  <Switch
                    checked={localConfig.notifyOnProfit}
                    onCheckedChange={(checked) => handleConfigChange('notifyOnProfit', !!checked)}
                  />
                  <Text>Notify on profitable close</Text>
                </HStack>
                <HStack>
                  <Switch
                    checked={localConfig.notifyOnLoss}
                    onCheckedChange={(checked) => handleConfigChange('notifyOnLoss', !!checked)}
                  />
                  <Text>Notify on loss close</Text>
                </HStack>
              </Stack>
            </Stack>
          </Card.Body>
        </Card.Root>
      </Box>

      {tradingStats && (
        <Box>
          <Flex align="center" gap={2} mb={2}>
            <LuInfo size={20} />
            <Heading size="sm">Trading Statistics</Heading>
          </Flex>
          <Grid templateColumns="repeat(4, 1fr)" gap={4}>
            <Card.Root>
              <Card.Body>
                <Stack gap={1}>
                  <Text fontSize="xs" color="fg.muted">Total Trades</Text>
                  <Text fontSize="2xl" fontWeight="bold">{tradingStats.totalTrades}</Text>
                </Stack>
              </Card.Body>
            </Card.Root>
            <Card.Root>
              <Card.Body>
                <Stack gap={1}>
                  <Text fontSize="xs" color="fg.muted">Open Positions</Text>
                  <Text fontSize="2xl" fontWeight="bold">{openTrades.length}</Text>
                </Stack>
              </Card.Body>
            </Card.Root>
            <Card.Root>
              <Card.Body>
                <Stack gap={1}>
                  <Text fontSize="xs" color="fg.muted">Win Rate</Text>
                  <Text fontSize="2xl" fontWeight="bold" color={winRate >= 50 ? 'green.500' : 'red.500'}>
                    {winRate.toFixed(1)}%
                  </Text>
                </Stack>
              </Card.Body>
            </Card.Root>
            <Card.Root>
              <Card.Body>
                <Stack gap={1}>
                  <Text fontSize="xs" color="fg.muted">Net P&L</Text>
                  <Text fontSize="2xl" fontWeight="bold" color={netProfit >= 0 ? 'green.500' : 'red.500'}>
                    {netProfit >= 0 ? '+' : ''}{netProfit.toFixed(2)}
                  </Text>
                </Stack>
              </Card.Body>
            </Card.Root>
          </Grid>
        </Box>
      )}

      <Flex gap={2} justify="flex-end">
        <Button
          onClick={handleResetToDefaults}
          variant="outline"
          disabled={isAutoTradingActive}
        >
          <LuRefreshCw />
          Reset to Defaults
        </Button>
        <Button
          onClick={clearTradingHistory}
          variant="outline"
          colorPalette="red"
          disabled={isAutoTradingActive || trades.length === 0}
        >
          Clear Trading History
        </Button>
      </Flex>
    </Stack>
  );
};
