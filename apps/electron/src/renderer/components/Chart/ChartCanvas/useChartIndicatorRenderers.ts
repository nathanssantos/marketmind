import type { ChartThemeColors } from '@renderer/hooks/useChartColors';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import type { FootprintBar, MarketEvent, VolumeProfile } from '@marketmind/types';
import type { StochasticResult } from '@marketmind/indicators';
import type { UseChartIndicatorsResult } from './useChartIndicators';
import { useStochasticRenderer } from '../useStochasticRenderer';
import { useRSIRenderer } from '../useRSIRenderer';
import { useBollingerBandsRenderer } from '../useBollingerBandsRenderer';
import { useATRRenderer } from '../useATRRenderer';
import { useVWAPRenderer } from '../useVWAPRenderer';
import { useParabolicSARRenderer } from '../useParabolicSARRenderer';
import { useKeltnerRenderer } from '../useKeltnerRenderer';
import { useDonchianRenderer } from '../useDonchianRenderer';
import { useSupertrendRenderer } from '../useSupertrendRenderer';
import { useIchimokuRenderer } from '../useIchimokuRenderer';
import { useOBVRenderer } from '../useOBVRenderer';
import { useCMFRenderer } from '../useCMFRenderer';
import { useStochRSIRenderer } from '../useStochRSIRenderer';
import { useMACDRenderer } from '../useMACDRenderer';
import { useADXRenderer } from '../useADXRenderer';
import { useWilliamsRRenderer } from '../useWilliamsRRenderer';
import { useCCIRenderer } from '../useCCIRenderer';
import { useKlingerRenderer } from '../useKlingerRenderer';
import { useElderRayRenderer } from '../useElderRayRenderer';
import { useAroonRenderer } from '../useAroonRenderer';
import { useVortexRenderer } from '../useVortexRenderer';
import { useMFIRenderer } from '../useMFIRenderer';
import { useROCRenderer } from '../useROCRenderer';
import { useAORenderer } from '../useAORenderer';
import { useTSIRenderer } from '../useTSIRenderer';
import { usePPORenderer } from '../usePPORenderer';
import { useCMORenderer } from '../useCMORenderer';
import { useUltimateOscRenderer } from '../useUltimateOscRenderer';
import { useDEMARenderer } from '../useDEMARenderer';
import { useTEMARenderer } from '../useTEMARenderer';
import { useWMARenderer } from '../useWMARenderer';
import { useHMARenderer } from '../useHMARenderer';
import { usePivotPointsRenderer } from '../usePivotPointsRenderer';
import { useFibonacciRenderer } from '../useFibonacciRenderer';
import { useFVGRenderer } from '../useFVGRenderer';
import { useLiquidityLevelsRenderer } from '../useLiquidityLevelsRenderer';
import { useEventScaleRenderer } from '../useEventScaleRenderer';
import { useCVDRenderer } from '../useCVDRenderer';
import { useImbalanceRenderer } from '../useImbalanceRenderer';
import { useVolumeProfileRenderer } from '../useVolumeProfileRenderer';
import { useFootprintRenderer } from '../useFootprintRenderer';
export interface UseChartIndicatorRenderersProps {
  manager: CanvasManager | null;
  colors: ChartThemeColors;
  indicatorData: UseChartIndicatorsResult;
  stochasticData: StochasticResult | null;
  showEventRow: boolean;
  marketEvents: MarketEvent[];
  cvdValues?: (number | null)[];
  imbalanceValues?: (number | null)[];
  volumeProfile?: VolumeProfile | null;
  footprintBars?: FootprintBar[];
}

export interface UseChartIndicatorRenderersResult {
  renderStochastic: () => void;
  renderRSI: () => void;
  renderBollingerBands: () => void;
  renderATR: () => void;
  renderVWAP: () => void;
  renderParabolicSAR: () => void;
  renderKeltner: () => void;
  renderDonchian: () => void;
  renderSupertrend: () => void;
  renderIchimoku: () => void;
  renderOBV: () => void;
  renderCMF: () => void;
  renderStochRSI: () => void;
  renderMACD: () => void;
  renderADX: () => void;
  renderWilliamsR: () => void;
  renderCCI: () => void;
  renderKlinger: () => void;
  renderElderRay: () => void;
  renderAroon: () => void;
  renderVortex: () => void;
  renderMFI: () => void;
  renderROC: () => void;
  renderAO: () => void;
  renderTSI: () => void;
  renderPPO: () => void;
  renderCMO: () => void;
  renderUltimateOsc: () => void;
  renderDEMA: () => void;
  renderTEMA: () => void;
  renderWMA: () => void;
  renderHMA: () => void;
  renderPivotPoints: () => void;
  renderFibonacci: () => void;
  renderFVG: () => void;
  renderLiquidityLevels: () => void;
  renderEventScale: () => void;
  renderCVD: () => void;
  renderImbalance: () => void;
  renderVolumeProfile: () => void;
  renderFootprint: () => void;
  getEventAtPosition: (x: number, y: number) => MarketEvent | null;
  renderAllOverlayIndicators: () => void;
  renderAllPanelIndicators: () => void;
}

export const useChartIndicatorRenderers = ({
  manager,
  colors,
  indicatorData,
  stochasticData,
  showEventRow,
  marketEvents,
  cvdValues = [],
  imbalanceValues = [],
  volumeProfile = null,
  footprintBars = [],
}: UseChartIndicatorRenderersProps): UseChartIndicatorRenderersResult => {
  const { isIndicatorActive } = indicatorData;

  const { render: renderStochastic } = useStochasticRenderer({
    manager,
    stochasticData,
    colors,
    enabled: isIndicatorActive('stochastic'),
  });

  const { render: renderRSI } = useRSIRenderer({
    manager,
    rsiData: indicatorData.rsiData,
    colors,
    enabled: isIndicatorActive('rsi'),
  });

  const { render: renderBollingerBands } = useBollingerBandsRenderer({
    manager,
    colors,
    enabled: isIndicatorActive('bollingerBands'),
  });

  const { render: renderATR } = useATRRenderer({
    manager,
    colors,
    enabled: isIndicatorActive('atr'),
  });

  const { render: renderVWAP } = useVWAPRenderer({
    manager,
    enabled: isIndicatorActive('vwap'),
  });

  const { render: renderParabolicSAR } = useParabolicSARRenderer({
    manager,
    parabolicSarData: indicatorData.parabolicSarData,
    colors,
    enabled: isIndicatorActive('parabolicSar'),
  });

  const { render: renderKeltner } = useKeltnerRenderer({
    manager,
    keltnerData: indicatorData.keltnerData,
    colors,
    enabled: isIndicatorActive('keltner'),
  });

  const { render: renderDonchian } = useDonchianRenderer({
    manager,
    donchianData: indicatorData.donchianData,
    colors,
    enabled: isIndicatorActive('donchian'),
  });

  const { render: renderSupertrend } = useSupertrendRenderer({
    manager,
    supertrendData: indicatorData.supertrendData,
    colors,
    enabled: isIndicatorActive('supertrend'),
  });

  const { render: renderIchimoku } = useIchimokuRenderer({
    manager,
    ichimokuData: indicatorData.ichimokuData,
    colors,
    enabled: isIndicatorActive('ichimoku'),
  });

  const { render: renderOBV } = useOBVRenderer({
    manager,
    obvData: indicatorData.obvData,
    colors,
    enabled: isIndicatorActive('obv'),
  });

  const { render: renderCMF } = useCMFRenderer({
    manager,
    cmfData: indicatorData.cmfData,
    colors,
    enabled: isIndicatorActive('cmf'),
  });

  const { render: renderStochRSI } = useStochRSIRenderer({
    manager,
    stochRsiData: indicatorData.stochRsiData,
    colors,
    enabled: isIndicatorActive('stochRsi'),
  });

  const { render: renderMACD } = useMACDRenderer({
    manager,
    macdData: indicatorData.macdData,
    colors,
    enabled: isIndicatorActive('macd'),
  });

  const { render: renderADX } = useADXRenderer({
    manager,
    adxData: indicatorData.adxData,
    colors,
    enabled: isIndicatorActive('adx'),
  });

  const { render: renderWilliamsR } = useWilliamsRRenderer({
    manager,
    williamsRData: indicatorData.williamsRData,
    colors,
    enabled: isIndicatorActive('williamsR'),
  });

  const { render: renderCCI } = useCCIRenderer({
    manager,
    cciData: indicatorData.cciData,
    colors,
    enabled: isIndicatorActive('cci'),
  });

  const { render: renderKlinger } = useKlingerRenderer({
    manager,
    klingerData: indicatorData.klingerData,
    colors,
    enabled: isIndicatorActive('klinger'),
  });

  const { render: renderElderRay } = useElderRayRenderer({
    manager,
    elderRayData: indicatorData.elderRayData,
    colors,
    enabled: isIndicatorActive('elderRay'),
  });

  const { render: renderAroon } = useAroonRenderer({
    manager,
    aroonData: indicatorData.aroonData,
    colors,
    enabled: isIndicatorActive('aroon'),
  });

  const { render: renderVortex } = useVortexRenderer({
    manager,
    vortexData: indicatorData.vortexData,
    colors,
    enabled: isIndicatorActive('vortex'),
  });

  const { render: renderMFI } = useMFIRenderer({
    manager,
    mfiData: indicatorData.mfiData,
    colors,
    enabled: isIndicatorActive('mfi'),
  });

  const { render: renderROC } = useROCRenderer({
    manager,
    rocData: indicatorData.rocData,
    colors,
    enabled: isIndicatorActive('roc'),
  });

  const { render: renderAO } = useAORenderer({
    manager,
    aoData: indicatorData.aoData,
    colors,
    enabled: isIndicatorActive('ao'),
  });

  const { render: renderTSI } = useTSIRenderer({
    manager,
    tsiData: indicatorData.tsiData,
    colors,
    enabled: isIndicatorActive('tsi'),
  });

  const { render: renderPPO } = usePPORenderer({
    manager,
    ppoData: indicatorData.ppoData,
    colors,
    enabled: isIndicatorActive('ppo'),
  });

  const { render: renderCMO } = useCMORenderer({
    manager,
    cmoData: indicatorData.cmoData,
    colors,
    enabled: isIndicatorActive('cmo'),
  });

  const { render: renderUltimateOsc } = useUltimateOscRenderer({
    manager,
    ultimateOscData: indicatorData.ultimateOscData,
    colors,
    enabled: isIndicatorActive('ultimateOsc'),
  });

  const { render: renderDEMA } = useDEMARenderer({
    manager,
    demaData: indicatorData.demaData,
    colors,
    enabled: isIndicatorActive('dema'),
  });

  const { render: renderTEMA } = useTEMARenderer({
    manager,
    temaData: indicatorData.temaData,
    colors,
    enabled: isIndicatorActive('tema'),
  });

  const { render: renderWMA } = useWMARenderer({
    manager,
    wmaData: indicatorData.wmaData,
    colors,
    enabled: isIndicatorActive('wma'),
  });

  const { render: renderHMA } = useHMARenderer({
    manager,
    hmaData: indicatorData.hmaData,
    colors,
    enabled: isIndicatorActive('hma'),
  });

  const { render: renderPivotPoints } = usePivotPointsRenderer({
    manager,
    pivotData: indicatorData.pivotPointsData,
    colors,
    enabled: isIndicatorActive('pivotPoints'),
  });

  const { render: renderFibonacci } = useFibonacciRenderer({
    manager,
    fibonacciData: indicatorData.fibonacciData,
    colors,
    enabled: isIndicatorActive('fibonacci'),
  });

  const { render: renderFVG } = useFVGRenderer({
    manager,
    fvgData: indicatorData.fvgData,
    colors,
    enabled: isIndicatorActive('fvg'),
  });

  const { render: renderLiquidityLevels } = useLiquidityLevelsRenderer({
    manager,
    liquidityData: indicatorData.liquidityLevelsData,
    colors,
    enabled: isIndicatorActive('liquidityLevels'),
  });

  const { render: renderEventScale, getEventAtPosition } = useEventScaleRenderer({
    manager,
    events: marketEvents,
    colors,
    enabled: showEventRow,
  });

  const { render: renderCVD } = useCVDRenderer({
    manager,
    cvdValues,
    colors,
    enabled: isIndicatorActive('cvd'),
  });

  const { render: renderImbalance } = useImbalanceRenderer({
    manager,
    imbalanceValues,
    colors,
    enabled: isIndicatorActive('bookImbalance'),
  });

  const { render: renderVolumeProfile } = useVolumeProfileRenderer({
    manager,
    volumeProfile,
    colors,
    enabled: isIndicatorActive('volumeProfile'),
  });

  const { render: renderFootprint } = useFootprintRenderer({
    manager,
    footprintBars,
    colors,
    enabled: isIndicatorActive('footprint'),
  });

  const renderAllOverlayIndicators = (): void => {
    renderBollingerBands();
    renderATR();
    renderVWAP();
    renderParabolicSAR();
    renderKeltner();
    renderDonchian();
    renderSupertrend();
    renderIchimoku();
    renderDEMA();
    renderTEMA();
    renderWMA();
    renderHMA();
    renderPivotPoints();
    renderFibonacci();
    renderFVG();
    renderLiquidityLevels();
    renderEventScale();
    renderVolumeProfile();
    renderFootprint();
  };

  const renderAllPanelIndicators = (): void => {
    renderStochastic();
    renderRSI();
    renderOBV();
    renderCMF();
    renderStochRSI();
    renderMACD();
    renderADX();
    renderWilliamsR();
    renderCCI();
    renderKlinger();
    renderElderRay();
    renderAroon();
    renderVortex();
    renderMFI();
    renderROC();
    renderAO();
    renderTSI();
    renderPPO();
    renderCMO();
    renderUltimateOsc();
    renderCVD();
    renderImbalance();
  };

  return {
    renderStochastic,
    renderRSI,
    renderBollingerBands,
    renderATR,
    renderVWAP,
    renderParabolicSAR,
    renderKeltner,
    renderDonchian,
    renderSupertrend,
    renderIchimoku,
    renderOBV,
    renderCMF,
    renderStochRSI,
    renderMACD,
    renderADX,
    renderWilliamsR,
    renderCCI,
    renderKlinger,
    renderElderRay,
    renderAroon,
    renderVortex,
    renderMFI,
    renderROC,
    renderAO,
    renderTSI,
    renderPPO,
    renderCMO,
    renderUltimateOsc,
    renderDEMA,
    renderTEMA,
    renderWMA,
    renderHMA,
    renderPivotPoints,
    renderFibonacci,
    renderFVG,
    renderLiquidityLevels,
    renderEventScale,
    renderCVD,
    renderImbalance,
    renderVolumeProfile,
    renderFootprint,
    getEventAtPosition,
    renderAllOverlayIndicators,
    renderAllPanelIndicators,
  };
};
