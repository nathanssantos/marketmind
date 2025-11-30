import { workerPool } from '@/renderer/utils/WorkerPool';
import type { AIPattern } from '@shared/types';
import { useCallback, useEffect, useRef } from 'react';
import type { PatternRelationship } from '../utils/patternDetection/core/patternRelationships';
import { buildPatternRelationships } from '../utils/patternDetection/core/patternRelationships';

const WORKER_TIMEOUT_MS = 5000;
const MIN_PATTERNS_FOR_WORKER = 10;
const WORKER_KEY = 'patternRelationships';

interface WorkerOutput {
  relationships: PatternRelationship[];
  executionTime: number;
  error?: string;
}

interface UsePatternRelationshipsWorkerReturn {
  buildRelationships: (patterns: AIPattern[], useWorker?: boolean) => Promise<PatternRelationship[]>;
  terminate: () => void;
}

export const usePatternRelationshipsWorker = (): UsePatternRelationshipsWorkerReturn => {
  const workerRef = useRef<Worker | null>(null);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (!workerPool.has(WORKER_KEY)) {
      workerPool.register(WORKER_KEY, () =>
        new Worker(
          new URL('../workers/patternRelationshipsWorker.ts', import.meta.url),
          { type: 'module' }
        )
      );
    }

    workerRef.current = workerPool.get(WORKER_KEY);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const buildRelationships = useCallback(
    async (patterns: AIPattern[], useWorker: boolean = true): Promise<PatternRelationship[]> => {
      if (!useWorker || patterns.length < MIN_PATTERNS_FOR_WORKER) {
        return buildPatternRelationships(patterns);
      }

      return new Promise((resolve) => {
        try {
          const worker = workerRef.current;
          
          if (!worker) {
            resolve(buildPatternRelationships(patterns));
            return;
          }

          timeoutRef.current = window.setTimeout(() => {
            resolve(buildPatternRelationships(patterns));
          }, WORKER_TIMEOUT_MS);

          worker.onmessage = (event: MessageEvent<WorkerOutput>) => {
            if (timeoutRef.current) {
              clearTimeout(timeoutRef.current);
              timeoutRef.current = null;
            }

            if (event.data.error) {
              resolve(buildPatternRelationships(patterns));
            } else {
              resolve(event.data.relationships);
            }
          };

          worker.onerror = () => {
            if (timeoutRef.current) {
              clearTimeout(timeoutRef.current);
              timeoutRef.current = null;
            }
            resolve(buildPatternRelationships(patterns));
          };

          worker.postMessage({ patterns });
        } catch {
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
          }
          resolve(buildPatternRelationships(patterns));
        }
      });
    },
    []
  );

  const terminate = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    workerPool.terminate(WORKER_KEY);
  }, []);

  return { buildRelationships, terminate };
};
