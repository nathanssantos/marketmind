import type { AIPattern } from '@marketmind/types';
import { buildPatternRelationships, type PatternRelationship } from '../utils/patternDetection/core/patternRelationships';

interface WorkerInput {
  patterns: AIPattern[];
}

interface WorkerOutput {
  relationships: PatternRelationship[];
  executionTime: number;
}

self.onmessage = (event: MessageEvent<WorkerInput>): void => {
  const startTime = performance.now();
  const { patterns } = event.data;
  
  try {
    const relationships = buildPatternRelationships(patterns);
    
    const executionTime = performance.now() - startTime;
    
    const result: WorkerOutput = {
      relationships,
      executionTime,
    };
    
    self.postMessage(result);
  } catch (error) {
    self.postMessage({
      error: error instanceof Error ? error.message : 'Unknown error in worker',
    });
  }
};
