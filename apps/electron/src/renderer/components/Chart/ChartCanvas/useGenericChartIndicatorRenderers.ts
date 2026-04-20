import type { IndicatorDefinition } from '@marketmind/trading-core';
import { INDICATOR_CATALOG } from '@marketmind/trading-core';
import type { ChartThemeColors } from '@renderer/hooks/useChartColors';
import type { IndicatorInstance } from '@renderer/store/indicatorStore';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import type { MutableRefObject } from 'react';
import { useCallback, useMemo, useRef } from 'react';
import type { IndicatorOutputs } from './useGenericChartIndicators';
import type { GenericRenderer as GenericRendererFn, GenericRendererExternal } from './renderers';
import { getCustomRenderer, getRenderer } from './renderers';

export interface UseGenericChartIndicatorRenderersProps {
  manager: CanvasManager | null;
  colors: ChartThemeColors;
  instances: IndicatorInstance[];
  outputsRef: MutableRefObject<Map<string, IndicatorOutputs>>;
  external?: GenericRendererExternal;
}

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

const resolveRenderer = (definition: IndicatorDefinition): GenericRendererFn | undefined => {
  if (isCustomKind(definition.render.kind)) {
    const id = definition.render.rendererId;
    return id ? getCustomRenderer(id) : undefined;
  }
  return getRenderer(definition.render.kind);
};

export const useGenericChartIndicatorRenderers = ({
  manager,
  colors,
  instances,
  outputsRef,
  external,
}: UseGenericChartIndicatorRenderersProps): UseGenericChartIndicatorRenderersResult => {
  const externalRef = useRef<GenericRendererExternal | undefined>(external);
  externalRef.current = external;
  const colorsRef = useRef(colors);
  colorsRef.current = colors;

  const resolved = useMemo<ResolvedInstance[]>(() => {
    const list: ResolvedInstance[] = [];
    for (const instance of instances) {
      if (!instance.visible) continue;
      const definition = INDICATOR_CATALOG[instance.catalogType];
      if (!definition) continue;
      list.push({ instance, definition });
    }
    return list.sort((a, b) => (a.instance.zIndex ?? 0) - (b.instance.zIndex ?? 0));
  }, [instances]);

  const resolvedRef = useRef(resolved);
  resolvedRef.current = resolved;

  const renderInstance = useCallback(
    (instanceId: string) => {
      if (!manager) return;
      const entry = resolvedRef.current.find((r) => r.instance.id === instanceId);
      if (!entry) return;
      const renderer = resolveRenderer(entry.definition);
      if (!renderer) return;
      const values = outputsRef.current.get(instanceId);
      if (!values) return;
      renderer(
        { manager, colors: colorsRef.current, external: externalRef.current },
        { instance: entry.instance, definition: entry.definition, values },
      );
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

    canvasCtx.save();
    canvasCtx.beginPath();
    canvasCtx.rect(0, 0, dimensions.chartWidth, dimensions.chartHeight);
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
    for (const { instance, definition } of resolvedRef.current) {
      if (!isPaneKind(definition.render.kind)) continue;
      const renderer = getRenderer(definition.render.kind);
      if (!renderer) continue;
      const values = outputs.get(instance.id);
      if (!values) continue;
      renderer({ manager, colors: colorsRef.current, external: externalRef.current }, { instance, definition, values });
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
