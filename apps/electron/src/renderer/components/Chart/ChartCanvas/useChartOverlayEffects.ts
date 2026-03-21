import type { CanvasManager } from '@renderer/utils/canvas/CanvasManager';
import { useOrderFlashStore } from '@renderer/store/orderFlashStore';
import type { MutableRefObject } from 'react';
import { useEffect } from 'react';
import type { BackendExecution } from '../useOrderLinesRenderer';

const ORDER_LOADING_TIMEOUT_MS = 15_000;

export interface UseChartOverlayEffectsProps {
  manager: CanvasManager | null;
  allExecutions: BackendExecution[];
  orderLoadingMapRef: MutableRefObject<Map<string, number>>;
  orderFlashMapRef: MutableRefObject<Map<string, number>>;
  backendExecutions: unknown;
  exchangeOpenOrders: unknown;
  exchangeAlgoOrders: unknown;
}

export const useChartOverlayEffects = ({
  manager,
  allExecutions,
  orderLoadingMapRef,
  orderFlashMapRef,
  backendExecutions,
  exchangeOpenOrders,
  exchangeAlgoOrders,
}: UseChartOverlayEffectsProps): void => {
  useEffect(() => {
    manager?.markDirty('overlays');
  }, [backendExecutions, manager]);

  useEffect(() => {
    manager?.markDirty('overlays');
  }, [exchangeOpenOrders, exchangeAlgoOrders, manager]);

  useEffect(() => {
    if (orderLoadingMapRef.current.size === 0) return;
    const activeIds = new Set(allExecutions.map(e => e.id));
    const now = Date.now();
    let cleared = false;
    for (const [loadingId, startTime] of orderLoadingMapRef.current.entries()) {
      if (now - startTime > ORDER_LOADING_TIMEOUT_MS || activeIds.has(loadingId) === false) {
        orderLoadingMapRef.current.delete(loadingId);
        cleared = true;
      }
    }
    if (cleared) manager?.markDirty('overlays');
  }, [allExecutions, manager, orderLoadingMapRef]);

  useEffect(() => {
    if (!manager) return;
    let rafId = 0;
    let isAnimating = false;
    const animationLoop = () => {
      const hasLoading = orderLoadingMapRef.current.size > 0;
      const hasFlash = orderFlashMapRef.current.size > 0 || useOrderFlashStore.getState().flashes.size > 0;
      if (hasLoading || hasFlash) {
        manager.markDirty('overlays');
        rafId = requestAnimationFrame(animationLoop);
      } else {
        isAnimating = false;
      }
    };
    const startAnimation = () => {
      if (isAnimating) return;
      isAnimating = true;
      rafId = requestAnimationFrame(animationLoop);
    };
    const unsubFlash = useOrderFlashStore.subscribe((state) => {
      if (state.flashes.size > 0) startAnimation();
    });
    const checkInterval = setInterval(() => {
      if (orderLoadingMapRef.current.size > 0 || orderFlashMapRef.current.size > 0) startAnimation();
    }, 500);
    return () => {
      unsubFlash();
      clearInterval(checkInterval);
      cancelAnimationFrame(rafId);
    };
  }, [manager, orderLoadingMapRef, orderFlashMapRef]);
};
