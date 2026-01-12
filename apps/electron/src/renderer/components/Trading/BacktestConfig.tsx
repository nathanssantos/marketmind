import { Badge, Box, Flex, Group, HStack, Stack, Text, Icon } from '@chakra-ui/react';
import { Field as ChakraField } from '@chakra-ui/react/field';
import { TimeframeSelector, type Timeframe } from '@renderer/components/Chart/TimeframeSelector';
import { SetupTogglePopover } from '@renderer/components/Layout/SetupTogglePopover';
import { SymbolSelector } from '@renderer/components/SymbolSelector';
import { BulkSymbolSelector } from './BulkSymbolSelector';
import { Button } from '@renderer/components/ui/button';
import { Checkbox } from '@renderer/components/ui/checkbox';
import { NumberInput } from '@renderer/components/ui/number-input';
import { useChartContext } from '@renderer/context/ChartContext';
import { useBackendAutoTrading } from '@renderer/hooks/useBackendAutoTrading';
import { useBackendWallet } from '@renderer/hooks/useBackendWallet';
import { useBacktesting } from '@renderer/hooks/useBacktesting';
import { useSetupStore } from '@renderer/store/setupStore';
import type { BacktestConfig as BacktestConfigType, MarketType } from '@marketmind/types';
import { BINANCE_DEFAULT_FEES } from '@marketmind/types';
import { useState, useCallback } from 'react';
import { LuDownload } from 'react-icons/lu';

interface BacktestConfigProps {
  onBacktestComplete?: (resultId: string) => void;
}

export const BacktestConfig = ({ onBacktestComplete }: BacktestConfigProps) => {
  const { chartData } = useChartContext();
  const { runBacktest, runMultiWatcherBacktest, isRunningBacktest, runBacktestError } = useBacktesting();
  const { config: setupConfig, setConfig: setSetupConfig } = useSetupStore();
  const { wallets } = useBackendWallet();
  const activeWalletId = wallets[0]?.id ?? '';
  const { config: autoTradingConfig, isLoadingConfig } = useBackendAutoTrading(activeWalletId);

  const getLastMonthRange = () => {
    const now = new Date();
    const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    return {
      start: firstDayLastMonth.toISOString().split('T')[0],
      end: lastDayLastMonth.toISOString().split('T')[0],
    };
  };

  const getLastYearRange = () => {
    const now = new Date();
    const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return {
      start: oneYearAgo.toISOString().split('T')[0],
      end: today.toISOString().split('T')[0],
    };
  };

  const lastMonthRange = getLastMonthRange();

  const [useAutoTradingSettings, setUseAutoTradingSettings] = useState(false);
  const [isMultiMode, setIsMultiMode] = useState(false);
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>([]);
  const [marketType, setMarketType] = useState<MarketType>('SPOT');

  const [symbol, setSymbol] = useState(chartData?.symbol || 'BTCUSDT');
  const [interval, setInterval] = useState<Timeframe>('4h');
  const [startDate, setStartDate] = useState(lastMonthRange.start);
  const [endDate, setEndDate] = useState(lastMonthRange.end);
  const [initialCapital, setInitialCapital] = useState('10000');

  const [minProfitPercent, setMinProfitPercent] = useState('0');
  const [onlyWithTrend, setOnlyWithTrend] = useState(false);
  const [useAlgorithmicLevels, setUseAlgorithmicLevels] = useState(true);
  const [stopLossPercent, setStopLossPercent] = useState('2');
  const [takeProfitPercent, setTakeProfitPercent] = useState('4');
  const [commission, setCommission] = useState(String(BINANCE_DEFAULT_FEES.VIP_0_TAKER * 100));
  const [minConfidence, setMinConfidence] = useState('0');

  const [useStochasticFilter, setUseStochasticFilter] = useState(false);
  const [useAdxFilter, setUseAdxFilter] = useState(false);
  const [useMtfFilter, setUseMtfFilter] = useState(true);
  const [useBtcCorrelationFilter, setUseBtcCorrelationFilter] = useState(true);
  const [useMarketRegimeFilter, setUseMarketRegimeFilter] = useState(true);
  const [useVolumeFilter, setUseVolumeFilter] = useState(false);
  const [useMomentumTimingFilter, setUseMomentumTimingFilter] = useState(true);
  const [useConfluenceScoring, setUseConfluenceScoring] = useState(true);
  const [confluenceMinScore, setConfluenceMinScore] = useState('60');
  const [tpCalculationMode, setTpCalculationMode] = useState<'default' | 'fibonacci'>('default');
  const [fibonacciTargetLevel, setFibonacciTargetLevel] = useState<'auto' | '1.272' | '1.618' | '2'>('auto');

  const loadFromAutoTrading = useCallback(() => {
    if (!autoTradingConfig) return;

    setUseAutoTradingSettings(true);

    setOnlyWithTrend(autoTradingConfig.useTrendFilter ?? false);
    setUseStochasticFilter(autoTradingConfig.useStochasticFilter ?? false);
    setUseAdxFilter(autoTradingConfig.useAdxFilter ?? false);
    setUseMtfFilter(autoTradingConfig.useMtfFilter ?? true);
    setUseBtcCorrelationFilter(autoTradingConfig.useBtcCorrelationFilter ?? true);
    setUseMarketRegimeFilter(autoTradingConfig.useMarketRegimeFilter ?? true);
    setUseVolumeFilter(autoTradingConfig.useVolumeFilter ?? false);
    setUseMomentumTimingFilter(autoTradingConfig.useMomentumTimingFilter ?? true);
    setUseConfluenceScoring(autoTradingConfig.useConfluenceScoring ?? true);
    setConfluenceMinScore(String(autoTradingConfig.confluenceMinScore ?? 60));
    setTpCalculationMode(autoTradingConfig.tpCalculationMode ?? 'default');
    setFibonacciTargetLevel(autoTradingConfig.fibonacciTargetLevel ?? 'auto');

    const lastYearRange = getLastYearRange();
    setStartDate(lastYearRange.start);
    setEndDate(lastYearRange.end);

    if (autoTradingConfig.enabledSetupTypes) {
      setSetupConfig({ enabledStrategies: autoTradingConfig.enabledSetupTypes });
    }
  }, [autoTradingConfig, setSetupConfig]);


  const handleMarketTypeChange = (newMarketType: MarketType) => {
    setMarketType(newMarketType);
    setSelectedSymbols([]);
  };

  const enabledSetups = setupConfig.enabledStrategies ?? [];

  const handleRunBacktest = async () => {
    if (!startDate || !endDate) return;

    const filterSettings = useAutoTradingSettings ? {
      useStochasticFilter,
      useAdxFilter,
      useTrendFilter: onlyWithTrend,
      useMtfFilter,
      useBtcCorrelationFilter,
      useMarketRegimeFilter,
      useVolumeFilter,
      useMomentumTimingFilter,
      useConfluenceScoring,
      confluenceMinScore: Number(confluenceMinScore),
      tpCalculationMode,
      fibonacciTargetLevel: tpCalculationMode === 'fibonacci' ? fibonacciTargetLevel : undefined,
      trendFilterPeriod: 21,
    } : {};

    try {
      if (isMultiMode && selectedSymbols.length > 0) {
        const watchers = selectedSymbols.map((sym) => ({
          symbol: sym,
          interval,
          setupTypes: enabledSetups.length > 0 ? enabledSetups : undefined,
          marketType,
        }));

        const result = await runMultiWatcherBacktest({
          watchers,
          startDate,
          endDate,
          initialCapital: Number(initialCapital),
          marketType,
          onlyWithTrend: useAutoTradingSettings ? onlyWithTrend : undefined,
          useTrailingStop: false,
          ...filterSettings,
        });

        if (result && onBacktestComplete) {
          onBacktestComplete(result.id);
        }
      } else {
        const config: BacktestConfigType = {
          symbol,
          interval,
          startDate,
          endDate,
          initialCapital: Number(initialCapital),
          minProfitPercent: Number(minProfitPercent),
          onlyWithTrend,
          useAlgorithmicLevels,
          stopLossPercent: useAlgorithmicLevels ? undefined : Number(stopLossPercent),
          takeProfitPercent: useAlgorithmicLevels ? undefined : Number(takeProfitPercent),
          commission: Number(commission) / 100,
          minConfidence: Number(minConfidence),
          setupTypes: enabledSetups.length > 0 ? enabledSetups : undefined,
          useTrailingStop: false,
          ...filterSettings,
        };

        const result = await runBacktest(config) as { id: string } | null;

        if (result && onBacktestComplete) {
          onBacktestComplete(result.id);
        }
      }
    } catch (error) {
      console.error('Backtest failed:', error);
    }
  };

  const isValid = startDate && endDate && Number(initialCapital) > 0 &&
    (isMultiMode ? selectedSymbols.length > 0 : symbol.trim().length > 0);

  return (
    <Stack gap={3} p={4}>
      <Flex justify="space-between" align="center" mb={1}>
        <Text fontSize="sm" fontWeight="bold">
          Backtest Configuration
        </Text>
        {activeWalletId && (
          <Button
            size="2xs"
            variant="outline"
            onClick={loadFromAutoTrading}
            disabled={isLoadingConfig || !autoTradingConfig}
            loading={isLoadingConfig}
          >
            <Icon as={LuDownload} mr={1} />
            Load from Auto-Trading
          </Button>
        )}
      </Flex>

      {useAutoTradingSettings && (
        <Box p={3} bg="purple.50" _dark={{ bg: "purple.950" }} borderRadius="md" borderWidth="2px" borderColor="purple.500">
          <HStack gap={2}>
            <Badge colorPalette="purple" size="sm">Auto-Trading Config Loaded</Badge>
          </HStack>
          <Text fontSize="2xs" color="fg.muted" mt={1}>
            Settings loaded from your auto-trading configuration. You can edit them below before running the backtest.
          </Text>
        </Box>
      )}

      {/* Selectors Row */}
      <Box p={3} bg="bg.muted" borderRadius="md">
        <Flex justify="space-between" align="center" mb={2}>
          <Text fontSize="xs" color="fg.muted">
            Market & Setup Selection
          </Text>
          <Group attached>
            <Button
              size="2xs"
              variant={!isMultiMode ? 'solid' : 'outline'}
              onClick={() => setIsMultiMode(false)}
            >
              Single
            </Button>
            <Button
              size="2xs"
              variant={isMultiMode ? 'solid' : 'outline'}
              onClick={() => setIsMultiMode(true)}
            >
              Multi
            </Button>
          </Group>
        </Flex>

        {!isMultiMode ? (
          <HStack gap={2} flexWrap="wrap">
            <SymbolSelector value={symbol} onChange={setSymbol} />
            <TimeframeSelector selectedTimeframe={interval} onTimeframeChange={setInterval} />
            <SetupTogglePopover />
          </HStack>
        ) : (
          <Stack gap={3}>
            <HStack gap={2}>
              <TimeframeSelector selectedTimeframe={interval} onTimeframeChange={setInterval} />
              <SetupTogglePopover />
            </HStack>
            <BulkSymbolSelector
              selectedSymbols={selectedSymbols}
              onSymbolsChange={setSelectedSymbols}
              marketType={marketType}
              onMarketTypeChange={handleMarketTypeChange}
              limit={50}
              showMarketTypeToggle
              maxHeight="150px"
            />
          </Stack>
        )}

        <Text fontSize="2xs" color="fg.muted" mt={2}>
          {isMultiMode
            ? `${selectedSymbols.length} symbol(s) selected, ${enabledSetups.length > 0 ? `${enabledSetups.length} setup(s) enabled` : 'all setups'}`
            : `${enabledSetups.length > 0 ? `${enabledSetups.length} setup(s) enabled` : 'No setups enabled - will use all setups'}`}
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

        {/* Advanced Settings */}
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

        {/* Filter Settings - shown when auto-trading config is loaded */}
        {useAutoTradingSettings && (
          <>
            <Box p={3} bg="bg.muted" borderRadius="md">
              <Text fontSize="xs" fontWeight="medium" mb={2}>
                Filters (from Auto-Trading)
              </Text>
              <Stack gap={2}>
                <Checkbox checked={useMtfFilter} onCheckedChange={setUseMtfFilter}>
                  <Text fontSize="2xs">MTF Filter (EMA50/200)</Text>
                </Checkbox>
                <Checkbox checked={useBtcCorrelationFilter} onCheckedChange={setUseBtcCorrelationFilter}>
                  <Text fontSize="2xs">BTC Correlation Filter</Text>
                </Checkbox>
                <Checkbox checked={useMarketRegimeFilter} onCheckedChange={setUseMarketRegimeFilter}>
                  <Text fontSize="2xs">Market Regime Filter</Text>
                </Checkbox>
                <Checkbox checked={useMomentumTimingFilter} onCheckedChange={setUseMomentumTimingFilter}>
                  <Text fontSize="2xs">Momentum Timing Filter</Text>
                </Checkbox>
                <Checkbox checked={useConfluenceScoring} onCheckedChange={setUseConfluenceScoring}>
                  <Text fontSize="2xs">Confluence Scoring</Text>
                </Checkbox>
                <Checkbox checked={useStochasticFilter} onCheckedChange={setUseStochasticFilter}>
                  <Text fontSize="2xs">Stochastic Filter</Text>
                </Checkbox>
                <Checkbox checked={useAdxFilter} onCheckedChange={setUseAdxFilter}>
                  <Text fontSize="2xs">ADX Filter</Text>
                </Checkbox>
                <Checkbox checked={useVolumeFilter} onCheckedChange={setUseVolumeFilter}>
                  <Text fontSize="2xs">Volume Filter</Text>
                </Checkbox>
                {useConfluenceScoring && (
                  <ChakraField.Root mt={2}>
                    <ChakraField.Label fontSize="xs">Min Confluence Score (%)</ChakraField.Label>
                    <NumberInput
                      size="xs"
                      value={confluenceMinScore}
                      onChange={(e) => setConfluenceMinScore(e.target.value)}
                      placeholder="60"
                      step={5}
                      min={0}
                      max={100}
                    />
                  </ChakraField.Root>
                )}
              </Stack>
            </Box>

            <Box p={3} bg="bg.muted" borderRadius="md">
              <Text fontSize="xs" fontWeight="medium" mb={2}>
                Take Profit Mode
              </Text>
              <HStack gap={2} mb={2}>
                <Button
                  size="2xs"
                  variant={tpCalculationMode === 'default' ? 'solid' : 'outline'}
                  onClick={() => setTpCalculationMode('default')}
                >
                  ATR-based
                </Button>
                <Button
                  size="2xs"
                  variant={tpCalculationMode === 'fibonacci' ? 'solid' : 'outline'}
                  onClick={() => setTpCalculationMode('fibonacci')}
                >
                  Fibonacci
                </Button>
              </HStack>
              {tpCalculationMode === 'fibonacci' && (
                <HStack gap={1} flexWrap="wrap">
                  {(['auto', '1.272', '1.618', '2'] as const).map((level) => (
                    <Button
                      key={level}
                      size="2xs"
                      variant={fibonacciTargetLevel === level ? 'solid' : 'ghost'}
                      onClick={() => setFibonacciTargetLevel(level)}
                    >
                      {level === 'auto' ? 'Auto' : `${level}%`}
                    </Button>
                  ))}
                </HStack>
              )}
            </Box>
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
          {isRunningBacktest
            ? 'Running Backtest...'
            : isMultiMode
              ? `Run Multi-Symbol Backtest (${selectedSymbols.length})`
              : 'Run Backtest'}
        </Button>
      </Stack>
    </Stack>
  );
};
