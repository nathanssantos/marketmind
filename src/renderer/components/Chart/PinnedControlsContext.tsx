import { createContext, useContext, useState, type ReactNode, type ReactElement } from 'react';

export type PinnedControl = 
  | 'rightMargin'
  | 'volumeHeightRatio'
  | 'candleSpacing'
  | 'candleWickWidth'
  | 'gridLineWidth'
  | 'paddingTop'
  | 'paddingBottom'
  | 'paddingLeft'
  | 'paddingRight';

interface PinnedControlsContextType {
  pinnedControls: Set<PinnedControl>;
  togglePin: (control: PinnedControl) => void;
  isPinned: (control: PinnedControl) => boolean;
}

const PinnedControlsContext = createContext<PinnedControlsContextType | undefined>(undefined);

export const usePinnedControls = (): PinnedControlsContextType => {
  const context = useContext(PinnedControlsContext);
  if (!context) {
    throw new Error('usePinnedControls must be used within PinnedControlsProvider');
  }
  return context;
};

export const PinnedControlsProvider = ({ children }: { children: ReactNode }): ReactElement => {
  const [pinnedControls, setPinnedControls] = useState<Set<PinnedControl>>(new Set());

  const togglePin = (control: PinnedControl): void => {
    setPinnedControls((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(control)) {
        newSet.delete(control);
      } else {
        newSet.add(control);
      }
      return newSet;
    });
  };

  const isPinned = (control: PinnedControl): boolean => {
    return pinnedControls.has(control);
  };

  return (
    <PinnedControlsContext.Provider value={{ pinnedControls, togglePin, isPinned }}>
      {children}
    </PinnedControlsContext.Provider>
  );
};
