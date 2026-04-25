import { logger } from '../logger';

export type EventHandler<T = unknown> = (walletId: string, event: T) => void | Promise<void>;

export type EventHandlerMap<EventName extends string = string> = Partial<Record<EventName, EventHandler>>;

export interface DispatchOptions {
  logPrefix: string;
  walletId: string;
  unknownEventWarnLevel?: 'trace' | 'warn';
}

export const dispatchUserDataEvent = <EventName extends string>(
  message: unknown,
  handlers: EventHandlerMap<EventName>,
  options: DispatchOptions,
): void => {
  if (typeof message !== 'object' || message === null) return;

  const event = message as Record<string, unknown>;
  const eventType = event['e'];
  if (typeof eventType !== 'string') return;

  const handler = handlers[eventType as EventName];
  if (handler) {
    void handler(options.walletId, event);
    return;
  }

  const level = options.unknownEventWarnLevel ?? 'trace';
  logger[level](
    { walletId: options.walletId, eventType },
    `${options.logPrefix} Unhandled event type`,
  );
};
