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

export const validateAIStudy = (study: unknown): study is AIStudy => {
  if (!study || typeof study !== 'object') return false;

  const s = study as AIStudy;
  if (!s.type) return false;

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

  if ('points' in s) {
    return validatePointPair(s.points);
  }

  if ('topPrice' in s) {
    return (
      typeof s.topPrice === 'number' &&
      typeof s.bottomPrice === 'number' &&
      typeof s.startTimestamp === 'number' &&
      typeof s.endTimestamp === 'number' &&
      s.topPrice > s.bottomPrice &&
      s.endTimestamp > s.startTimestamp
    );
  }

  if ('upperLine' in s && 'lowerLine' in s) {
    return validatePointPair(s.upperLine) && validatePointPair(s.lowerLine);
  }

  if ('startPoint' in s && 'endPoint' in s) {
    return (
      validatePoint(s.startPoint) &&
      validatePoint(s.endPoint) &&
      Array.isArray(s.levels) &&
      s.levels.every(
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

  if ('leftShoulder' in s && 'head' in s && 'rightShoulder' in s) {
    return (
      validatePoint(s.leftShoulder) &&
      validatePoint(s.head) &&
      validatePoint(s.rightShoulder) &&
      (!s.neckline || validatePointPair(s.neckline))
    );
  }

  if ('firstPeak' in s && 'secondPeak' in s) {
    return (
      validatePoint(s.firstPeak) &&
      validatePoint(s.secondPeak) &&
      (!s.neckline || validatePoint(s.neckline))
    );
  }

  if ('peak1' in s && 'peak2' in s && 'peak3' in s) {
    return (
      validatePoint(s.peak1) &&
      validatePoint(s.peak2) &&
      validatePoint(s.peak3) &&
      (!s.neckline || validatePointPair(s.neckline))
    );
  }

  if ('upperTrendline' in s && 'lowerTrendline' in s) {
    return validatePointPair(s.upperTrendline) && validatePointPair(s.lowerTrendline);
  }

  if ('flagpole' in s) {
    const validPole =
      s.flagpole &&
      typeof s.flagpole === 'object' &&
      'start' in s.flagpole &&
      'end' in s.flagpole &&
      validatePoint(s.flagpole.start) &&
      validatePoint(s.flagpole.end);

    if ('flag' in s) {
      return (
        validPole &&
        s.flag &&
        typeof s.flag === 'object' &&
        'upperTrendline' in s.flag &&
        'lowerTrendline' in s.flag &&
        validatePointPair(s.flag.upperTrendline) &&
        validatePointPair(s.flag.lowerTrendline)
      );
    }

    if ('pennant' in s) {
      return (
        validPole &&
        s.pennant &&
        typeof s.pennant === 'object' &&
        'upperTrendline' in s.pennant &&
        'lowerTrendline' in s.pennant &&
        validatePointPair(s.pennant.upperTrendline) &&
        validatePointPair(s.pennant.lowerTrendline)
      );
    }
  }

  if ('cupStart' in s && 'cupBottom' in s && 'cupEnd' in s) {
    return (
      validatePoint(s.cupStart) &&
      validatePoint(s.cupBottom) &&
      validatePoint(s.cupEnd) &&
      validatePoint(s.handleStart) &&
      validatePoint(s.handleLow) &&
      validatePoint(s.handleEnd)
    );
  }

  if ('start' in s && 'bottom' in s && 'end' in s) {
    return validatePoint(s.start) && validatePoint(s.bottom) && validatePoint(s.end);
  }

  if ('gapStart' in s && 'gapEnd' in s) {
    return validatePoint(s.gapStart) && validatePoint(s.gapEnd);
  }

  if ('impulse' in s) {
    const validImpulse =
      s.impulse &&
      typeof s.impulse === 'object' &&
      'wave1' in s.impulse &&
      'wave2' in s.impulse &&
      'wave3' in s.impulse &&
      'wave4' in s.impulse &&
      'wave5' in s.impulse;

    if (!validImpulse) return false;

    const waves = [
      s.impulse.wave1,
      s.impulse.wave2,
      s.impulse.wave3,
      s.impulse.wave4,
      s.impulse.wave5,
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
