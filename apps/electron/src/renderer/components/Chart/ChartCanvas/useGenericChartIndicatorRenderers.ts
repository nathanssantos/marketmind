import type { IndicatorDefinition } from '@marketmind/trading-core';
import { INDICATOR_CATALOG } from '@marketmind/trading-core';
import type { ChartThemeColors } from '@renderer/hooks/useChartColors';
import type { IndicatorInstance } from '@renderer/store/indicatorStore';
import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import { useCallback, useMemo } from 'react';
import type { IndicatorOutputs } from './useGenericChartIndicators';
import type { GenericRenderer as GenericRendererFn } from './renderers';
import { getCustomRenderer, getRenderer } from './renderers';

export interface UseGenericChartIndicatorRenderersProps {
  manager: CanvasManager | null;
  colors: ChartThemeColors;
  instances: IndicatorInstance[];
  outputs: Map<string, IndicatorOutputs>;
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
  outputs,
}: UseGenericChartIndicatorRenderersProps): UseGenericChartIndicatorRenderersResult => {
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

  const renderInstance = useCallback(
    (instanceId: string) => {
      if (!manager) return;
      const entry = resolved.find((r) => r.instance.id === instanceId);
      if (!entry) return;
      const renderer = resolveRenderer(entry.definition);
      if (!renderer) return;
      const values = outputs.get(instanceId);
      if (!values) return;
      renderer({ manager, colors }, { instance: entry.instance, definition: entry.definition, values });
    },
    [manager, resolved, outputs, colors],
  );

  const renderAllOverlayIndicators = useCallback(() => {
    if (!manager) return;
    for (const { instance, definition } of resolved) {
      if (!isOverlayKind(definition.render.kind)) continue;
      const renderer = getRenderer(definition.render.kind);
      if (!renderer) continue;
      const values = outputs.get(instance.id);
      if (!values) continue;
      renderer({ manager, colors }, { instance, definition, values });
    }
  }, [manager, resolved, outputs, colors]);

  const renderAllPanelIndicators = useCallback(() => {
    if (!manager) return;
    for (const { instance, definition } of resolved) {
      if (!isPaneKind(definition.render.kind)) continue;
      const renderer = getRenderer(definition.render.kind);
      if (!renderer) continue;
      const values = outputs.get(instance.id);
      if (!values) continue;
      renderer({ manager, colors }, { instance, definition, values });
    }
  }, [manager, resolved, outputs, colors]);

  const renderAllCustomIndicators = useCallback(() => {
    if (!manager) return;
    for (const { instance, definition } of resolved) {
      if (!isCustomKind(definition.render.kind)) continue;
      const id = definition.render.rendererId;
      if (!id) continue;
      const renderer = getCustomRenderer(id);
      if (!renderer) continue;
      const values = outputs.get(instance.id);
      if (!values) continue;
      renderer({ manager, colors }, { instance, definition, values });
    }
  }, [manager, resolved, outputs, colors]);

  return useMemo(
    () => ({ renderAllOverlayIndicators, renderAllPanelIndicators, renderAllCustomIndicators, renderInstance }),
    [renderAllOverlayIndicators, renderAllPanelIndicators, renderAllCustomIndicators, renderInstance],
  );
};
