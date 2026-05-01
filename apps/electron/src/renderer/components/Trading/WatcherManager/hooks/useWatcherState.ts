import type { MarketType, TimeInterval } from '@marketmind/types';
import { DEFAULT_TIMEFRAME } from '@renderer/constants/defaults';
import { useState } from 'react';

export interface UseWatcherStateReturn {
  quickStartCount: number;
  setQuickStartCount: (count: number) => void;
  quickStartTimeframe: TimeInterval;
  setQuickStartTimeframe: (timeframe: TimeInterval) => void;
  quickStartMarketType: MarketType;
  setQuickStartMarketType: (marketType: MarketType) => void;
  showAddDialog: boolean;
  setShowAddDialog: (show: boolean) => void;
  showRankingsDialog: boolean;
  setShowRankingsDialog: (show: boolean) => void;
  showEmergencyConfirm: boolean;
  setShowEmergencyConfirm: (show: boolean) => void;
}

export const useWatcherState = (): UseWatcherStateReturn => {
  const [quickStartCount, setQuickStartCount] = useState(20);
  const [quickStartTimeframe, setQuickStartTimeframe] = useState<TimeInterval>(DEFAULT_TIMEFRAME);
  const [quickStartMarketType, setQuickStartMarketType] = useState<MarketType>('FUTURES');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showRankingsDialog, setShowRankingsDialog] = useState(false);
  const [showEmergencyConfirm, setShowEmergencyConfirm] = useState(false);

  return {
    quickStartCount,
    setQuickStartCount,
    quickStartTimeframe,
    setQuickStartTimeframe,
    quickStartMarketType,
    setQuickStartMarketType,
    showAddDialog,
    setShowAddDialog,
    showRankingsDialog,
    setShowRankingsDialog,
    showEmergencyConfirm,
    setShowEmergencyConfirm,
  };
};
