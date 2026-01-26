import type { MarketType, TimeInterval } from '@marketmind/types';
import { useState } from 'react';
import type { SectionExpandedState } from '../types';

export interface UseWatcherStateReturn {
  expandedSections: SectionExpandedState;
  toggleSection: (section: keyof SectionExpandedState) => void;
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
  const [expandedSections, setExpandedSections] = useState<SectionExpandedState>({
    watchers: true,
    dynamicSelection: false,
    leverageSettings: false,
    trailingStop: false,
    tpMode: false,
    filters: false,
    opportunityCost: false,
    pyramiding: false,
  });

  const [quickStartCount, setQuickStartCount] = useState(10);
  const [quickStartTimeframe, setQuickStartTimeframe] = useState<TimeInterval>('1h');
  const [quickStartMarketType, setQuickStartMarketType] = useState<MarketType>('FUTURES');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showRankingsDialog, setShowRankingsDialog] = useState(false);
  const [showEmergencyConfirm, setShowEmergencyConfirm] = useState(false);

  const toggleSection = (section: keyof SectionExpandedState): void => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  return {
    expandedSections,
    toggleSection,
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
