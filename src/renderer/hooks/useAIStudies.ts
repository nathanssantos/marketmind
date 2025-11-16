import type { AIStudy, AIStudyData } from '@shared/types';
import { useCallback, useEffect, useState } from 'react';
import { parseAIResponse } from '../services/ai/AIResponseParser';
import { aiStudyStorage } from '../services/ai/AIStudyStorage';

export const useAIStudies = (symbol: string) => {
  const [studies, setStudies] = useState<AIStudy[]>([]);
  const [hasStudies, setHasStudies] = useState(false);

  const loadStudies = useCallback(() => {
    const data = aiStudyStorage.getStudiesForSymbol(symbol);
    if (data) {
      setStudies(data.studies);
      setHasStudies(true);
    } else {
      setStudies([]);
      setHasStudies(false);
    }
  }, [symbol]);

  useEffect(() => {
    loadStudies();
  }, [loadStudies]);

  const saveStudies = useCallback(
    (newStudies: AIStudy[]) => {
      const data: AIStudyData = {
        id: `${symbol}-${Date.now()}`,
        symbol,
        createdAt: Date.now(),
        studies: newStudies,
      };
      aiStudyStorage.saveStudiesForSymbol(symbol, data);
      setStudies(newStudies);
      setHasStudies(true);
    },
    [symbol]
  );

  const deleteStudies = useCallback(() => {
    aiStudyStorage.deleteStudiesForSymbol(symbol);
    setStudies([]);
    setHasStudies(false);
  }, [symbol]);

  const toggleStudiesVisibility = useCallback(() => {
    setStudies((prevStudies) =>
      prevStudies.map((study) => ({
        ...study,
        visible: study.visible === false ? true : false,
      }))
    );
  }, []);

  const processAIResponse = useCallback(
    (response: string) => {
      if (hasStudies) {
        return response;
      }

      const parsed = parseAIResponse(response);
      
      if (parsed.studies && parsed.studies.length > 0) {
        saveStudies(parsed.studies);
      }

      return parsed.analysis;
    },
    [hasStudies, saveStudies]
  );

  return {
    studies,
    hasStudies,
    studiesVisible: studies.length > 0 && studies.some((s) => s.visible !== false),
    loadStudies,
    saveStudies,
    deleteStudies,
    toggleStudiesVisibility,
    processAIResponse,
  };
};
