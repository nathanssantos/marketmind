import { useSyncExternalStore } from 'react';
import type { TooltipData } from './useChartState';

const INITIAL_TOOLTIP: TooltipData = { kline: null, x: 0, y: 0, visible: false };

let snapshot: TooltipData = INITIAL_TOOLTIP;
const listeners = new Set<() => void>();
const hoveredKlineIndexListeners = new Set<(index: number | undefined) => void>();

const getSnapshot = (): TooltipData => snapshot;

const subscribe = (fn: () => void): (() => void) => {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
};

const emit = (): void => {
  for (const fn of listeners) fn();
};

const setTooltip = (next: TooltipData): void => {
  const prevIndex = snapshot.klineIndex;
  snapshot = next;
  if (next.klineIndex !== prevIndex) {
    for (const fn of hoveredKlineIndexListeners) fn(next.klineIndex);
  }
  emit();
};

const hideTooltip = (): void => {
  if (snapshot === INITIAL_TOOLTIP) return;
  const prevIndex = snapshot.klineIndex;
  snapshot = INITIAL_TOOLTIP;
  if (prevIndex !== undefined) {
    for (const fn of hoveredKlineIndexListeners) fn(undefined);
  }
  emit();
};

const subscribeHoveredKlineIndex = (fn: (index: number | undefined) => void): (() => void) => {
  hoveredKlineIndexListeners.add(fn);
  return () => { hoveredKlineIndexListeners.delete(fn); };
};

export const tooltipStore = {
  getSnapshot,
  subscribe,
  setTooltip,
  hideTooltip,
  subscribeHoveredKlineIndex,
};

export const useTooltipData = (): TooltipData =>
  useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
