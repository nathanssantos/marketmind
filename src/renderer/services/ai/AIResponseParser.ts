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

    if (studiesWithIds.length > 0) {
      const missingReferences: number[] = [];
      studiesWithIds.forEach((study) => {
        const studyRef = `Study #${study.id}`;
        if (!analysis.includes(studyRef)) {
          missingReferences.push(study.id);
        }
      });

      if (missingReferences.length > 0) {
        console.warn(
          `[AIResponseParser] Studies not referenced in analysis text: ${missingReferences.map(id => `#${id}`).join(', ')}. ` +
          `Total studies created: ${studiesWithIds.length}, Referenced: ${studiesWithIds.length - missingReferences.length}`
        );
      }
    }

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
  if (!study.type) return false;

  const validatePoint = (p: unknown): boolean => {
    return (
      p !== null &&
      typeof p === 'object' &&
      'timestamp' in p &&
      'price' in p &&
      typeof p.timestamp === 'number' &&
      typeof p.price === 'number'
    );
  };

  const validatePointPair = (pair: unknown): boolean => {
    return Array.isArray(pair) && pair.length === 2 && pair.every(validatePoint);
  };

  if ('points' in study) {
    return validatePointPair(study.points);
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

  if ('upperLine' in study && 'lowerLine' in study) {
    return validatePointPair(study.upperLine) && validatePointPair(study.lowerLine);
  }

  if ('startPoint' in study && 'endPoint' in study) {
    return (
      validatePoint(study.startPoint) &&
      validatePoint(study.endPoint) &&
      Array.isArray(study.levels) &&
      study.levels.every(
        (l: unknown) =>
          l !== null &&
          typeof l === 'object' &&
          'ratio' in l &&
          'price' in l &&
          typeof l.ratio === 'number' &&
          typeof l.price === 'number'
      )
    );
  }

  if ('leftShoulder' in study && 'head' in study && 'rightShoulder' in study) {
    return (
      validatePoint(study.leftShoulder) &&
      validatePoint(study.head) &&
      validatePoint(study.rightShoulder) &&
      (!study.neckline || validatePointPair(study.neckline))
    );
  }

  if ('firstPeak' in study && 'secondPeak' in study) {
    return (
      validatePoint(study.firstPeak) &&
      validatePoint(study.secondPeak) &&
      (!study.neckline || validatePoint(study.neckline))
    );
  }

  if ('peak1' in study && 'peak2' in study && 'peak3' in study) {
    return (
      validatePoint(study.peak1) &&
      validatePoint(study.peak2) &&
      validatePoint(study.peak3) &&
      (!study.neckline || validatePointPair(study.neckline))
    );
  }

  if ('upperTrendline' in study && 'lowerTrendline' in study) {
    return validatePointPair(study.upperTrendline) && validatePointPair(study.lowerTrendline);
  }

  if ('flagpole' in study) {
    const validPole =
      study.flagpole &&
      typeof study.flagpole === 'object' &&
      'start' in study.flagpole &&
      'end' in study.flagpole &&
      validatePoint(study.flagpole.start) &&
      validatePoint(study.flagpole.end);

    if ('flag' in study) {
      return (
        validPole &&
        study.flag &&
        typeof study.flag === 'object' &&
        'upperTrendline' in study.flag &&
        'lowerTrendline' in study.flag &&
        validatePointPair(study.flag.upperTrendline) &&
        validatePointPair(study.flag.lowerTrendline)
      );
    }

    if ('pennant' in study) {
      return (
        validPole &&
        study.pennant &&
        typeof study.pennant === 'object' &&
        'upperTrendline' in study.pennant &&
        'lowerTrendline' in study.pennant &&
        validatePointPair(study.pennant.upperTrendline) &&
        validatePointPair(study.pennant.lowerTrendline)
      );
    }
  }

  if ('cupStart' in study && 'cupBottom' in study && 'cupEnd' in study) {
    return (
      validatePoint(study.cupStart) &&
      validatePoint(study.cupBottom) &&
      validatePoint(study.cupEnd) &&
      validatePoint(study.handleStart) &&
      validatePoint(study.handleLow) &&
      validatePoint(study.handleEnd)
    );
  }

  if ('start' in study && 'bottom' in study && 'end' in study) {
    return validatePoint(study.start) && validatePoint(study.bottom) && validatePoint(study.end);
  }

  if ('gapStart' in study && 'gapEnd' in study) {
    return validatePoint(study.gapStart) && validatePoint(study.gapEnd);
  }

  if ('impulse' in study) {
    const validImpulse =
      study.impulse &&
      typeof study.impulse === 'object' &&
      'wave1' in study.impulse &&
      'wave2' in study.impulse &&
      'wave3' in study.impulse &&
      'wave4' in study.impulse &&
      'wave5' in study.impulse;

    if (!validImpulse) return false;

    const waves = [
      study.impulse.wave1,
      study.impulse.wave2,
      study.impulse.wave3,
      study.impulse.wave4,
      study.impulse.wave5,
    ];

    return waves.every(
      (w: unknown) =>
        w !== null &&
        typeof w === 'object' &&
        'start' in w &&
        'end' in w &&
        validatePoint(w.start) &&
        validatePoint(w.end)
    );
  }

  return false;
};
