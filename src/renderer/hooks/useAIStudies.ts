import type { AIStudy, AIStudyData } from '@shared/types';
import { useCallback, useEffect, useState } from 'react';
import { parseAIResponse } from '../services/ai/AIResponseParser';
import { aiStudyStorage } from '../services/ai/AIStudyStorage';

interface UseAIStudiesOptions {
  symbol: string;
  conversationId?: string | null;
}

export const useAIStudies = ({ symbol, conversationId }: UseAIStudiesOptions) => {
  const [studies, setStudies] = useState<AIStudy[]>([]);
  const [hasStudies, setHasStudies] = useState(false);
  const [currentStudyDataId, setCurrentStudyDataId] = useState<string | null>(null);

  const storageKey = conversationId || symbol;

  const loadStudies = useCallback(async () => {
    const data = await aiStudyStorage.getStudiesForSymbol(storageKey);
    if (data) {
      setStudies(data.studies);
      setHasStudies(true);
      setCurrentStudyDataId(data.id);
    } else {
      setStudies([]);
      setHasStudies(false);
      setCurrentStudyDataId(null);
    }
  }, [storageKey]);

  useEffect(() => {
    loadStudies();
  }, [loadStudies]);

  const saveStudies = useCallback(
    async (newStudies: AIStudy[]) => {
      const data: AIStudyData = {
        id: currentStudyDataId || `${storageKey}-${Date.now()}`,
        symbol,
        createdAt: currentStudyDataId ? Date.now() : Date.now(),
        studies: newStudies,
      };
      await aiStudyStorage.saveStudiesForSymbol(storageKey, data);
      setStudies(newStudies);
      setHasStudies(true);
      setCurrentStudyDataId(data.id);
    },
    [storageKey, symbol, currentStudyDataId]
  );

  const deleteStudies = useCallback(async () => {
    await aiStudyStorage.deleteStudiesForSymbol(storageKey);
    setStudies([]);
    setHasStudies(false);
    setCurrentStudyDataId(null);
  }, [storageKey]);

  const toggleStudiesVisibility = useCallback(() => {
    setStudies((prevStudies) =>
      prevStudies.map((study) => ({
        ...study,
        visible: study.visible === false ? true : false,
      }))
    );
  }, []);

  const processAIResponse = useCallback(
    async (response: string) => {
      const parsed = parseAIResponse(response);
      
      if (parsed.studies && parsed.studies.length > 0) {
        const existingStudies = hasStudies ? studies : [];
        const maxId = existingStudies.length > 0 
          ? Math.max(...existingStudies.map(s => s.id || 0))
          : 0;
        
        const newStudiesWithIds = parsed.studies.map((study, index) => ({
          ...study,
          id: maxId + index + 1,
        }));
        
        const allStudies = [...existingStudies, ...newStudiesWithIds];
        await saveStudies(allStudies);
      }

      return parsed.analysis;
    },
    [hasStudies, studies, saveStudies]
  );

  return {
    studies,
    hasStudies,
    studiesVisible: studies.length > 0 && studies.some((s) => s.visible !== false),
    studyDataId: currentStudyDataId,
    loadStudies,
    saveStudies,
    deleteStudies,
    toggleStudiesVisibility,
    processAIResponse,
  };
};
