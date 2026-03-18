import { VStack } from '@chakra-ui/react';
import { DirectionModeSelector, FormDialog, type DirectionMode } from '@renderer/components/ui';
import { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { ScalpingStrategy, ScalpingExecutionMode } from '@marketmind/types';
import { SCALPING_DEFAULTS } from '@marketmind/types';
import { useBackendScalping } from '@renderer/hooks/useBackendScalping';
import { StrategySection } from './StrategySection';
import { ExecutionSection } from './ExecutionSection';
import { RiskSection } from './RiskSection';
import { SymbolSection } from './SymbolSection';
import { ChartSection } from './ChartSection';

interface ScalpingConfigDialogProps {
  walletId: string;
  isOpen: boolean;
  onClose: () => void;
}

const get = (data: Record<string, unknown> | null | undefined, key: string, fallback: unknown) =>
  data?.[key] ?? fallback;

const buildParams = (data: Record<string, unknown> | null | undefined) => ({
  executionMode: String(get(data, 'executionMode', 'POST_ONLY')),
  positionSizePercent: parseFloat(String(get(data, 'positionSizePercent', 1))),
  maxConcurrentPositions: Number(get(data, 'maxConcurrentPositions', 1)),
  maxDailyTrades: Number(get(data, 'maxDailyTrades', 50)),
  maxDailyLossPercent: parseFloat(String(get(data, 'maxDailyLossPercent', SCALPING_DEFAULTS.MAX_DAILY_LOSS_PERCENT))),
  imbalanceThreshold: parseFloat(String(get(data, 'imbalanceThreshold', SCALPING_DEFAULTS.IMBALANCE_THRESHOLD))),
  cvdDivergenceBars: Number(get(data, 'cvdDivergenceBars', SCALPING_DEFAULTS.CVD_DIVERGENCE_BARS)),
  vwapDeviationSigma: parseFloat(String(get(data, 'vwapDeviationSigma', SCALPING_DEFAULTS.VWAP_DEVIATION_SIGMA))),
  absorptionThreshold: parseFloat(String(get(data, 'absorptionThreshold', SCALPING_DEFAULTS.ABSORPTION_VOLUME_THRESHOLD))),
  maxSpreadPercent: parseFloat(String(get(data, 'maxSpreadPercent', SCALPING_DEFAULTS.MAX_SPREAD_PERCENT))),
  microTrailingTicks: Number(get(data, 'microTrailingTicks', SCALPING_DEFAULTS.MICRO_TRAILING_TICKS)),
  ticksPerBar: Number(get(data, 'ticksPerBar', SCALPING_DEFAULTS.TICK_SIZE)),
  volumePerBar: parseFloat(String(get(data, 'volumePerBar', SCALPING_DEFAULTS.VOLUME_BAR_SIZE))),
  depthLevels: Number(get(data, 'depthLevels', SCALPING_DEFAULTS.DEPTH_LEVELS)),
  circuitBreakerEnabled: Boolean(get(data, 'circuitBreakerEnabled', true)),
  circuitBreakerLossPercent: parseFloat(String(get(data, 'circuitBreakerLossPercent', SCALPING_DEFAULTS.CIRCUIT_BREAKER_LOSS_PERCENT))),
  circuitBreakerMaxTrades: Number(get(data, 'circuitBreakerMaxTrades', SCALPING_DEFAULTS.CIRCUIT_BREAKER_MAX_TRADES)),
  signalInterval: String(get(data, 'signalInterval', SCALPING_DEFAULTS.SIGNAL_INTERVAL)),
});

export function ScalpingConfigDialog({ walletId, isOpen, onClose }: ScalpingConfigDialogProps) {
  const { t } = useTranslation();
  const { config, upsertConfig } = useBackendScalping(walletId);

  const data = config.data;

  const [symbols, setSymbols] = useState<string[]>([]);
  const [enabledStrategies, setEnabledStrategies] = useState<ScalpingStrategy[]>(['imbalance']);
  const [directionMode, setDirectionMode] = useState<DirectionMode>('auto');
  const [params, setParams] = useState(buildParams(null));

  useEffect(() => {
    if (!data) return;
    setSymbols(data.symbols as string[] ?? []);
    setEnabledStrategies((data.enabledStrategies ?? ['imbalance']) as ScalpingStrategy[]);
    setDirectionMode((data.directionMode as DirectionMode) ?? 'auto');
    setParams(buildParams(data as unknown as Record<string, unknown>));
  }, [data]);

  const handleParamChange = useCallback((key: string, value: number | boolean | string) => {
    setParams((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleStrategyToggle = useCallback((strategy: ScalpingStrategy, enabled: boolean) => {
    setEnabledStrategies((prev) =>
      enabled ? [...prev, strategy] : prev.filter((s) => s !== strategy),
    );
  }, []);

  const handleSave = () => {
    upsertConfig.mutate({
      walletId,
      symbols,
      enabledStrategies,
      directionMode,
      executionMode: params.executionMode as ScalpingExecutionMode,
      positionSizePercent: params.positionSizePercent,
      maxConcurrentPositions: params.maxConcurrentPositions,
      maxDailyTrades: params.maxDailyTrades,
      maxDailyLossPercent: params.maxDailyLossPercent,
      imbalanceThreshold: params.imbalanceThreshold,
      cvdDivergenceBars: params.cvdDivergenceBars,
      vwapDeviationSigma: params.vwapDeviationSigma,
      absorptionThreshold: params.absorptionThreshold,
      maxSpreadPercent: params.maxSpreadPercent,
      microTrailingTicks: params.microTrailingTicks,
      ticksPerBar: params.ticksPerBar,
      volumePerBar: params.volumePerBar,
      depthLevels: params.depthLevels,
      circuitBreakerEnabled: params.circuitBreakerEnabled,
      circuitBreakerLossPercent: params.circuitBreakerLossPercent,
      circuitBreakerMaxTrades: params.circuitBreakerMaxTrades,
      signalInterval: params.signalInterval as '1m' | '3m' | '5m' | '15m',
    }, { onSuccess: onClose });
  };

  return (
    <FormDialog
      isOpen={isOpen}
      onClose={onClose}
      title={t('scalping.config.title', 'Scalping Configuration')}
      size="lg"
      onSubmit={handleSave}
      submitLabel={t('common.save', 'Save')}
      isLoading={upsertConfig.isPending}
    >
      <VStack gap={6} align="stretch" maxH="70vh" overflowY="auto">
        <SymbolSection symbols={symbols} onSymbolsChange={setSymbols} />

        <DirectionModeSelector value={directionMode} onChange={setDirectionMode} />

        <StrategySection
          enabledStrategies={enabledStrategies}
          imbalanceThreshold={params.imbalanceThreshold}
          cvdDivergenceBars={params.cvdDivergenceBars}
          vwapDeviationSigma={params.vwapDeviationSigma}
          absorptionThreshold={params.absorptionThreshold}
          onStrategyToggle={handleStrategyToggle}
          onParamChange={handleParamChange}
        />

        <ExecutionSection
          executionMode={params.executionMode as ScalpingExecutionMode}
          microTrailingTicks={params.microTrailingTicks}
          maxSpreadPercent={params.maxSpreadPercent}
          signalInterval={params.signalInterval}
          onModeChange={(mode) => handleParamChange('executionMode', mode)}
          onParamChange={handleParamChange}
        />

        <RiskSection
          positionSizePercent={params.positionSizePercent}
          maxConcurrentPositions={params.maxConcurrentPositions}
          maxDailyTrades={params.maxDailyTrades}
          maxDailyLossPercent={params.maxDailyLossPercent}
          circuitBreakerEnabled={params.circuitBreakerEnabled}
          circuitBreakerLossPercent={params.circuitBreakerLossPercent}
          circuitBreakerMaxTrades={params.circuitBreakerMaxTrades}
          onParamChange={handleParamChange}
        />

        <ChartSection
          ticksPerBar={params.ticksPerBar}
          volumePerBar={params.volumePerBar}
          depthLevels={params.depthLevels}
          onParamChange={handleParamChange}
        />

      </VStack>
    </FormDialog>
  );
}
