import type { IndicatorDefinition } from '@marketmind/trading-core';
import { INDICATOR_CATALOG } from '@marketmind/trading-core';
import type { ChartThemeColors } from '@renderer/hooks/useChartColors';
import { useIndicatorStore, type IndicatorInstance } from '@renderer/store/indicatorStore';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import type { MutableRefObject } from 'react';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { IndicatorOutputs } from './useGenericChartIndicators';
import type { GenericRenderer as GenericRendererFn, GenericRendererExternal } from './renderers';
import { getCustomRenderer, getRenderer } from './renderers';
import { drawPanelBackground } from '../utils/oscillatorRendering';

export interface UseGenericChartIndicatorRenderersProps {
  manager: CanvasManager | null;
  colors: ChartThemeColors;
  outputsRef: MutableRefObject<Map<string, IndicatorOutputs>>;
  external?: GenericRendererExternal;
  /**
   * Grid-panel ID this chart is rendering into. When set, only
   * indicator instances bound to this panel are rendered. When
   * undefined (detached window etc.), all instances are rendered
   * — legacy behavior.
   */
  panelId?: string;
}

const filterByPanelId = (
  instances: IndicatorInstance[],
  panelId: string | undefined,
): IndicatorInstance[] => {
  if (panelId === undefined) return instances;
  return instances.filter((inst) => inst.panelId === panelId);
};

export interface UseGenericChartIndicatorRenderersResult {
  renderAllOverlayIndicators: () => void;
  renderAllPanelIndicators: () => void;
  renderAllCustomIndicators: () => void;
  renderInstance: (instanceId: string) => void;
}

interface ResolvedInstance {
  instance: IndicatorInstance;
  definition: IndicatorDefinition;
}

const isOverlayKind = (kind: string): boolean => kind.startsWith('overlay-');
const isPaneKind = (kind: string): boolean => kind.startsWith('pane-');
const isCustomKind = (kind: string): boolean => kind === 'custom';

const getPanelId = (definition: IndicatorDefinition): string =>
  definition.render.paneId ?? definition.type;

const resolveRenderer = (definition: IndicatorDefinition): GenericRendererFn | undefined => {
  if (isCustomKind(definition.render.kind)) {
    const id = definition.render.rendererId;
    return id ? getCustomRenderer(id) : undefined;
  }
  return getRenderer(definition.render.kind);
};

const buildResolved = (instances: IndicatorInstance[]): ResolvedInstance[] => {
  const list: ResolvedInstance[] = [];
  for (const instance of instances) {
    if (!instance.visible) continue;
    const definition = INDICATOR_CATALOG[instance.catalogType];
    if (!definition) continue;
    list.push({ instance, definition });
  }
  return list.sort((a, b) => (a.instance.zIndex ?? 0) - (b.instance.zIndex ?? 0));
};

export const useGenericChartIndicatorRenderers = ({
  manager,
  colors,
  outputsRef,
  external,
  panelId,
}: UseGenericChartIndicatorRenderersProps): UseGenericChartIndicatorRenderersResult => {
  const externalRef = useRef<GenericRendererExternal | undefined>(external);
  externalRef.current = external;
  const colorsRef = useRef(colors);
  colorsRef.current = colors;
  const panelIdRef = useRef(panelId);
  panelIdRef.current = panelId;

  const resolvedRef = useRef<ResolvedInstance[]>(
    buildResolved(filterByPanelId(useIndicatorStore.getState().instances, panelId)),
  );
  const instancesRef = useRef<IndicatorInstance[]>(
    filterByPanelId(useIndicatorStore.getState().instances, panelId),
  );

  useEffect(() => {
    const filtered = filterByPanelId(useIndicatorStore.getState().instances, panelIdRef.current);
    instancesRef.current = filtered;
    resolvedRef.current = buildResolved(filtered);
    manager?.markDirty('all');
    const unsubscribe = useIndicatorStore.subscribe((state) => {
      const filteredNext = filterByPanelId(state.instances, panelIdRef.current);
      instancesRef.current = filteredNext;
      resolvedRef.current = buildResolved(filteredNext);
      manager?.markDirty('all');
    });
    return unsubscribe;
  }, [manager, panelId]);

  const renderInstance = useCallback(
    (instanceId: string) => {
      if (!manager) return;
      const entry = resolvedRef.current.find((r) => r.instance.id === instanceId);
      if (!entry) return;
      const renderer = resolveRenderer(entry.definition);
      if (!renderer) return;
      const values = outputsRef.current.get(instanceId);
      if (!values) return;

      const panelSetup = isPaneKind(entry.definition.render.kind)
        ? (() => {
            const cctx = manager.getContext();
            const dims = manager.getDimensions();
            const info = manager.getPanelInfo(getPanelId(entry.definition));
            if (!cctx || !dims || !info) return null;
            return { ctx: cctx, dimensions: dims, panelInfo: info };
          })()
        : null;

      if (panelSetup) {
        const { ctx: cctx, dimensions: dims, panelInfo: info } = panelSetup;
        cctx.save();
        drawPanelBackground({ ctx: cctx, panelY: info.y, panelHeight: info.height, chartWidth: dims.chartWidth });
      }

      renderer(
        { manager, colors: colorsRef.current, external: externalRef.current },
        { instance: entry.instance, definition: entry.definition, values },
      );

      if (panelSetup) panelSetup.ctx.restore();
    },
    [manager, outputsRef],
  );

  const renderAllOverlayIndicators = useCallback(() => {
    if (!manager) return;
    const outputs = outputsRef.current;
    const resolvedList = resolvedRef.current;
    const canvasCtx = manager.getContext();
    const dimensions = manager.getDimensions();
    if (!canvasCtx || !dimensions) return;

    let overlayCount = 0;
    for (const { definition } of resolvedList) {
      if (isOverlayKind(definition.render.kind)) overlayCount++;
    }
    if (overlayCount === 0) return;

    // Clip extends to the full canvas width (not just chartWidth) so that
    // overlay renderers can draw their price-axis tag in the right-side
    // price scale area. Lines themselves are kline-index-bounded and stay
    // within the chart area regardless.
    canvasCtx.save();
    canvasCtx.beginPath();
    canvasCtx.rect(0, 0, dimensions.width, dimensions.chartHeight);
    canvasCtx.clip();
    for (const { instance, definition } of resolvedList) {
      if (!isOverlayKind(definition.render.kind)) continue;
      const renderer = getRenderer(definition.render.kind);
      if (!renderer) continue;
      const values = outputs.get(instance.id);
      if (!values) continue;
      renderer({ manager, colors: colorsRef.current, external: externalRef.current }, { instance, definition, values });
    }
    canvasCtx.restore();
  }, [manager, outputsRef]);

  const renderAllPanelIndicators = useCallback(() => {
    if (!manager) return;
    const outputs = outputsRef.current;
    const canvasCtx = manager.getContext();
    const dimensions = manager.getDimensions();
    if (!canvasCtx || !dimensions) return;

    interface PanelEntry {
      instance: IndicatorInstance;
      definition: IndicatorDefinition;
      renderer: GenericRendererFn;
      values: IndicatorOutputs;
    }
    const groups = new Map<string, PanelEntry[]>();
    const panelOrder: string[] = [];

    for (const { instance, definition } of resolvedRef.current) {
      if (!isPaneKind(definition.render.kind)) continue;
      const renderer = getRenderer(definition.render.kind);
      if (!renderer) continue;
      const values = outputs.get(instance.id);
      if (!values) continue;
      const panelId = getPanelId(definition);
      let bucket = groups.get(panelId);
      if (!bucket) {
        bucket = [];
        groups.set(panelId, bucket);
        panelOrder.push(panelId);
      }
      bucket.push({ instance, definition, renderer, values });
    }

    for (const panelId of panelOrder) {
      const entries = groups.get(panelId)!;
      const panelInfo = manager.getPanelInfo(panelId);
      if (panelInfo) {
        canvasCtx.save();
        drawPanelBackground({ ctx: canvasCtx, panelY: panelInfo.y, panelHeight: panelInfo.height, chartWidth: dimensions.chartWidth });
      }
      for (const { instance, definition, renderer, values } of entries) {
        renderer({ manager, colors: colorsRef.current, external: externalRef.current }, { instance, definition, values });
      }
      if (panelInfo) canvasCtx.restore();
    }
  }, [manager, outputsRef]);

  const renderAllCustomIndicators = useCallback(() => {
    if (!manager) return;
    const outputs = outputsRef.current;
    for (const { instance, definition } of resolvedRef.current) {
      if (!isCustomKind(definition.render.kind)) continue;
      const id = definition.render.rendererId;
      if (!id) continue;
      const renderer = getCustomRenderer(id);
      if (!renderer) continue;
      const values = outputs.get(instance.id);
      if (!values) continue;
      renderer({ manager, colors: colorsRef.current, external: externalRef.current }, { instance, definition, values });
    }
  }, [manager, outputsRef]);

  return useMemo(
    () => ({ renderAllOverlayIndicators, renderAllPanelIndicators, renderAllCustomIndicators, renderInstance }),
    [renderAllOverlayIndicators, renderAllPanelIndicators, renderAllCustomIndicators, renderInstance],
  );
};
