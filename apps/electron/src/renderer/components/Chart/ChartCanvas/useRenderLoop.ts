import { useCallback, useEffect, useRef } from 'react';

export interface RenderLoopStats {
  fps: number;
  frameTime: number;
  droppedFrames: number;
  totalFrames: number;
}

export interface UseRenderLoopProps {
  onRender: (deltaTime: number) => void;
  targetFPS?: number;
  enabled?: boolean;
  onStatsUpdate?: (stats: RenderLoopStats) => void;
}

export interface UseRenderLoopResult {
  requestRender: () => void;
  getStats: () => RenderLoopStats;
  resetStats: () => void;
}

const DEFAULT_TARGET_FPS = 60;
const STATS_UPDATE_INTERVAL = 1000;

export const useRenderLoop = ({
  onRender,
  targetFPS = DEFAULT_TARGET_FPS,
  enabled = true,
  onStatsUpdate,
}: UseRenderLoopProps): UseRenderLoopResult => {
  const frameIdRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number>(0);
  const renderRequestedRef = useRef<boolean>(false);
  const onRenderRef = useRef(onRender);
  const onStatsUpdateRef = useRef(onStatsUpdate);

  const statsRef = useRef<RenderLoopStats>({
    fps: 0,
    frameTime: 0,
    droppedFrames: 0,
    totalFrames: 0,
  });

  const frameTimesRef = useRef<number[]>([]);
  const lastStatsUpdateRef = useRef<number>(0);

  const targetFrameTime = 1000 / targetFPS;

  useEffect(() => {
    onRenderRef.current = onRender;
  }, [onRender]);

  useEffect(() => {
    onStatsUpdateRef.current = onStatsUpdate;
  }, [onStatsUpdate]);

  const updateStats = useCallback((frameTime: number, timestamp: number) => {
    frameTimesRef.current.push(frameTime);

    if (frameTimesRef.current.length > 60) {
      frameTimesRef.current.shift();
    }

    if (timestamp - lastStatsUpdateRef.current >= STATS_UPDATE_INTERVAL) {
      const frameTimes = frameTimesRef.current;
      const avgFrameTime = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
      const fps = 1000 / avgFrameTime;

      statsRef.current = {
        fps: Math.round(fps * 10) / 10,
        frameTime: Math.round(avgFrameTime * 100) / 100,
        droppedFrames: statsRef.current.droppedFrames,
        totalFrames: statsRef.current.totalFrames,
      };

      lastStatsUpdateRef.current = timestamp;
      onStatsUpdateRef.current?.(statsRef.current);
    }
  }, []);

  const loop = useCallback((timestamp: number) => {
    if (!enabled) {
      frameIdRef.current = null;
      return;
    }

    const elapsed = timestamp - lastFrameTimeRef.current;

    if (elapsed >= targetFrameTime || renderRequestedRef.current) {
      const overshoot = elapsed - targetFrameTime;
      const framesToSkip = Math.floor(overshoot / targetFrameTime);

      if (framesToSkip > 0) {
        statsRef.current.droppedFrames += framesToSkip;
      }

      lastFrameTimeRef.current = timestamp - (overshoot % targetFrameTime);
      renderRequestedRef.current = false;
      statsRef.current.totalFrames++;

      const frameStart = performance.now();
      onRenderRef.current(elapsed);
      const frameTime = performance.now() - frameStart;

      updateStats(frameTime, timestamp);
    }

    frameIdRef.current = requestAnimationFrame(loop);
  }, [enabled, targetFrameTime, updateStats]);

  const requestRender = useCallback(() => {
    renderRequestedRef.current = true;
  }, []);

  const getStats = useCallback((): RenderLoopStats => {
    return { ...statsRef.current };
  }, []);

  const resetStats = useCallback(() => {
    statsRef.current = {
      fps: 0,
      frameTime: 0,
      droppedFrames: 0,
      totalFrames: 0,
    };
    frameTimesRef.current = [];
  }, []);

  useEffect(() => {
    if (!enabled) {
      if (frameIdRef.current !== null) {
        cancelAnimationFrame(frameIdRef.current);
        frameIdRef.current = null;
      }
      return;
    }

    lastFrameTimeRef.current = performance.now();
    frameIdRef.current = requestAnimationFrame(loop);

    return () => {
      if (frameIdRef.current !== null) {
        cancelAnimationFrame(frameIdRef.current);
        frameIdRef.current = null;
      }
    };
  }, [enabled, loop]);

  return {
    requestRender,
    getStats,
    resetStats,
  };
};

export const createFrameLimiter = (targetFPS: number = DEFAULT_TARGET_FPS) => {
  const targetFrameTime = 1000 / targetFPS;
  let lastFrameTime: number | null = null;

  return (timestamp: number): boolean => {
    if (lastFrameTime === null) {
      lastFrameTime = timestamp;
      return true;
    }

    const elapsed = timestamp - lastFrameTime;
    if (elapsed >= targetFrameTime) {
      lastFrameTime = timestamp;
      return true;
    }
    return false;
  };
};

export const measureRenderTime = <T>(
  renderFn: () => T,
  label?: string
): { result: T; duration: number } => {
  const start = performance.now();
  const result = renderFn();
  const duration = performance.now() - start;

  if (label && duration > 16) {
    console.warn(`[Performance] ${label} took ${duration.toFixed(2)}ms (target: 16ms)`);
  }

  return { result, duration };
};

export const batchRenders = (renderFns: Array<() => void>): void => {
  const startTime = performance.now();
  let completed = 0;

  const runBatch = () => {
    while (completed < renderFns.length) {
      renderFns[completed]!();
      completed++;

      if (performance.now() - startTime > 8) {
        requestAnimationFrame(runBatch);
        return;
      }
    }
  };

  runBatch();
};
