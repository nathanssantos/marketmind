import { useEffect } from 'react';
import { patternDetectionService } from '../utils/patternDetection';
import { usePatternRelationshipsWorker } from './usePatternRelationshipsWorker';

export const usePatternDetectionWorker = (): void => {
  const { buildRelationships } = usePatternRelationshipsWorker();

  useEffect(() => {
    patternDetectionService.setWorkerBuildRelationships(buildRelationships);
  }, [buildRelationships]);
};
