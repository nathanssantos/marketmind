import { useEffect, useRef } from 'react';
import { useTradingStore } from '../store/tradingStore';
import { useUIStore } from '../store/uiStore';

export const useSimulatorLayout = () => {
  const isSimulatorActive = useTradingStore((state) => state.isSimulatorActive);
  const chatPosition = useUIStore((state) => state.chatPosition);
  const setChatPosition = useUIStore((state) => state.setChatPosition);
  const prevPositionRef = useRef<'left' | 'right'>('right');

  useEffect(() => {
    if (isSimulatorActive) {
      prevPositionRef.current = chatPosition;
      if (chatPosition !== 'left') {
        setChatPosition('left');
      }
    } else {
      setChatPosition(prevPositionRef.current);
    }
  }, [isSimulatorActive, chatPosition, setChatPosition]);
};
