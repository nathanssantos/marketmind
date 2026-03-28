import type { Kline } from '@marketmind/types';
import { calculateMovingAverage } from '@marketmind/indicators';
import { useADXWorker } from '@renderer/hooks/useADXWorker';
import { useAOWorker } from '@renderer/hooks/useAOWorker';
import { useAroonWorker } from '@renderer/hooks/useAroonWorker';
import { useCCIWorker } from '@renderer/hooks/useCCIWorker';
import { useCMFWorker } from '@renderer/hooks/useCMFWorker';
import { useCMOWorker } from '@renderer/hooks/useCMOWorker';
import { useDEMAWorker } from '@renderer/hooks/useDEMAWorker';
import { useDonchianWorker } from '@renderer/hooks/useDonchianWorker';
import { useElderRayWorker } from '@renderer/hooks/useElderRayWorker';
import { useFibonacciWorker } from '@renderer/hooks/useFibonacciWorker';
import { useFVGWorker } from '@renderer/hooks/useFVGWorker';
import { useHMAWorker } from '@renderer/hooks/useHMAWorker';
import { useIchimokuWorker } from '@renderer/hooks/useIchimokuWorker';
import { useKeltnerWorker } from '@renderer/hooks/useKeltnerWorker';
import { useKlingerWorker } from '@renderer/hooks/useKlingerWorker';
import { useLiquidityLevelsWorker } from '@renderer/hooks/useLiquidityLevelsWorker';
import { useMACDWorker } from '@renderer/hooks/useMACDWorker';
import { useMFIWorker } from '@renderer/hooks/useMFIWorker';
import { useOBVWorker } from '@renderer/hooks/useOBVWorker';
import { useParabolicSARWorker } from '@renderer/hooks/useParabolicSARWorker';
import { usePivotPointsWorker } from '@renderer/hooks/usePivotPointsWorker';
import { usePPOWorker } from '@renderer/hooks/usePPOWorker';
import { useROCWorker } from '@renderer/hooks/useROCWorker';
import { useRSIWorker } from '@renderer/hooks/useRSIWorker';
import { useStochRSIWorker } from '@renderer/hooks/useStochRSIWorker';
import { useSupertrendWorker } from '@renderer/hooks/useSupertrendWorker';
import { useTEMAWorker } from '@renderer/hooks/useTEMAWorker';
import { useTSIWorker } from '@renderer/hooks/useTSIWorker';
import { useUltimateOscWorker } from '@renderer/hooks/useUltimateOscWorker';
import { useVortexWorker } from '@renderer/hooks/useVortexWorker';
import { useWilliamsRWorker } from '@renderer/hooks/useWilliamsRWorker';
import { useWMAWorker } from '@renderer/hooks/useWMAWorker';
import type { IndicatorId, IndicatorParams } from '@renderer/store/indicatorStore';
import { isMAIndicator, getMAParams, DEFAULT_INDICATOR_PARAMS } from '@renderer/store/indicatorStore';
import { useCallback, useMemo } from 'react';

export type { IndicatorId };

export interface UseChartIndicatorsProps {
  klines: Kline[];
  activeIndicators: IndicatorId[];
  indicatorParams?: IndicatorParams;
}

export interface UseChartIndicatorsResult {
  parabolicSarData: ReturnType<typeof useParabolicSARWorker>;
  keltnerData: ReturnType<typeof useKeltnerWorker>;
  donchianData: ReturnType<typeof useDonchianWorker>;
  obvData: ReturnType<typeof useOBVWorker>;
  cmfData: ReturnType<typeof useCMFWorker>;
  stochRsiData: ReturnType<typeof useStochRSIWorker>;
  macdData: ReturnType<typeof useMACDWorker>;
  adxData: ReturnType<typeof useADXWorker>;
  williamsRData: ReturnType<typeof useWilliamsRWorker>;
  cciData: ReturnType<typeof useCCIWorker>;
  supertrendData: ReturnType<typeof useSupertrendWorker>;
  ichimokuData: ReturnType<typeof useIchimokuWorker>;
  klingerData: ReturnType<typeof useKlingerWorker>;
  elderRayData: ReturnType<typeof useElderRayWorker>;
  aroonData: ReturnType<typeof useAroonWorker>;
  vortexData: ReturnType<typeof useVortexWorker>;
  mfiData: ReturnType<typeof useMFIWorker>;
  rocData: ReturnType<typeof useROCWorker>;
  aoData: ReturnType<typeof useAOWorker>;
  tsiData: ReturnType<typeof useTSIWorker>;
  ppoData: ReturnType<typeof usePPOWorker>;
  cmoData: ReturnType<typeof useCMOWorker>;
  ultimateOscData: ReturnType<typeof useUltimateOscWorker>;
  demaData: ReturnType<typeof useDEMAWorker>;
  temaData: ReturnType<typeof useTEMAWorker>;
  wmaData: ReturnType<typeof useWMAWorker>;
  hmaData: ReturnType<typeof useHMAWorker>;
  pivotPointsData: ReturnType<typeof usePivotPointsWorker>;
  fibonacciData: ReturnType<typeof useFibonacciWorker>;
  fvgData: ReturnType<typeof useFVGWorker>;
  liquidityLevelsData: ReturnType<typeof useLiquidityLevelsWorker>;
  rsiData: ReturnType<typeof useRSIWorker>;
  rsi14Data: ReturnType<typeof useRSIWorker>;
  maData: Map<string, (number | null)[]>;
  isIndicatorActive: (id: IndicatorId) => boolean;
}

export const useChartIndicators = ({
  klines,
  activeIndicators,
  indicatorParams,
}: UseChartIndicatorsProps): UseChartIndicatorsResult => {
  const isIndicatorActive = useCallback(
    (id: IndicatorId): boolean => activeIndicators.includes(id),
    [activeIndicators]
  );

  const maData = useMemo(() => {
    const map = new Map<string, (number | null)[]>();
    for (const id of activeIndicators) {
      if (!isMAIndicator(id)) continue;
      const params = getMAParams(id as IndicatorId, indicatorParams ?? DEFAULT_INDICATOR_PARAMS);
      if (!params) continue;
      map.set(id, calculateMovingAverage(klines, params.period, params.type));
    }
    return map;
  }, [klines, activeIndicators, indicatorParams]);

  const parabolicSarData = useParabolicSARWorker(klines, isIndicatorActive('parabolicSar'));
  const keltnerData = useKeltnerWorker(klines, isIndicatorActive('keltner'));
  const donchianData = useDonchianWorker(klines, isIndicatorActive('donchian'));
  const obvData = useOBVWorker(klines, isIndicatorActive('obv'));
  const cmfData = useCMFWorker(klines, isIndicatorActive('cmf'));
  const stochRsiData = useStochRSIWorker(klines, isIndicatorActive('stochRsi'));
  const macdData = useMACDWorker(klines, isIndicatorActive('macd'));
  const adxData = useADXWorker(klines, isIndicatorActive('adx'));
  const williamsRData = useWilliamsRWorker(klines, isIndicatorActive('williamsR'));
  const cciData = useCCIWorker(klines, isIndicatorActive('cci'));
  const supertrendData = useSupertrendWorker(klines, isIndicatorActive('supertrend'));
  const ichimokuData = useIchimokuWorker(klines, isIndicatorActive('ichimoku'));
  const klingerData = useKlingerWorker(klines, isIndicatorActive('klinger'));
  const elderRayData = useElderRayWorker(klines, isIndicatorActive('elderRay'));
  const aroonData = useAroonWorker(klines, isIndicatorActive('aroon'));
  const vortexData = useVortexWorker(klines, isIndicatorActive('vortex'));
  const mfiData = useMFIWorker(klines, isIndicatorActive('mfi'));
  const rocData = useROCWorker(klines, isIndicatorActive('roc'));
  const aoData = useAOWorker(klines, isIndicatorActive('ao'));
  const tsiData = useTSIWorker(klines, isIndicatorActive('tsi'));
  const ppoData = usePPOWorker(klines, isIndicatorActive('ppo'));
  const cmoData = useCMOWorker(klines, isIndicatorActive('cmo'));
  const ultimateOscData = useUltimateOscWorker(klines, isIndicatorActive('ultimateOsc'));
  const demaData = useDEMAWorker(klines, isIndicatorActive('dema'));
  const temaData = useTEMAWorker(klines, isIndicatorActive('tema'));
  const wmaData = useWMAWorker(klines, isIndicatorActive('wma'));
  const hmaData = useHMAWorker(klines, isIndicatorActive('hma'));
  const pivotPointsData = usePivotPointsWorker(klines, isIndicatorActive('pivotPoints'));
  const fibonacciData = useFibonacciWorker(klines, isIndicatorActive('fibonacci'));
  const fvgData = useFVGWorker(klines, isIndicatorActive('fvg'));
  const liquidityLevelsData = useLiquidityLevelsWorker(klines, isIndicatorActive('liquidityLevels'));
  const rsiData = useRSIWorker(klines, 2, isIndicatorActive('rsi'));
  const rsi14Data = useRSIWorker(klines, 14, isIndicatorActive('rsi14'));

  return useMemo(
    () => ({
      parabolicSarData,
      keltnerData,
      donchianData,
      obvData,
      cmfData,
      stochRsiData,
      macdData,
      adxData,
      williamsRData,
      cciData,
      supertrendData,
      ichimokuData,
      klingerData,
      elderRayData,
      aroonData,
      vortexData,
      mfiData,
      rocData,
      aoData,
      tsiData,
      ppoData,
      cmoData,
      ultimateOscData,
      demaData,
      temaData,
      wmaData,
      hmaData,
      pivotPointsData,
      fibonacciData,
      fvgData,
      liquidityLevelsData,
      rsiData,
      rsi14Data,
      maData,
      isIndicatorActive,
    }),
    [
      parabolicSarData,
      keltnerData,
      donchianData,
      obvData,
      cmfData,
      stochRsiData,
      macdData,
      adxData,
      williamsRData,
      cciData,
      supertrendData,
      ichimokuData,
      klingerData,
      elderRayData,
      aroonData,
      vortexData,
      mfiData,
      rocData,
      aoData,
      tsiData,
      ppoData,
      cmoData,
      ultimateOscData,
      demaData,
      temaData,
      wmaData,
      hmaData,
      pivotPointsData,
      fibonacciData,
      fvgData,
      liquidityLevelsData,
      rsiData,
      rsi14Data,
      maData,
      isIndicatorActive,
    ]
  );
};
