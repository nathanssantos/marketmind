import { renderIchimoku } from './renderIchimoku';
import { renderOverlayBands } from './renderOverlayBands';
import { renderOverlayLine } from './renderOverlayLine';
import { renderOverlayPoints } from './renderOverlayPoints';
import { renderPaneHistogram } from './renderPaneHistogram';
import { renderPaneLine } from './renderPaneLine';
import { renderPaneMulti } from './renderPaneMulti';
import { renderPivotPoints } from './renderPivotPoints';
import type { GenericRenderer, RendererRegistry } from './types';

export type { GenericRenderer, GenericRendererCtx, GenericRendererInput, IndicatorValueSeries, RendererRegistry } from './types';
export { getInstanceParam } from './types';

export const RENDERER_REGISTRY: RendererRegistry = {
  'overlay-line': renderOverlayLine,
  'overlay-bands': renderOverlayBands,
  'overlay-points': renderOverlayPoints,
  'pane-line': renderPaneLine,
  'pane-multi': renderPaneMulti,
  'pane-histogram': renderPaneHistogram,
};

export const CUSTOM_RENDERER_REGISTRY: Record<string, GenericRenderer> = {
  ichimoku: renderIchimoku,
  pivotPoints: renderPivotPoints,
};

export {
  renderIchimoku,
  renderOverlayBands,
  renderOverlayLine,
  renderOverlayPoints,
  renderPaneHistogram,
  renderPaneLine,
  renderPaneMulti,
  renderPivotPoints,
};

export const isGenericRenderKind = (kind: string): kind is keyof typeof RENDERER_REGISTRY =>
  Boolean(RENDERER_REGISTRY[kind as keyof typeof RENDERER_REGISTRY]);

export const getRenderer = (kind: string): GenericRenderer | undefined =>
  RENDERER_REGISTRY[kind as keyof typeof RENDERER_REGISTRY];

export const getCustomRenderer = (rendererId: string): GenericRenderer | undefined =>
  CUSTOM_RENDERER_REGISTRY[rendererId];

export const registerCustomRenderer = (rendererId: string, renderer: GenericRenderer): void => {
  CUSTOM_RENDERER_REGISTRY[rendererId] = renderer;
};
