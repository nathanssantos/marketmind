import { Box, Flex, HStack, Stack, Text } from '@chakra-ui/react';
import { Field as ChakraField } from '@chakra-ui/react/field';
import { TimeframeSelector, type Timeframe } from '@renderer/components/Chart/TimeframeSelector';
import { SetupTogglePopover } from '@renderer/components/Layout/SetupTogglePopover';
import { SymbolSelector } from '@renderer/components/SymbolSelector';
import { Button } from '@renderer/components/ui/button';
import { Checkbox } from '@renderer/components/ui/checkbox';
import { NumberInput } from '@renderer/components/ui/number-input';
import { useChartContext } from '@renderer/context/ChartContext';
import { useBacktesting } from '@renderer/hooks/useBacktesting';
import type { MarketDataService } from '@renderer/services/market/MarketDataService';
import { useSetupStore } from '@renderer/store/setupStore';
import type { BacktestConfig as BacktestConfigType } from '@shared/types/backtesting';
import { useState } from 'react';

interface BacktestConfigProps {
  onBacktestComplete?: (resultId: string) => void;
  marketService: MarketDataService;
}

export const BacktestConfig = ({ onBacktestComplete, marketService }: BacktestConfigProps) => {
  const { chartData } = useChartContext();
  const { runBacktest, isRunningBacktest, runBacktestError } = useBacktesting();
  const { config: setupConfig } = useSetupStore();

  // Calculate last month's date range
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

  const [symbol, setSymbol] = useState(chartData?.symbol || 'BTCUSDT');
  const [interval, setInterval] = useState<Timeframe>('1h');
  const [startDate, setStartDate] = useState(lastMonthRange.start);
  const [endDate, setEndDate] = useState(lastMonthRange.end);
  const [initialCapital, setInitialCapital] = useState('10000');
  const [minProfitPercent, setMinProfitPercent] = useState('2');
  const [onlyWithTrend, setOnlyWithTrend] = useState(true);
  const [useAlgorithmicLevels, setUseAlgorithmicLevels] = useState(true);
  const [stopLossPercent, setStopLossPercent] = useState('2');
  const [takeProfitPercent, setTakeProfitPercent] = useState('4');
  const [maxPositionSize, setMaxPositionSize] = useState('10');
  const [commission, setCommission] = useState('0.1');
  const [minConfidence, setMinConfidence] = useState('0');

  // Risk Management
  const [useKellyCriterion, setUseKellyCriterion] = useState(false);
  const [kellyFraction, setKellyFraction] = useState('0.25'); // Quarter Kelly
  const [riskProfile, setRiskProfile] = useState<'conservative' | 'moderate' | 'aggressive'>('moderate');

  // Trailing Stop
  const [useTrailingStop, setUseTrailingStop] = useState(true);
  const [trailingStopATRMultiplier, setTrailingStopATRMultiplier] = useState('2.0');
  const [trailingATRMultiplier, setTrailingATRMultiplier] = useState('1.5');
  const [breakEvenAfterR, setBreakEvenAfterR] = useState('1.0');
  const [breakEvenBuffer, setBreakEvenBuffer] = useState('0.1');

  // Partial Exits
  const [usePartialExits, setUsePartialExits] = useState(true);
  const [partialExit1Percent, setPartialExit1Percent] = useState('33');
  const [partialExit1R, setPartialExit1R] = useState('1.5');
  const [partialExit2Percent, setPartialExit2Percent] = useState('33');
  const [partialExit2R, setPartialExit2R] = useState('2.5');
  const [lockProfitsAfterFirstExit, setLockProfitsAfterFirstExit] = useState(true);

  // Get enabled setups from setup config
  const enabledSetups = Object.entries(setupConfig)
    .filter(([_key, value]) => {
      return typeof value === 'object' && value !== null && 'enabled' in value && value.enabled === true;
    })
    .map(([key]) => key);

  const handleRunBacktest = async () => {
    if (!startDate || !endDate) return;

    const partialExitLevels = usePartialExits ? [
      { percentage: Number(partialExit1Percent) / 100, rMultiple: Number(partialExit1R) },
      { percentage: Number(partialExit2Percent) / 100, rMultiple: Number(partialExit2R) },
      { percentage: (100 - Number(partialExit1Percent) - Number(partialExit2Percent)) / 100, rMultiple: 0 },
    ] : undefined;

    const config: BacktestConfigType = {
      symbol,
      interval,
      startDate,
      endDate,
      initialCapital: Number(initialCapital),
      minProfitPercent: Number(minProfitPercent),
      onlyWithTrend,
      useAlgorithmicLevels,
      stopLossPercent: Number(stopLossPercent),
      takeProfitPercent: Number(takeProfitPercent),
      maxPositionSize: Number(maxPositionSize),
      commission: Number(commission) / 100,
      minConfidence: Number(minConfidence),
      setupTypes: enabledSetups.length > 0 ? enabledSetups : undefined,

      // Risk Management
      useKellyCriterion,
      kellyFraction: Number(kellyFraction),
      riskProfile,

      // Trailing Stop
      useTrailingStop,
      trailingStopATRMultiplier: Number(trailingStopATRMultiplier),
      trailingATRMultiplier: Number(trailingATRMultiplier),
      breakEvenAfterR: Number(breakEvenAfterR),
      breakEvenBuffer: Number(breakEvenBuffer),

      // Partial Exits
      usePartialExits,
      partialExitLevels,
      lockProfitsAfterFirstExit,
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

      {/* Selectors Row */}
      <Box p={3} bg="bg.muted" borderRadius="md">
        <Text fontSize="xs" color="fg.muted" mb={2}>
          Market & Setup Selection
        </Text>
        <HStack gap={2} flexWrap="wrap">
          <SymbolSelector marketService={marketService} value={symbol} onChange={setSymbol} />
          <TimeframeSelector selectedTimeframe={interval} onTimeframeChange={setInterval} />
          <SetupTogglePopover />
        </HStack>
        <Text fontSize="2xs" color="fg.muted" mt={2}>
          {enabledSetups.length > 0
            ? `${enabledSetups.length} setup(s) enabled`
            : 'No setups enabled - will use all setups'}
        </Text>
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

        {/* Risk Management Section */}
        <Box p={3} bg="purple.50" _dark={{ bg: "purple.950" }} borderRadius="md" borderWidth="2px" borderColor="purple.500">
          <Text fontSize="xs" fontWeight="bold" mb={2}>💰 Risk Management (Kelly Criterion)</Text>

          <Box mb={2}>
            <Checkbox
              checked={useKellyCriterion}
              onCheckedChange={setUseKellyCriterion}
            >
              <Text fontSize="xs" fontWeight="medium">Enable Kelly Criterion Position Sizing</Text>
            </Checkbox>
          </Box>

          {useKellyCriterion && (
            <Stack gap={2} ml={6}>
              <ChakraField.Root>
                <ChakraField.Label fontSize="2xs">Risk Profile</ChakraField.Label>
                <select
                  value={riskProfile}
                  onChange={(e) => setRiskProfile(e.target.value as 'conservative' | 'moderate' | 'aggressive')}
                  style={{
                    width: '100%',
                    padding: '4px 8px',
                    fontSize: '12px',
                    borderRadius: '6px',
                    border: '1px solid var(--chakra-colors-border-default)',
                    backgroundColor: 'var(--chakra-colors-bg-default)',
                    color: 'var(--chakra-colors-fg-default)',
                  }}
                >
                  <option value="conservative">Conservative (Low Risk)</option>
                  <option value="moderate">Moderate (Balanced)</option>
                  <option value="aggressive">Aggressive (High Risk)</option>
                </select>
                <ChakraField.HelperText fontSize="2xs">
                  Presets: Conservative (¼ Kelly), Moderate (½ Kelly), Aggressive (Full Kelly)
                </ChakraField.HelperText>
              </ChakraField.Root>

              <ChakraField.Root>
                <ChakraField.Label fontSize="2xs">Kelly Fraction</ChakraField.Label>
                <NumberInput
                  size="xs"
                  value={kellyFraction}
                  onChange={(e) => setKellyFraction(e.target.value)}
                  placeholder="0.25"
                  step={0.05}
                  min={0.01}
                  max={1.0}
                />
                <ChakraField.HelperText fontSize="2xs">
                  0.25 = Quarter Kelly (Safest), 0.5 = Half Kelly, 1.0 = Full Kelly (Aggressive)
                </ChakraField.HelperText>
              </ChakraField.Root>
            </Stack>
          )}

          <Text fontSize="2xs" color="fg.muted" mt={2}>
            Uses statistical analysis of past trades to optimize position sizes based on win rate and risk/reward
          </Text>
        </Box>

        {/* Trailing Stop Section */}
        <Box p={3} bg="green.50" _dark={{ bg: "green.950" }} borderRadius="md" borderWidth="2px" borderColor="green.500">
          <Text fontSize="xs" fontWeight="bold" mb={2}>📈 ATR-Based Trailing Stop</Text>

          <Box mb={2}>
            <Checkbox
              checked={useTrailingStop}
              onCheckedChange={setUseTrailingStop}
            >
              <Text fontSize="xs" fontWeight="medium">Enable Trailing Stop</Text>
            </Checkbox>
          </Box>

          {useTrailingStop && (
            <Stack gap={2} ml={6}>
              <ChakraField.Root>
                <ChakraField.Label fontSize="2xs">Initial Stop ATR Multiplier</ChakraField.Label>
                <NumberInput
                  size="xs"
                  value={trailingStopATRMultiplier}
                  onChange={(e) => setTrailingStopATRMultiplier(e.target.value)}
                  placeholder="2.0"
                  step={0.1}
                  min={0.5}
                  max={5.0}
                />
                <ChakraField.HelperText fontSize="2xs">
                  Initial stop loss distance from entry (in ATR units)
                </ChakraField.HelperText>
              </ChakraField.Root>

              <ChakraField.Root>
                <ChakraField.Label fontSize="2xs">Trailing ATR Multiplier</ChakraField.Label>
                <NumberInput
                  size="xs"
                  value={trailingATRMultiplier}
                  onChange={(e) => setTrailingATRMultiplier(e.target.value)}
                  placeholder="1.5"
                  step={0.1}
                  min={0.5}
                  max={5.0}
                />
                <ChakraField.HelperText fontSize="2xs">
                  Distance to maintain when trailing behind price
                </ChakraField.HelperText>
              </ChakraField.Root>

              <ChakraField.Root>
                <ChakraField.Label fontSize="2xs">Break-Even After (R-Multiple)</ChakraField.Label>
                <NumberInput
                  size="xs"
                  value={breakEvenAfterR}
                  onChange={(e) => setBreakEvenAfterR(e.target.value)}
                  placeholder="1.0"
                  step={0.1}
                  min={0.1}
                  max={5.0}
                />
                <ChakraField.HelperText fontSize="2xs">
                  Move stop to entry + buffer after this profit (1.0 = 1R profit)
                </ChakraField.HelperText>
              </ChakraField.Root>

              <ChakraField.Root>
                <ChakraField.Label fontSize="2xs">Break-Even Buffer (%)</ChakraField.Label>
                <NumberInput
                  size="xs"
                  value={breakEvenBuffer}
                  onChange={(e) => setBreakEvenBuffer(e.target.value)}
                  placeholder="0.1"
                  step={0.05}
                  min={0}
                  max={1.0}
                />
                <ChakraField.HelperText fontSize="2xs">
                  Small buffer above entry for break-even stop
                </ChakraField.HelperText>
              </ChakraField.Root>
            </Stack>
          )}

          <Text fontSize="2xs" color="fg.muted" mt={2}>
            Automatically adjusts stop loss based on volatility (ATR), locks in profits as price moves favorably
          </Text>
        </Box>

        {/* Partial Exits Section */}
        <Box p={3} bg="orange.50" _dark={{ bg: "orange.950" }} borderRadius="md" borderWidth="2px" borderColor="orange.500">
          <Text fontSize="xs" fontWeight="bold" mb={2}>🎯 Partial Exits (Scale Out)</Text>

          <Box mb={2}>
            <Checkbox
              checked={usePartialExits}
              onCheckedChange={setUsePartialExits}
            >
              <Text fontSize="xs" fontWeight="medium">Enable Partial Exits</Text>
            </Checkbox>
          </Box>

          {usePartialExits && (
            <Stack gap={2} ml={6}>
              <Box p={2} bg="bg.default" borderRadius="md" borderWidth="1px">
                <Text fontSize="2xs" fontWeight="medium" mb={1}>First Exit Level</Text>
                <HStack gap={2}>
                  <ChakraField.Root flex={1}>
                    <ChakraField.Label fontSize="2xs">Exit %</ChakraField.Label>
                    <NumberInput
                      size="xs"
                      value={partialExit1Percent}
                      onChange={(e) => setPartialExit1Percent(e.target.value)}
                      placeholder="33"
                      step={5}
                      min={0}
                      max={100}
                    />
                  </ChakraField.Root>
                  <ChakraField.Root flex={1}>
                    <ChakraField.Label fontSize="2xs">At R-Multiple</ChakraField.Label>
                    <NumberInput
                      size="xs"
                      value={partialExit1R}
                      onChange={(e) => setPartialExit1R(e.target.value)}
                      placeholder="1.5"
                      step={0.1}
                      min={0.1}
                      max={10.0}
                    />
                  </ChakraField.Root>
                </HStack>
              </Box>

              <Box p={2} bg="bg.default" borderRadius="md" borderWidth="1px">
                <Text fontSize="2xs" fontWeight="medium" mb={1}>Second Exit Level</Text>
                <HStack gap={2}>
                  <ChakraField.Root flex={1}>
                    <ChakraField.Label fontSize="2xs">Exit %</ChakraField.Label>
                    <NumberInput
                      size="xs"
                      value={partialExit2Percent}
                      onChange={(e) => setPartialExit2Percent(e.target.value)}
                      placeholder="33"
                      step={5}
                      min={0}
                      max={100}
                    />
                  </ChakraField.Root>
                  <ChakraField.Root flex={1}>
                    <ChakraField.Label fontSize="2xs">At R-Multiple</ChakraField.Label>
                    <NumberInput
                      size="xs"
                      value={partialExit2R}
                      onChange={(e) => setPartialExit2R(e.target.value)}
                      placeholder="2.5"
                      step={0.1}
                      min={0.1}
                      max={10.0}
                    />
                  </ChakraField.Root>
                </HStack>
              </Box>

              <Text fontSize="2xs" color="fg.muted">
                Remaining {100 - Number(partialExit1Percent) - Number(partialExit2Percent)}% trails with stop
              </Text>

              <Checkbox
                checked={lockProfitsAfterFirstExit}
                onCheckedChange={setLockProfitsAfterFirstExit}
              >
                <Text fontSize="2xs" fontWeight="medium">Lock Profits After First Exit</Text>
              </Checkbox>
              <Text fontSize="2xs" color="fg.muted" ml={6}>
                Move stop to break-even after first partial exit is triggered
              </Text>
            </Stack>
          )}

          <Text fontSize="2xs" color="fg.muted" mt={2}>
            Take profits at multiple levels to lock in gains while letting winners run
          </Text>
        </Box>

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
