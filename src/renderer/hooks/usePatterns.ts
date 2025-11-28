import { patternStorage } from '@renderer/services/patternStorage';
import type { Pattern, PatternSource } from '@shared/types/pattern';
import { useCallback, useEffect, useState } from 'react';

interface UsePatternsProps {
  symbol: string;
  conversationId?: string | null;
}

interface UsePatternsReturn {
  patterns: Pattern[];
  patternsVisible: boolean;
  hasPatterns: boolean;
  addPatterns: (newPatterns: Pattern[]) => Promise<void>;
  deletePattern: (patternId: number) => Promise<void>;
  deleteAllPatterns: () => Promise<void>;
  deletePatternsBySource: (source: PatternSource) => Promise<void>;
  togglePatternsVisibility: () => void;
  togglePatternVisibility: (patternId: number) => void;
  processAIResponse: ((response: string) => Promise<string>) | undefined;
}

export const usePatterns = ({ symbol, conversationId }: UsePatternsProps): UsePatternsReturn => {
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [patternsVisible, setPatternsVisible] = useState(true);
  const [hasPatterns, setHasPatterns] = useState(false);

  const loadPatterns = useCallback(async () => {
    try {
      const loaded = await patternStorage.getPatterns(symbol);
      setPatterns(loaded);
      setHasPatterns(loaded.length > 0);
    } catch (error) {
      console.error('[usePatterns] Error loading patterns:', error);
      setPatterns([]);
      setHasPatterns(false);
    }
  }, [symbol]);

  useEffect(() => {
    void loadPatterns();
  }, [loadPatterns]);

  const savePatterns = useCallback(async (newPatterns: Pattern[]) => {
    try {
      await patternStorage.savePatterns(symbol, newPatterns);
      setPatterns(newPatterns);
      setHasPatterns(newPatterns.length > 0);
    } catch (error) {
      console.error('[usePatterns] Error saving patterns:', error);
      throw error;
    }
  }, [symbol]);

  const addPatterns = useCallback(async (newPatterns: Pattern[]) => {
    const existingIds = new Set(patterns.map(p => p.id));
    const uniqueNew = newPatterns.filter(p => !existingIds.has(p.id));
    
    if (uniqueNew.length === 0) return;

    const updated = [...patterns, ...uniqueNew];
    await savePatterns(updated);
  }, [patterns, savePatterns]);

  const deletePattern = useCallback(async (patternId: number) => {
    const updatedPatterns = patterns.filter((pattern) => pattern.id !== patternId);
    
    if (updatedPatterns.length === 0) {
      await patternStorage.deleteAllPatterns(symbol);
      setPatterns([]);
      setHasPatterns(false);
    } else {
      await savePatterns(updatedPatterns);
    }
  }, [patterns, symbol, savePatterns]);

  const deleteAllPatterns = useCallback(async () => {
    await patternStorage.deleteAllPatterns(symbol);
    setPatterns([]);
    setHasPatterns(false);
  }, [symbol]);

  const deletePatternsBySource = useCallback(async (source: PatternSource) => {
    await patternStorage.deletePatternsBySource(symbol, source);
    await loadPatterns();
  }, [symbol, loadPatterns]);

  const togglePatternsVisibility = useCallback(() => {
    setPatternsVisible(prev => !prev);
  }, []);

  const togglePatternVisibility = useCallback((patternId: number) => {
    setPatterns((prevPatterns) =>
      prevPatterns.map((pattern) =>
        pattern.id === patternId
          ? { ...pattern, visible: pattern.visible === false ? true : false }
          : pattern
      )
    );
  }, []);

  const extractPatternsFromParsed = (parsed: unknown): Pattern[] => {
    const newPatterns: Pattern[] = [];
    
    if (typeof parsed !== 'object' || parsed === null) return newPatterns;
    
    const data = parsed as Record<string, unknown>;
    
    const arrayFields = ['lines', 'zones', 'channels', 'fibonaccis', 'formations', 'gaps'];
    
    arrayFields.forEach(field => {
      if (Array.isArray(data[field])) {
        data[field].forEach((item: Pattern) => {
          newPatterns.push({ ...item, source: 'ai' as PatternSource, visible: true });
        });
      }
    });
    
    return newPatterns;
  };

  const parseAIPatterns = useCallback((response: string): Pattern[] => {
    try {
      const jsonMatch = response.match(/```json\n([\s\S]*?)\n```/);
      if (!jsonMatch?.[1]) return [];

      const parsed = JSON.parse(jsonMatch[1]);
      return extractPatternsFromParsed(parsed);
    } catch (error) {
      console.error('[usePatterns] Error parsing AI patterns:', error);
      return [];
    }
  }, []);

  const processAIResponse = useCallback(
    async (response: string): Promise<string> => {
      try {
        const newPatterns = parseAIPatterns(response);
        if (newPatterns.length > 0) {
          await addPatterns(newPatterns);
        }
      } catch (error) {
        console.error('[usePatterns] Error processing AI response:', error);
      }
      return response;
    },
    [parseAIPatterns, addPatterns]
  );

  return {
    patterns,
    patternsVisible,
    hasPatterns,
    addPatterns,
    deletePattern,
    deleteAllPatterns,
    deletePatternsBySource,
    togglePatternsVisibility,
    togglePatternVisibility,
    processAIResponse: conversationId ? processAIResponse : undefined,
  };
};
