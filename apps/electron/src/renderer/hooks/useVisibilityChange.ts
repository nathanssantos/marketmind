import { useCallback, useEffect, useRef, useState } from 'react';

export interface VisibilityState {
  isVisible: boolean;
  wasHidden: boolean;
  hiddenDuration: number;
  lastVisibleTime: number;
}

export interface UseVisibilityChangeOptions {
  onBecameVisible?: (state: VisibilityState) => void;
  onBecameHidden?: () => void;
  minHiddenDurationForRefresh?: number;
}

const DEFAULT_MIN_HIDDEN_DURATION_MS = 30_000;

export const useVisibilityChange = (options: UseVisibilityChangeOptions = {}) => {
  const {
    onBecameVisible,
    onBecameHidden,
    minHiddenDurationForRefresh = DEFAULT_MIN_HIDDEN_DURATION_MS,
  } = options;

  const [isVisible, setIsVisible] = useState(!document.hidden);
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const hiddenAtRef = useRef<number | null>(null);
  const lastVisibleTimeRef = useRef<number>(Date.now());
  const onBecameVisibleRef = useRef(onBecameVisible);
  const onBecameHiddenRef = useRef(onBecameHidden);

  useEffect(() => {
    onBecameVisibleRef.current = onBecameVisible;
    onBecameHiddenRef.current = onBecameHidden;
  }, [onBecameVisible, onBecameHidden]);

  const handleVisibilityChange = useCallback(() => {
    const nowVisible = !document.hidden;

    if (!nowVisible) {
      hiddenAtRef.current = Date.now();
      setIsVisible(false);
      onBecameHiddenRef.current?.();
      return;
    }

    const hiddenDuration = hiddenAtRef.current ? Date.now() - hiddenAtRef.current : 0;
    const wasHiddenLongEnough = hiddenDuration >= minHiddenDurationForRefresh;

    setIsVisible(true);
    setNeedsRefresh(wasHiddenLongEnough);
    lastVisibleTimeRef.current = Date.now();

    const state: VisibilityState = {
      isVisible: true,
      wasHidden: hiddenAtRef.current !== null,
      hiddenDuration,
      lastVisibleTime: lastVisibleTimeRef.current,
    };

    onBecameVisibleRef.current?.(state);
    hiddenAtRef.current = null;
  }, [minHiddenDurationForRefresh]);

  useEffect(() => {
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [handleVisibilityChange]);

  const clearRefreshNeeded = useCallback(() => {
    setNeedsRefresh(false);
  }, []);

  return {
    isVisible,
    needsRefresh,
    clearRefreshNeeded,
    lastVisibleTime: lastVisibleTimeRef.current,
  };
};
