import { Box, Flex, HStack, Stack, Text } from '@chakra-ui/react';
import { Field as ChakraField } from '@chakra-ui/react/field';
import { TimeframeSelector, type Timeframe } from '@renderer/components/Chart/TimeframeSelector';
import { SetupTogglePopover } from '@renderer/components/Layout/SetupTogglePopover';
import { SymbolSelector } from '@renderer/components/SymbolSelector';
import { Button } from '@renderer/components/ui/button';
import { NumberInput } from '@renderer/components/ui/number-input';
import { useChartContext } from '@renderer/context/ChartContext';
import { useBacktesting } from '@renderer/hooks/useBacktesting';
import { useSetupStore } from '@renderer/store/setupStore';
import type { MarketDataService } from '@renderer/services/market/MarketDataService';
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

  const [symbol, setSymbol] = useState(chartData?.symbol || 'BTCUSDT');
  const [interval, setInterval] = useState<Timeframe>('1h');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [initialCapital, setInitialCapital] = useState('10000');
  const [stopLossPercent, setStopLossPercent] = useState('2');
  const [takeProfitPercent, setTakeProfitPercent] = useState('4');
  const [maxPositionSize, setMaxPositionSize] = useState('10');
  const [commission, setCommission] = useState('0.1');
  const [minConfidence, setMinConfidence] = useState('70');

  // Get enabled setups from setup config
  const enabledSetups = Object.entries(setupConfig)
    .filter(([key, value]) => {
      // Check if this is a setup config object (has 'enabled' property)
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
      stopLossPercent: Number(stopLossPercent),
      takeProfitPercent: Number(takeProfitPercent),
      maxPositionSize: Number(maxPositionSize),
      commission: Number(commission) / 100,
      minConfidence: Number(minConfidence),
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

        <ChakraField.Root>
          <ChakraField.Label fontSize="xs">Stop Loss (%)</ChakraField.Label>
          <NumberInput
            size="xs"
            value={stopLossPercent}
            onChange={(e) => setStopLossPercent(e.target.value)}
            placeholder="2"
            step={0.5}
            min={0}
          />
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
          />
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
