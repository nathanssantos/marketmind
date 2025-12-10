import { useCallback, useEffect, useRef, useState } from 'react';

export type PlaybackState = 'idle' | 'playing' | 'paused' | 'completed';
export type PlaybackSpeed = 0.25 | 0.5 | 1 | 2 | 4 | 8;

export interface UseBacktestPlaybackProps {
  totalKlines: number;
  startIndex?: number;
  autoPlay?: boolean;
  defaultSpeed?: PlaybackSpeed;
  onIndexChange?: (index: number) => void;
  onStateChange?: (state: PlaybackState) => void;
}

export interface UseBacktestPlaybackResult {
  currentIndex: number;
  state: PlaybackState;
  speed: PlaybackSpeed;
  progress: number;
  play: () => void;
  pause: () => void;
  stop: () => void;
  stepForward: () => void;
  stepBackward: () => void;
  setSpeed: (speed: PlaybackSpeed) => void;
  goToIndex: (index: number) => void;
  reset: () => void;
}

export const useBacktestPlayback = ({
  totalKlines,
  startIndex = 0,
  autoPlay = false,
  defaultSpeed = 1,
  onIndexChange,
  onStateChange,
}: UseBacktestPlaybackProps): UseBacktestPlaybackResult => {
  const [currentIndex, setCurrentIndex] = useState(startIndex);
  const [state, setState] = useState<PlaybackState>(autoPlay ? 'playing' : 'idle');
  const [speed, setSpeedState] = useState<PlaybackSpeed>(defaultSpeed);
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const progress = totalKlines > 0 ? (currentIndex / totalKlines) * 100 : 0;

  const updateState = useCallback(
    (newState: PlaybackState) => {
      setState(newState);
      if (onStateChange) {
        onStateChange(newState);
      }
    },
    [onStateChange]
  );

  const updateIndex = useCallback(
    (newIndex: number) => {
      const clampedIndex = Math.max(0, Math.min(newIndex, totalKlines - 1));
      setCurrentIndex(clampedIndex);
      
      if (onIndexChange) {
        onIndexChange(clampedIndex);
      }

      if (clampedIndex >= totalKlines - 1) {
        updateState('completed');
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }
    },
    [totalKlines, onIndexChange, updateState]
  );

  const play = useCallback(() => {
    if (state === 'playing') return;
    if (currentIndex >= totalKlines - 1) {
      updateIndex(0);
    }

    updateState('playing');
  }, [state, currentIndex, totalKlines, updateState, updateIndex]);

  const pause = useCallback(() => {
    if (state !== 'playing') return;
    updateState('paused');
    
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, [state, updateState]);

  const stop = useCallback(() => {
    updateState('idle');
    updateIndex(0);
    
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, [updateState, updateIndex]);

  const stepForward = useCallback(() => {
    if (currentIndex < totalKlines - 1) {
      updateIndex(currentIndex + 1);
    }
  }, [currentIndex, totalKlines, updateIndex]);

  const stepBackward = useCallback(() => {
    if (currentIndex > 0) {
      updateIndex(currentIndex - 1);
    }
  }, [currentIndex, updateIndex]);

  const setSpeed = useCallback((newSpeed: PlaybackSpeed) => {
    setSpeedState(newSpeed);
  }, []);

  const goToIndex = useCallback(
    (index: number) => {
      updateIndex(index);
    },
    [updateIndex]
  );

  const reset = useCallback(() => {
    stop();
    setSpeedState(defaultSpeed);
  }, [stop, defaultSpeed]);

  useEffect(() => {
    if (state === 'playing') {
      const interval = 1000 / speed;
      
      intervalRef.current = setInterval(() => {
        setCurrentIndex((prev) => {
          const next = prev + 1;
          if (next >= totalKlines) {
            updateState('completed');
            if (intervalRef.current) {
              clearInterval(intervalRef.current);
              intervalRef.current = null;
            }
            return prev;
          }
          
          if (onIndexChange) {
            onIndexChange(next);
          }
          
          return next;
        });
      }, interval);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [state, speed, totalKlines, onIndexChange, updateState]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return {
    currentIndex,
    state,
    speed,
    progress,
    play,
    pause,
    stop,
    stepForward,
    stepBackward,
    setSpeed,
    goToIndex,
    reset,
  };
};
