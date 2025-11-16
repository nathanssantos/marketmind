import type { AIAnalysisWithStudies, AIStudy } from '@shared/types';

export const parseAIResponse = (response: string): AIAnalysisWithStudies => {
  const jsonBlockRegex = /```json\s*\n([\s\S]*?)\n```/;
  const match = response.match(jsonBlockRegex);

  if (!match || !match[1]) {
    return {
      analysis: response,
    };
  }

  try {
    const jsonData = JSON.parse(match[1]);
    const studies: AIStudy[] = jsonData.studies || [];

    const analysis = response.replace(jsonBlockRegex, '').trim();

    const validStudies = studies.filter(validateAIStudy);

    const studiesWithIds = validStudies.map((study, index) => ({
      ...study,
      id: index + 1,
    }));

    return {
      analysis,
      studies: studiesWithIds,
    };
  } catch (error) {
    console.error('[AIResponseParser] Error parsing AI studies JSON:', error);
    return {
      analysis: response,
    };
  }
};

export const validateAIStudy = (study: AIStudy): boolean => {
  if ('points' in study) {
    if (!study.points || study.points.length !== 2) {
      return false;
    }
    return study.points.every(
      (p) => typeof p.timestamp === 'number' && typeof p.price === 'number'
    );
  }

  if ('topPrice' in study) {
    return (
      typeof study.topPrice === 'number' &&
      typeof study.bottomPrice === 'number' &&
      typeof study.startTimestamp === 'number' &&
      typeof study.endTimestamp === 'number' &&
      study.topPrice > study.bottomPrice &&
      study.endTimestamp > study.startTimestamp
    );
  }

  return false;
};
