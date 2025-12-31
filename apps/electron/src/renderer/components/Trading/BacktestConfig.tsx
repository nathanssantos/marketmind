import { Badge, Box, Flex, HStack, Stack, Text } from '@chakra-ui/react';
import { Field as ChakraField } from '@chakra-ui/react/field';
import { TimeframeSelector, type Timeframe } from '@renderer/components/Chart/TimeframeSelector';
import { SetupTogglePopover } from '@renderer/components/Layout/SetupTogglePopover';
import { SymbolSelector } from '@renderer/components/SymbolSelector';
import { Button } from '@renderer/components/ui/button';
import { Checkbox } from '@renderer/components/ui/checkbox';
import { NumberInput } from '@renderer/components/ui/number-input';
import { useChartContext } from '@renderer/context/ChartContext';
import { useBacktesting } from '@renderer/hooks/useBacktesting';
import { useSetupStore } from '@renderer/store/setupStore';
import type { BacktestConfig as BacktestConfigType } from '@marketmind/types';
import { BINANCE_DEFAULT_FEES } from '@marketmind/types';
import { useState } from 'react';

const OPTIMIZED_SETTINGS = {
  onlyWithTrend: false,
  useAlgorithmicLevels: true,
  maxPositionSize: 10,
  commission: BINANCE_DEFAULT_FEES.VIP_0_TAKER * 100, // 0.1% for spot
  minConfidence: 0,
  minProfitPercent: 0,
};

interface BacktestConfigProps {
  onBacktestComplete?: (resultId: string) => void;
}

export const BacktestConfig = ({ onBacktestComplete }: BacktestConfigProps) => {
  const { chartData } = useChartContext();
  const { runBacktest, isRunningBacktest, runBacktestError } = useBacktesting();
  const { config: setupConfig } = useSetupStore();

  const getLastMonthRange = () => {
    const now = new Date();
    const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    return {
      start: firstDayLastMonth.toISOString().split('T')[0],
      end: lastDayLastMonth.toISOString().split('T')[0],
    };
  };

  const lastMonthRange = getLastMonthRange();

  const [useOptimizedSettings, setUseOptimizedSettings] = useState(true);

  const [symbol, setSymbol] = useState(chartData?.symbol || 'BTCUSDT');
  const [interval, setInterval] = useState<Timeframe>('4h'); // 4h recommended for optimized settings
  const [startDate, setStartDate] = useState(lastMonthRange.start);
  const [endDate, setEndDate] = useState(lastMonthRange.end);
  const [initialCapital, setInitialCapital] = useState('10000');

  const [minProfitPercent, setMinProfitPercent] = useState(String(OPTIMIZED_SETTINGS.minProfitPercent));
  const [onlyWithTrend, setOnlyWithTrend] = useState(OPTIMIZED_SETTINGS.onlyWithTrend);
  const [useAlgorithmicLevels, setUseAlgorithmicLevels] = useState(OPTIMIZED_SETTINGS.useAlgorithmicLevels);
  const [stopLossPercent, setStopLossPercent] = useState('2');
  const [takeProfitPercent, setTakeProfitPercent] = useState('4');
  const [maxPositionSize, setMaxPositionSize] = useState(String(OPTIMIZED_SETTINGS.maxPositionSize));
  const [commission, setCommission] = useState(String(OPTIMIZED_SETTINGS.commission));
  const [minConfidence, setMinConfidence] = useState(String(OPTIMIZED_SETTINGS.minConfidence));

  const effectiveOnlyWithTrend = useOptimizedSettings ? OPTIMIZED_SETTINGS.onlyWithTrend : onlyWithTrend;
  const effectiveUseAlgorithmicLevels = useOptimizedSettings ? OPTIMIZED_SETTINGS.useAlgorithmicLevels : useAlgorithmicLevels;
  const effectiveMaxPositionSize = useOptimizedSettings ? OPTIMIZED_SETTINGS.maxPositionSize : Number(maxPositionSize);
  const effectiveCommission = useOptimizedSettings ? OPTIMIZED_SETTINGS.commission : Number(commission);
  const effectiveMinConfidence = useOptimizedSettings ? OPTIMIZED_SETTINGS.minConfidence : Number(minConfidence);
  const effectiveMinProfitPercent = useOptimizedSettings ? OPTIMIZED_SETTINGS.minProfitPercent : Number(minProfitPercent);

  const enabledSetups = Object.entries(setupConfig)
    .filter(([_key, value]) => {
      return typeof value === 'object' && value !== null && 'enabled' in value && value.enabled === true;
    })
    .map(([key]) => key);

  const handleRunBacktest = async () => {
    if (!startDate || !endDate) return;

    const config: BacktestConfigType = {
      symbol,
      interval,
      startDate,
      endDate,
      initialCapital: Number(initialCapital),
      minProfitPercent: effectiveMinProfitPercent,
      onlyWithTrend: effectiveOnlyWithTrend,
      useAlgorithmicLevels: effectiveUseAlgorithmicLevels,
      stopLossPercent: effectiveUseAlgorithmicLevels ? undefined : Number(stopLossPercent),
      takeProfitPercent: effectiveUseAlgorithmicLevels ? undefined : Number(takeProfitPercent),
      maxPositionSize: effectiveMaxPositionSize,
      commission: effectiveCommission / 100,
      minConfidence: effectiveMinConfidence,
      setupTypes: enabledSetups.length > 0 ? enabledSetups : undefined,
    };

    try {
      const result = await runBacktest(config);

      if (result && onBacktestComplete) {
        onBacktestComplete(result.id);
      }
    } catch (error) {
      console.error('Backtest failed:', error);
    }
  };

  const isValid = startDate && endDate && Number(initialCapital) > 0;

  return (
    <Stack gap={3} p={4}>
      <Flex justify="space-between" align="center" mb={1}>
        <Text fontSize="sm" fontWeight="bold">
          Backtest Configuration
        </Text>
      </Flex>

      {/* Optimized Settings Toggle */}
      <Box p={3} bg="green.50" _dark={{ bg: "green.950" }} borderRadius="md" borderWidth="2px" borderColor="green.500">
        <Checkbox
          checked={useOptimizedSettings}
          onCheckedChange={setUseOptimizedSettings}
        >
          <HStack gap={2}>
            <Text fontSize="xs" fontWeight="bold">Use Optimized Settings</Text>
            <Badge colorPalette="green" size="sm">Recommended</Badge>
          </HStack>
        </Checkbox>
        <Text fontSize="2xs" color="fg.muted" mt={1} ml={6}>
          Uses backtested optimal parameters (PnL +642%, Sharpe 2.84, Max DD 5.5%)
        </Text>
        {useOptimizedSettings && (
          <Box mt={2} ml={6} p={2} bg="bg.subtle" borderRadius="sm">
            <Text fontSize="2xs" color="fg.muted">
              <strong>Active settings:</strong> Algorithmic SL/TP, 10% position size, 0.1% commission, 4h timeframe
            </Text>
          </Box>
        )}
      </Box>

      {/* Selectors Row */}
      <Box p={3} bg="bg.muted" borderRadius="md">
        <Text fontSize="xs" color="fg.muted" mb={2}>
          Market & Setup Selection
        </Text>
        <HStack gap={2} flexWrap="wrap">
          <SymbolSelector value={symbol} onChange={setSymbol} />
          <TimeframeSelector selectedTimeframe={interval} onTimeframeChange={setInterval} />
          <SetupTogglePopover />
        </HStack>
        <Text fontSize="2xs" color="fg.muted" mt={2}>
          {enabledSetups.length > 0
            ? `${enabledSetups.length} setup(s) enabled`
            : 'No setups enabled - will use all setups'}
        </Text>
        {useOptimizedSettings && interval !== '4h' && (
          <Text fontSize="2xs" color="orange.500" mt={1}>
            Note: 4h timeframe is recommended for optimized settings
          </Text>
        )}
      </Box>

      <Stack gap={3}>
        <ChakraField.Root>
          <ChakraField.Label fontSize="xs">Start Date</ChakraField.Label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            style={{
              width: '100%',
              padding: '6px 8px',
              fontSize: '12px',
              borderRadius: '6px',
              border: '1px solid var(--chakra-colors-border-default)',
              backgroundColor: 'var(--chakra-colors-bg-default)',
              color: 'var(--chakra-colors-fg-default)',
            }}
          />
        </ChakraField.Root>

        <ChakraField.Root>
          <ChakraField.Label fontSize="xs">End Date</ChakraField.Label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            style={{
              width: '100%',
              padding: '6px 8px',
              fontSize: '12px',
              borderRadius: '6px',
              border: '1px solid var(--chakra-colors-border-default)',
              backgroundColor: 'var(--chakra-colors-bg-default)',
              color: 'var(--chakra-colors-fg-default)',
            }}
          />
        </ChakraField.Root>

        <ChakraField.Root>
          <ChakraField.Label fontSize="xs">Initial Capital (USDT)</ChakraField.Label>
          <NumberInput
            size="xs"
            value={initialCapital}
            onChange={(e) => setInitialCapital(e.target.value)}
            placeholder="10000"
            step={1000}
            min={0}
          />
        </ChakraField.Root>

        {/* Advanced Settings - hidden when using optimized settings */}
        {!useOptimizedSettings && (
          <>
            <ChakraField.Root>
              <ChakraField.Label fontSize="xs">Min Profit per Trade (%)</ChakraField.Label>
              <NumberInput
                size="xs"
                value={minProfitPercent}
                onChange={(e) => setMinProfitPercent(e.target.value)}
                placeholder="1"
                step={0.5}
                min={0}
              />
              <ChakraField.HelperText fontSize="2xs">
                Skip trades where expected profit after fees is below this percentage
              </ChakraField.HelperText>
            </ChakraField.Root>

            <ChakraField.Root>
              <ChakraField.Label fontSize="xs">Min Confidence (%)</ChakraField.Label>
              <NumberInput
                size="xs"
                value={minConfidence}
                onChange={(e) => setMinConfidence(e.target.value)}
                placeholder="70"
                step={5}
                min={0}
                max={100}
              />
            </ChakraField.Root>

            <Box p={3} bg="blue.50" _dark={{ bg: "blue.950" }} borderRadius="md" borderWidth="2px" borderColor="blue.500">
              <Checkbox
                checked={onlyWithTrend}
                onCheckedChange={setOnlyWithTrend}
              >
                <Text fontSize="xs" fontWeight="medium">Only Trade With Trend</Text>
              </Checkbox>
              <Text fontSize="2xs" color="fg.muted" mt={1} ml={6}>
                Only execute setups aligned with higher timeframe trend (filters counter-trend trades)
              </Text>
            </Box>

            <Box p={3} bg="blue.50" _dark={{ bg: "blue.950" }} borderRadius="md" borderWidth="2px" borderColor="blue.500">
              <Checkbox
                checked={useAlgorithmicLevels}
                onCheckedChange={setUseAlgorithmicLevels}
              >
                <Text fontSize="xs" fontWeight="medium">Use Algorithmic SL/TP</Text>
              </Checkbox>
              <Text fontSize="2xs" color="fg.muted" mt={1} ml={6}>
                When enabled, uses setup's calculated stop-loss and take-profit levels (based on previous highs/lows) instead of fixed percentages
              </Text>
            </Box>

            <ChakraField.Root>
              <ChakraField.Label fontSize="xs">Stop Loss (%)</ChakraField.Label>
              <NumberInput
                size="xs"
                value={stopLossPercent}
                onChange={(e) => setStopLossPercent(e.target.value)}
                placeholder="2"
                step={0.5}
                min={0}
                disabled={useAlgorithmicLevels}
              />
              {useAlgorithmicLevels && (
                <ChakraField.HelperText fontSize="2xs" color="fg.muted">
                  Disabled when using algorithmic levels
                </ChakraField.HelperText>
              )}
            </ChakraField.Root>

            <ChakraField.Root>
              <ChakraField.Label fontSize="xs">Take Profit (%)</ChakraField.Label>
              <NumberInput
                size="xs"
                value={takeProfitPercent}
                onChange={(e) => setTakeProfitPercent(e.target.value)}
                placeholder="4"
                step={0.5}
                min={0}
                disabled={useAlgorithmicLevels}
              />
              {useAlgorithmicLevels && (
                <ChakraField.HelperText fontSize="2xs" color="fg.muted">
                  Disabled when using algorithmic levels
                </ChakraField.HelperText>
              )}
            </ChakraField.Root>

            <ChakraField.Root>
              <ChakraField.Label fontSize="xs">Max Position Size (%)</ChakraField.Label>
              <NumberInput
                size="xs"
                value={maxPositionSize}
                onChange={(e) => setMaxPositionSize(e.target.value)}
                placeholder="10"
                step={1}
                min={0}
                max={100}
              />
              <ChakraField.HelperText fontSize="2xs">
                % of capital per trade
              </ChakraField.HelperText>
            </ChakraField.Root>

            <ChakraField.Root>
              <ChakraField.Label fontSize="xs">Commission (%)</ChakraField.Label>
              <NumberInput
                size="xs"
                value={commission}
                onChange={(e) => setCommission(e.target.value)}
                placeholder="0.1"
                step={0.01}
                min={0}
                max={1}
              />
              <ChakraField.HelperText fontSize="2xs">
                Trading fee per side
              </ChakraField.HelperText>
            </ChakraField.Root>
          </>
        )}

        {/* Loading indicator */}
        {isRunningBacktest && (
          <Box p={3} bg="blue.50" borderRadius="md" _dark={{ bg: 'blue.900' }}>
            <Text fontSize="xs" color="blue.600" _dark={{ color: 'blue.300' }}>
              Running backtest on server... This may take a moment.
            </Text>
          </Box>
        )}

        {runBacktestError && (
          <Box p={3} bg="red.50" borderRadius="md" _dark={{ bg: 'red.900' }}>
            <Text fontSize="xs" color="red.600" _dark={{ color: 'red.300' }}>
              {runBacktestError.message}
            </Text>
          </Box>
        )}

        <Button
          size="xs"
          colorPalette="blue"
          onClick={handleRunBacktest}
          disabled={!isValid || isRunningBacktest}
          width="full"
          loading={isRunningBacktest}
        >
          {isRunningBacktest ? 'Running Backtest...' : 'Run Backtest'}
        </Button>
      </Stack>
    </Stack>
  );
};
