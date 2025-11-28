import { createContext, useContext, useState, type ReactNode } from 'react';

interface PatternHoverContextType {
  hoveredPatternId: number | null;
  setHoveredPatternId: (id: number | null) => void;
}

const PatternHoverContext = createContext<PatternHoverContextType | undefined>(undefined);

export const PatternHoverProvider = ({ children }: { children: ReactNode }) => {
  const [hoveredPatternId, setHoveredPatternId] = useState<number | null>(null);

  return (
    <PatternHoverContext.Provider value={{ hoveredPatternId, setHoveredPatternId }}>
      {children}
    </PatternHoverContext.Provider>
  );
};

export const usePatternHover = () => {
  const context = useContext(PatternHoverContext);
  if (!context) {
    throw new Error('usePatternHover must be used within PatternHoverProvider');
  }
  return context;
};
