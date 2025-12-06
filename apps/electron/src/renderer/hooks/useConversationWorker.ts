import { workerPool } from '@/renderer/utils/WorkerPool';
import type {
    ConversationWorkerRequest,
    ConversationWorkerResponse,
} from '@/renderer/workers/conversation.worker';
import type { AIMessage } from '@marketmind/types';
import { useCallback, useEffect, useRef } from 'react';

export interface SummarizedConversation {
  summary: string;
  recentMessages: AIMessage[];
  totalMessagesSummarized: number;
}

export interface UseConversationWorkerReturn {
  summarizeConversation: (
    messages: AIMessage[],
    messagesToKeepFull?: number
  ) => Promise<SummarizedConversation>;
  terminate: () => void;
}

export const useConversationWorker = (): UseConversationWorkerReturn => {
  const workerRef = useRef<Worker | null>(null);
  const pendingCallbacksRef = useRef<
    Map<number, (result: SummarizedConversation) => void>
  >(new Map());
  const requestIdRef = useRef(0);

  useEffect(() => {
    const WORKER_KEY = 'conversation';
    
    if (!workerPool.has(WORKER_KEY)) {
      workerPool.register(WORKER_KEY, () => 
        new Worker(
          new URL('../workers/conversation.worker.ts', import.meta.url),
          { type: 'module' }
        )
      );
    }
    
    workerRef.current = workerPool.get(WORKER_KEY);

    const messageHandler = (
      event: MessageEvent<ConversationWorkerResponse>
    ) => {
      const { type, ...result } = event.data;

      if (type === 'summaryResult') {
        const callbacks = Array.from(pendingCallbacksRef.current.values());
        pendingCallbacksRef.current.clear();

        callbacks.forEach((callback) => {
          callback(result as unknown as SummarizedConversation);
        });
      }
    };
    
    if (workerRef.current) {
      workerRef.current.addEventListener('message', messageHandler);
    }

    return () => {
      if (workerRef.current) {
        workerRef.current.removeEventListener('message', messageHandler);
      }
      pendingCallbacksRef.current.clear();
    };
  }, []);

  const summarizeConversation = useCallback(
    (
      messages: AIMessage[],
      messagesToKeepFull?: number
    ): Promise<SummarizedConversation> => {
      return new Promise((resolve) => {
        if (!workerRef.current) {
          resolve({
            summary: '',
            recentMessages: messages,
            totalMessagesSummarized: 0,
          });
          return;
        }

        const requestId = requestIdRef.current++;
        pendingCallbacksRef.current.set(requestId, resolve);

        const request: ConversationWorkerRequest = {
          type: 'summarize',
          messages: messages.map((msg) => ({
            id: msg.id,
            role: msg.role,
            content: msg.content,
            timestamp: msg.openTime,
          })),
          ...(messagesToKeepFull !== undefined && { messagesToKeepFull }),
        };

        workerRef.current.postMessage(request);
      });
    },
    []
  );

  const terminate = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }
    pendingCallbacksRef.current.clear();
  }, []);

  return {
    summarizeConversation,
    terminate,
  };
};
