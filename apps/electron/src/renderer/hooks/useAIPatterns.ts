import type { AIPattern, AIPatternData } from '@shared/types';
import { useCallback, useEffect, useState } from 'react';
import { parseAIResponse } from '../services/ai/AIResponseParser';


interface UseAIPatternsOptions {
  symbol: string;
  conversationId?: string | null;
}

export const useAIPatterns = ({ symbol, conversationId }: UseAIPatternsOptions) => {
  const [patterns, setPatterns] = useState<AIPattern[]>([]);
  const [hasPatterns, setHasPatterns] = useState(false);
  const [currentPatternDataId, setCurrentPatternDataId] = useState<string | null>(null);

  const storageKey = conversationId || symbol;

  const loadPatterns = useCallback(async () => {
    const result = await window.electron.secureStorage.getAIPatternsForSymbol(storageKey);
    if (result.success && result.data) {
      setPatterns(result.data.patterns);
      setHasPatterns(true);
      setCurrentPatternDataId(result.data.id);
    } else {
      setPatterns([]);
      setHasPatterns(false);
      setCurrentPatternDataId(null);
    }
  }, [storageKey]);

  useEffect(() => {
    loadPatterns();
  }, [loadPatterns]);

  const savePatterns = useCallback(
    async (newPatterns: AIPattern[]) => {
      const data: AIPatternData = {
        id: currentPatternDataId || `${storageKey}-${Date.now()}`,
        symbol,
        createdAt: currentPatternDataId ? Date.now() : Date.now(),
        patterns: newPatterns,
      };
      await window.electron.secureStorage.setAIPatternsForSymbol(storageKey, data);
      setPatterns(newPatterns);
      setHasPatterns(true);
      setCurrentPatternDataId(data.id);
    },
    [storageKey, symbol, currentPatternDataId]
  );

  const deletePatterns = useCallback(async () => {
    await window.electron.secureStorage.deleteAIPatternsForSymbol(storageKey);
    setPatterns([]);
    setHasPatterns(false);
    setCurrentPatternDataId(null);
  }, [storageKey]);

  const deletePattern= useCallback(async (patternId: number) => {
    console.log('[useAIPatterns] deletePatterncalled:', { patternId, currentPatternsLength: patterns.length });
    const updatedPatterns = patterns.filter((pattern) => pattern.id !== patternId);
    console.log('[useAIPatterns] After filter:', { updatedPatternsLength: updatedPatterns.length });
    if (updatedPatterns.length === 0) {
      console.log('[useAIPatterns] No patterns left, deleting all');
      await window.electron.secureStorage.deleteAIPatternsForSymbol(storageKey);
      setPatterns([]);
      setHasPatterns(false);
      setCurrentPatternDataId(null);
    } else {
      console.log('[useAIPatterns] Calling savePatterns with:', updatedPatterns.length, 'patterns');
      await savePatterns(updatedPatterns);
    }
  }, [patterns, storageKey, savePatterns]);

  const togglePatternsVisibility = useCallback(() => {
    setPatterns((prevPatterns) =>
      prevPatterns.map((pattern) => ({
        ...pattern,
        visible: pattern.visible === false ? true : false,
      }))
    );
  }, []);

  const processAIResponse = useCallback(
    async (response: string) => {
      const parsed = parseAIResponse(response);
      
      if (parsed.patterns && parsed.patterns.length > 0) {
        const existingPatterns = hasPatterns ? patterns : [];
        const maxId = existingPatterns.length > 0 
          ? Math.max(...existingPatterns.map(s => s.id || 0))
          : 0;
        
        const newPatternsWithIds = parsed.patterns.map((pattern: AIPattern, index: number) => ({
          ...pattern,
          id: maxId + index + 1,
        }));
        
        const allPatterns = [...existingPatterns, ...newPatternsWithIds];
        await savePatterns(allPatterns);
      }

      return parsed.analysis;
    },
    [hasPatterns, patterns, savePatterns]
  );

  return {
    patterns,
    hasPatterns,
    patternsVisible: patterns.length > 0 && patterns.some((s) => s.visible !== false),
    patternDataId: currentPatternDataId,
    loadPatterns,
    savePatterns,
    deletePatterns,
    deletePattern,
    togglePatternsVisibility,
    processAIResponse,
  };
};
