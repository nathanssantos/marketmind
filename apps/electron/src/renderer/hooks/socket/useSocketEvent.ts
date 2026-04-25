import { useEffect, useRef } from 'react';
import type { ServerToClientEvents } from '@marketmind/types';
import { socketBus } from '../../services/socketBus';

type ServerEvent = keyof ServerToClientEvents;

/**
 * Subscribe to a typed server event. The handler reference can change between
 * renders without resubscribing — we always invoke the latest one via a ref.
 */
export const useSocketEvent = <E extends ServerEvent>(
  event: E,
  handler: ServerToClientEvents[E],
  enabled = true,
): void => {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!enabled) return;
    const wrapper = ((payload: Parameters<ServerToClientEvents[E]>[0]) => {
      (handlerRef.current as (p: Parameters<ServerToClientEvents[E]>[0]) => void)(payload);
    }) as ServerToClientEvents[E];
    return socketBus.on(event, wrapper);
  }, [event, enabled]);
};
