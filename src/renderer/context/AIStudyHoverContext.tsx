import { createContext, useContext, useState, type ReactNode } from 'react';

interface AIStudyHoverContextType {
  hoveredStudyId: number | null;
  setHoveredStudyId: (id: number | null) => void;
}

const AIStudyHoverContext = createContext<AIStudyHoverContextType | undefined>(undefined);

export const AIStudyHoverProvider = ({ children }: { children: ReactNode }) => {
  const [hoveredStudyId, setHoveredStudyId] = useState<number | null>(null);

  return (
    <AIStudyHoverContext.Provider value={{ hoveredStudyId, setHoveredStudyId }}>
      {children}
    </AIStudyHoverContext.Provider>
  );
};

export const useAIStudyHover = () => {
  const context = useContext(AIStudyHoverContext);
  if (!context) {
    throw new Error('useAIStudyHover must be used within AIStudyHoverProvider');
  }
  return context;
};
