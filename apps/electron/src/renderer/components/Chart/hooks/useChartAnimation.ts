import { useCallback, useEffect, useRef, useState } from 'react';

export interface UseChartAnimationProps {
  enabled?: boolean;
  fps?: number;
  onFrame?: (timestamp: number, deltaTime: number) => void;
}

export interface UseChartAnimationResult {
  isAnimating: boolean;
  fps: number;
  frameCount: number;
  start: () => void;
  stop: () => void;
  toggle: () => void;
  requestRender: () => void;
}

export const useChartAnimation = ({
  enabled = true,
  fps = 60,
  onFrame,
}: UseChartAnimationProps = {}): UseChartAnimationResult => {
  const [isAnimating, setIsAnimating] = useState(false);
  const [frameCount, setFrameCount] = useState(0);
  const [currentFps, setCurrentFps] = useState(0);

  const animationFrameRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number>(0);
  const fpsCounterRef = useRef<{ frames: number; lastTime: number }>({
    frames: 0,
    lastTime: 0,
  });
  const renderRequestedRef = useRef(false);

  const targetFrameTime = 1000 / fps;

  const animate = useCallback(
    (timestamp: number) => {
      if (!isAnimating) return;

      const deltaTime = timestamp - lastFrameTimeRef.current;

      if (deltaTime >= targetFrameTime) {
        lastFrameTimeRef.current = timestamp;

        if (onFrame) {
          onFrame(timestamp, deltaTime);
        }

        setFrameCount((prev) => prev + 1);

        fpsCounterRef.current.frames++;
        const fpsElapsed = timestamp - fpsCounterRef.current.lastTime;
        if (fpsElapsed >= 1000) {
          setCurrentFps(
            Math.round((fpsCounterRef.current.frames * 1000) / fpsElapsed)
          );
          fpsCounterRef.current.frames = 0;
          fpsCounterRef.current.lastTime = timestamp;
        }
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    },
    [isAnimating, targetFrameTime, onFrame]
  );

  const start = useCallback(() => {
    if (!enabled || isAnimating) return;

    setIsAnimating(true);
    lastFrameTimeRef.current = performance.now();
    fpsCounterRef.current = { frames: 0, lastTime: performance.now() };
  }, [enabled, isAnimating]);

  const stop = useCallback(() => {
    if (!isAnimating) return;

    setIsAnimating(false);
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, [isAnimating]);

  const toggle = useCallback(() => {
    if (isAnimating) {
      stop();
    } else {
      start();
    }
  }, [isAnimating, start, stop]);

  const requestRender = useCallback(() => {
    if (!enabled || renderRequestedRef.current) return;

    renderRequestedRef.current = true;
    requestAnimationFrame((timestamp) => {
      renderRequestedRef.current = false;
      if (onFrame) {
        const deltaTime = timestamp - lastFrameTimeRef.current;
        lastFrameTimeRef.current = timestamp;
        onFrame(timestamp, deltaTime);
      }
    });
  }, [enabled, onFrame]);

  useEffect(() => {
    if (isAnimating) {
      animationFrameRef.current = requestAnimationFrame(animate);
    }

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isAnimating, animate]);

  useEffect(() => {
    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  return {
    isAnimating,
    fps: currentFps,
    frameCount,
    start,
    stop,
    toggle,
    requestRender,
  };
};
