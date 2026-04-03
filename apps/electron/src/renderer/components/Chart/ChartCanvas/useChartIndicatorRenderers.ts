import type { IndicatorId } from '@renderer/store/indicatorStore';
import { getMAParams, DEFAULT_INDICATOR_PARAMS } from '@renderer/store/indicatorStore';
import { drawPriceTag } from '@renderer/utils/canvas/priceTagUtils';
import { formatChartPrice } from '@renderer/utils/formatters';
import { CHART_CONFIG, LINE_WIDTHS } from '@shared/constants/chartConfig';
import { useCallback } from 'react';
import {
  useStochasticRenderer,
  useRSIRenderer,
  useBollingerBandsRenderer,
  useATRRenderer,
  useVWAPRenderer,
  useParabolicSARRenderer,
  useKeltnerRenderer,
  useDonchianRenderer,
  useSupertrendRenderer,
  useIchimokuRenderer,
  useOBVRenderer,
  useCMFRenderer,
  useStochRSIRenderer,
  useMACDRenderer,
  useADXRenderer,
  useWilliamsRRenderer,
  useCCIRenderer,
  useKlingerRenderer,
  useElderRayRenderer,
  useAroonRenderer,
  useVortexRenderer,
  useMFIRenderer,
  useROCRenderer,
  useAORenderer,
  useTSIRenderer,
  usePPORenderer,
  useCMORenderer,
  useUltimateOscRenderer,
  useDEMARenderer,
  useTEMARenderer,
  useWMARenderer,
  useHMARenderer,
  usePivotPointsRenderer,
  useFibonacciRenderer,
  useFVGRenderer,
  useLiquidityLevelsRenderer,
  useEventScaleRenderer,
  useCVDRenderer,
  useImbalanceRenderer,
  useVolumeProfileRenderer,
  useFootprintRenderer,
  useSessionBoundariesRenderer,
  useORBRenderer,
  useLiquidityHeatmapRenderer,
} from './indicatorRendererImports';
import type { UseChartIndicatorRenderersProps, UseChartIndicatorRenderersResult } from './indicatorRendererTypes';

export type { UseChartIndicatorRenderersProps, UseChartIndicatorRenderersResult };

export const useChartIndicatorRenderers = ({
  manager,
  colors,
  chartType,
  indicatorData,
  indicatorParams,
  stochasticData,
  showEventRow,
  marketEvents,
  cvdValuesRef,
  imbalanceValuesRef,
  volumeProfile = null,
  footprintBars = [],
  heatmapDataRef,
}: UseChartIndicatorRenderersProps): UseChartIndicatorRenderersResult => {
  const { isIndicatorActive, maData } = indicatorData;

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

  const { render: renderRSI14 } = useRSIRenderer({
    manager,
    rsiData: indicatorData.rsi14Data,
    colors,
    enabled: isIndicatorActive('rsi14'),
    overboughtLevel: 70,
    oversoldLevel: 30,
    panelId: 'rsi14',
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

  const { render: renderDailyVWAP } = useVWAPRenderer({
    manager,
    colors,
    enabled: isIndicatorActive('dailyVwap'),
    period: 'daily',
  });

  const { render: renderWeeklyVWAP } = useVWAPRenderer({
    manager,
    colors,
    enabled: isIndicatorActive('weeklyVwap'),
    period: 'weekly',
  });

  const { render: renderVWAP } = useVWAPRenderer({
    manager,
    colors,
    enabled: isIndicatorActive('vwap'),
    period: 'monthly',
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
    cvdValuesRef,
    colors,
    enabled: isIndicatorActive('cvd'),
  });

  const { render: renderImbalance } = useImbalanceRenderer({
    manager,
    imbalanceValuesRef,
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
    enabled: isIndicatorActive('footprint') || chartType === 'footprint',
  });

  const { render: renderSessionBoundaries } = useSessionBoundariesRenderer({
    manager,
    colors,
    enabled: showEventRow,
    marketEvents,
  });

  const { render: renderORB } = useORBRenderer({
    manager,
    colors,
    enabled: isIndicatorActive('orb'),
    marketEvents,
  });

  const { render: renderLiquidityHeatmap } = useLiquidityHeatmapRenderer({
    manager,
    heatmapDataRef,
    enabled: isIndicatorActive('liquidityHeatmap'),
    liquidationMarkersEnabled: isIndicatorActive('liquidationMarkers'),
  });

  const renderMAIndicators = useCallback((): void => {
    if (!manager || maData.size === 0) return;

    const ctx = manager.getContext();
    const dimensions = manager.getDimensions();
    const viewport = manager.getViewport();
    const bounds = manager.getBounds();
    const klines = manager.getKlines();

    if (!ctx || !dimensions || !bounds || !klines) return;

    const { chartWidth, chartHeight } = dimensions;
    const startIndex = Math.max(0, Math.floor(viewport.start));
    const endIndex = Math.min(klines.length, Math.ceil(viewport.end));
    const effectiveWidth = chartWidth - CHART_CONFIG.CHART_RIGHT_MARGIN;
    const visibleRange = viewport.end - viewport.start;
    const widthPerKline = effectiveWidth / visibleRange;
    const { klineWidth } = viewport;
    const klineCenterOffset = (widthPerKline - klineWidth) / 2 + klineWidth / 2;
    const resolvedParams = indicatorParams ?? DEFAULT_INDICATOR_PARAMS;

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, chartWidth, chartHeight);
    ctx.clip();

    for (const [id, values] of maData) {
      const params = getMAParams(id as IndicatorId, resolvedParams);
      if (!params) continue;

      ctx.strokeStyle = params.color;
      ctx.lineWidth = params.lineWidth || LINE_WIDTHS.NORMAL;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();

      let hasMovedTo = false;
      for (let i = startIndex; i < endIndex; i++) {
        const value = values[i];
        if (value === null || value === undefined) continue;

        const x = manager.indexToX(i);
        const centerX = x + klineCenterOffset;
        const y = manager.priceToY(value);

        if (!hasMovedTo) {
          ctx.moveTo(centerX, y);
          hasMovedTo = true;
        } else {
          ctx.lineTo(centerX, y);
        }
      }
      ctx.stroke();
    }

    ctx.restore();

    ctx.save();
    ctx.font = '11px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    for (const [id, values] of maData) {
      const params = getMAParams(id as IndicatorId, resolvedParams);
      if (!params) continue;

      const lastValue = values[endIndex - 1];
      if (lastValue === null || lastValue === undefined) continue;

      const y = manager.priceToY(lastValue);
      if (y < 0 || y > chartHeight) continue;

      drawPriceTag(ctx, formatChartPrice(lastValue), y, chartWidth, params.color, CHART_CONFIG.CANVAS_PADDING_RIGHT);
    }

    ctx.restore();
  }, [manager, maData, indicatorParams]);

  const renderAllOverlayIndicators = (): void => {
    renderLiquidityHeatmap();
    renderMAIndicators();
    renderBollingerBands();
    renderATR();
    renderDailyVWAP();
    renderWeeklyVWAP();
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
    renderORB();
    renderEventScale();
    renderVolumeProfile();
    renderFootprint();
  };

  const renderAllPanelIndicators = (): void => {
    renderStochastic();
    renderRSI();
    renderRSI14();
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
    renderRSI14,
    renderBollingerBands,
    renderATR,
    renderDailyVWAP,
    renderWeeklyVWAP,
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
    renderSessionBoundaries,
    renderORB,
    renderLiquidityHeatmap,
    renderMAIndicators,
    getEventAtPosition,
    renderAllOverlayIndicators,
    renderAllPanelIndicators,
  };
};
